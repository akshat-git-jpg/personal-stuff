import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { Exercise, ExerciseInput, Group, LogEntry, LogInput, LogPatch } from "../shared";
import { RECENT_LOG_DAYS } from "../shared";
import { useToast } from "./ui";

const CACHE_KEY = "gym.cache.v3";
const recentCutoff = () => new Date(Date.now() - RECENT_LOG_DAYS * 86400000).toISOString();

interface Meta {
  tab: string;
  label: string;
  isMixed: boolean;
}
interface Snapshot {
  meta: Meta[];
  byTab: Record<string, Exercise[]>;
  log: LogEntry[];
}

const EMPTY: Snapshot = { meta: [], byTab: {}, log: [] };

function loadCache(): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

interface Gym {
  ready: boolean;
  syncing: boolean;
  logComplete: boolean;
  groups: Group[];
  log: LogEntry[];
  exercisesFor: (tab: string) => Exercise[];
  logFor: (exerciseId: string) => LogEntry[];
  setsTodayFor: (exerciseId: string) => number;
  refresh: () => Promise<void>;
  loadFullLog: () => Promise<void>;
  addExercise: (tab: string, input: ExerciseInput) => Promise<Exercise | null>;
  updateExercise: (tab: string, id: string, patch: ExerciseInput) => void;
  deleteExercise: (tab: string, id: string) => Promise<void>;
  reorder: (tab: string, orderedIds: string[]) => void;
  addLog: (input: LogInput) => void;
  updateLog: (date: string, patch: LogPatch) => void;
  deleteLog: (date: string) => void;
}

const Ctx = createContext<Gym>(null as unknown as Gym);
export const useGym = () => useContext(Ctx);

export function GymProvider({ children }: { children: ReactNode }) {
  const cached = loadCache();
  const [snap, setSnap] = useState<Snapshot>(cached ?? EMPTY);
  const [ready, setReady] = useState(!!cached);
  const [syncing, setSyncing] = useState(false);
  const [logComplete, setLogComplete] = useState(false);
  const toast = useToast();

  // Keep refs to latest values for use inside async handlers.
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const completeRef = useRef(logComplete);
  completeRef.current = logComplete;

  // Persist every change — but only the recent slice, so the cache stays small
  // no matter how much history accumulates.
  useEffect(() => {
    try {
      const cutoff = recentCutoff();
      const trimmed: Snapshot = { ...snap, log: snap.log.filter((l) => l.date >= cutoff) };
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    } catch {
      /* quota — ignore */
    }
  }, [snap]);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const data = await api.bootstrap();
      setSnap((s) => {
        // Server is authoritative for the recent window; keep any older entries
        // we'd already loaded this session so full history isn't lost on refresh.
        const older = s.log.filter((l) => l.date < data.logCutoff);
        return {
          meta: data.groups.map((g) => ({ tab: g.tab, label: g.label, isMixed: g.isMixed })),
          byTab: data.exercises,
          log: [...data.log, ...older].sort((a, b) => (a.date < b.date ? 1 : -1)),
        };
      });
      setReady(true);
    } catch (e) {
      if (!snapRef.current.meta.length) toast(String((e as Error).message), true);
    } finally {
      setSyncing(false);
    }
  }, [toast]);

  // Pull the full log (older than the recent window) — lazily, on demand.
  const loadFullLog = useCallback(async () => {
    if (completeRef.current) return;
    completeRef.current = true; // guard against concurrent calls
    try {
      const full = await api.fullLog();
      setSnap((s) => ({ ...s, log: full }));
      setLogComplete(true);
    } catch {
      completeRef.current = false; // allow retry
    }
  }, []);

  // Load on mount (and refresh when the app regains focus).
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const groups: Group[] = snap.meta.map((m) => ({
    ...m,
    count: (snap.byTab[m.tab] ?? []).length,
  }));

  const exercisesFor = useCallback((tab: string) => snap.byTab[tab] ?? [], [snap]);
  const logFor = useCallback(
    (id: string) => snap.log.filter((l) => l.exerciseId === id),
    [snap],
  );
  const setsTodayFor = useCallback(
    (id: string) => {
      const today = new Date().toISOString().slice(0, 10);
      return snap.log.filter((l) => l.exerciseId === id && l.date.slice(0, 10) === today).length;
    },
    [snap],
  );

  // ---- optimistic mutations ----

  const addExercise = useCallback(
    async (tab: string, input: ExerciseInput): Promise<Exercise | null> => {
      try {
        const created = await api.addExercise(tab, input);
        setSnap((s) => ({ ...s, byTab: { ...s.byTab, [tab]: [...(s.byTab[tab] ?? []), created] } }));
        return created;
      } catch (e) {
        toast(String((e as Error).message), true);
        return null;
      }
    },
    [toast],
  );

  const updateExercise = useCallback(
    (tab: string, id: string, patch: ExerciseInput) => {
      const before = snapRef.current.byTab[tab] ?? [];
      setSnap((s) => ({
        ...s,
        byTab: {
          ...s.byTab,
          [tab]: (s.byTab[tab] ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)),
        },
      }));
      api.updateExercise(tab, id, patch).catch((e) => {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, byTab: { ...s.byTab, [tab]: before } }));
      });
    },
    [toast],
  );

  const deleteExercise = useCallback(
    async (tab: string, id: string) => {
      const before = snapRef.current.byTab[tab] ?? [];
      setSnap((s) => ({
        ...s,
        byTab: { ...s.byTab, [tab]: (s.byTab[tab] ?? []).filter((e) => e.id !== id) },
      }));
      try {
        await api.deleteExercise(tab, id);
      } catch (e) {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, byTab: { ...s.byTab, [tab]: before } }));
      }
    },
    [toast],
  );

  const reorder = useCallback(
    (tab: string, orderedIds: string[]) => {
      const before = snapRef.current.byTab[tab] ?? [];
      const byId = new Map(before.map((e) => [e.id, e]));
      const next = orderedIds.map((i) => byId.get(i)).filter(Boolean) as Exercise[];
      setSnap((s) => ({ ...s, byTab: { ...s.byTab, [tab]: next } }));
      api.reorder(tab, orderedIds).catch((e) => {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, byTab: { ...s.byTab, [tab]: before } }));
      });
    },
    [toast],
  );

  const addLog = useCallback(
    (input: LogInput) => {
      // Client owns the timestamp so the optimistic entry and the persisted
      // row share the same key (needed for later edit/delete).
      const date = new Date().toISOString();
      const entry: LogEntry = {
        date,
        exerciseId: input.exerciseId,
        exercise: input.exercise,
        muscleGroup: input.muscleGroup,
        setNo: input.setNo,
        weight: input.weight,
        reps: input.reps,
        notes: input.notes ?? "",
      };
      setSnap((s) => ({ ...s, log: [entry, ...s.log] }));
      api.addLog({ ...input, date }).catch((e) => {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, log: s.log.filter((l) => l !== entry) }));
      });
    },
    [toast],
  );

  const updateLog = useCallback(
    (date: string, patch: LogPatch) => {
      const before = snapRef.current.log;
      setSnap((s) => ({
        ...s,
        log: s.log.map((l) => (l.date === date ? { ...l, ...patch } : l)),
      }));
      api.updateLog(date, patch).catch((e) => {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, log: before }));
      });
    },
    [toast],
  );

  const deleteLog = useCallback(
    (date: string) => {
      const before = snapRef.current.log;
      setSnap((s) => ({ ...s, log: s.log.filter((l) => l.date !== date) }));
      api.deleteLog(date).catch((e) => {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, log: before }));
      });
    },
    [toast],
  );

  const value: Gym = {
    ready,
    syncing,
    logComplete,
    groups,
    log: snap.log,
    exercisesFor,
    logFor,
    setsTodayFor,
    refresh,
    loadFullLog,
    addExercise,
    updateExercise,
    deleteExercise,
    reorder,
    addLog,
    updateLog,
    deleteLog,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
