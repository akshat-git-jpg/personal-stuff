import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { Exercise, ExerciseInput, Group, LogEntry, LogInput, LogPatch, PlanRow } from "../shared";
import { RECENT_LOG_DAYS } from "../shared";
import { useToast } from "./ui";
import { publishPlan } from "./plan";

const CACHE_KEY = "gym.cache.v4";



const recentCutoff = () => new Date(Date.now() - RECENT_LOG_DAYS * 86400000).toISOString();

interface Meta {
  tab: string;
  label: string;
  isMixed: boolean;
}
interface Snapshot {
  plan: PlanRow[];
  meta: Meta[];
  byTab: Record<string, Exercise[]>;
  log: LogEntry[];
}

const EMPTY: Snapshot = { plan: [], meta: [], byTab: {}, log: [] };

function loadCache(): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

interface Gym {
  plan: PlanRow[];
  addPlanRow: (day: number, exerciseId: string) => Promise<void>;
  deletePlanRow: (day: number, exerciseId: string) => void;
  reorderPlanDay: (day: number, orderedIds: string[]) => void;
  ready: boolean;
  syncing: boolean;
  logComplete: boolean;
  groups: Group[];
  log: LogEntry[];
  exercisesFor: (tab: string) => Exercise[];
  /** Every exercise across every tab, in tab order. */
  allExercises: Exercise[];
  exerciseById: (id: string) => Exercise | undefined;
  logFor: (exerciseId: string) => LogEntry[];
  setsTodayFor: (exerciseId: string) => number;
  refresh: () => Promise<void>;
  loadFullLog: () => Promise<void>;
  addExercise: (tab: string, input: ExerciseInput) => Promise<Exercise | null>;
  updateExercise: (tab: string, id: string, patch: ExerciseInput) => void;
  /** Flip the favourite flag. Optimistic, same as every other write here. */
  toggleStar: (ex: Exercise) => void;
  /** Resolves to an undo callback, or null when nothing was deleted. */
  deleteExercise: (tab: string, id: string) => Promise<(() => void) | null>;
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
          plan: data.plan,
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
  const allExercises = useMemo(
    () => snap.meta.flatMap((m) => exercisesFor(m.tab)),
    [snap.meta, exercisesFor],
  );
  const byId = useMemo(() => new Map(allExercises.map((e) => [e.id, e])), [allExercises]);
  const exerciseById = useCallback((id: string) => byId.get(id), [byId]);

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
  // Resolves once the row is on the server, so a caller can safely reorder
  // straight after (an undo does exactly that).
  const addToPlan = useCallback(
    (day: number, exerciseId: string): Promise<void> => {
      const before = snapRef.current.plan;
      if (before.some((r) => r.day === day && r.exerciseId === exerciseId)) return Promise.resolve();
      const position = before.filter((r) => r.day === day).length;
      setSnap((s) => ({ ...s, plan: [...s.plan, { day, exerciseId, position }] }));
      return api.addPlanRow(day, exerciseId).then(
        () => undefined,
        (e) => {
          toast(String((e as Error).message), true);
          setSnap((s) => ({ ...s, plan: before }));
        },
      );
    },
    [toast],
  );

  const removeFromPlan = useCallback(
    (day: number, exerciseId: string) => {
      const before = snapRef.current.plan;
      setSnap((s) => ({ ...s, plan: s.plan.filter((r) => !(r.day === day && r.exerciseId === exerciseId)) }));
      api.deletePlanRow(day, exerciseId).catch((e) => {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, plan: before }));
      });
    },
    [toast],
  );

  const reorderPlanDay = useCallback(
    (day: number, orderedIds: string[]) => {
      const before = snapRef.current.plan;
      const currentDay = before.filter((r) => r.day === day).sort((a, b) => a.position - b.position);
      const otherDays = before.filter((r) => r.day !== day);
      const byId: any = { };
      for (const r of currentDay) byId[r.exerciseId] = r;
      const nextDay = orderedIds.map((id, i) => {
        const r = byId[id];
        if (!r) return null;
        return { ...r, position: i };
      }).filter(Boolean) as PlanRow[];
      setSnap((s) => ({ ...s, plan: [...otherDays, ...nextDay] }));
      api.reorderPlanDay(day, orderedIds).catch((e) => {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, plan: before }));
      });
    },
    [toast],
  );



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

  const toggleStar = useCallback(
    (ex: Exercise) => {
      const next = !ex.starred;
      const before = snapRef.current.byTab[ex.tab] ?? [];
      setSnap((s) => ({
        ...s,
        byTab: {
          ...s.byTab,
          [ex.tab]: (s.byTab[ex.tab] ?? []).map((e) =>
            e.id === ex.id ? { ...e, starred: next } : e,
          ),
        },
      }));
      api.updateExercise(ex.tab, ex.id, { name: ex.name, starred: next }).catch((e) => {
        toast(String((e as Error).message), true);
        setSnap((s) => ({ ...s, byTab: { ...s.byTab, [ex.tab]: before } }));
      });
    },
    [toast],
  );

  const deleteExercise = useCallback(
    async (tab: string, id: string): Promise<(() => void) | null> => {
      const before = snapRef.current.byTab[tab] ?? [];
      const planBefore = snapRef.current.plan;
      const ex = before.find((e) => e.id === id);
      // The server cascades plan rows away with the exercise; remember which
      // days it was on so an undo can put both back.
      const planDays = planBefore.filter((r) => r.exerciseId === id).map((r) => r.day);
      const gone = (s: Snapshot): Snapshot => ({
        ...s,
        byTab: { ...s.byTab, [tab]: (s.byTab[tab] ?? []).filter((e) => e.id !== id) },
        plan: s.plan.filter((r) => r.exerciseId !== id),
      });
      const back = (s: Snapshot): Snapshot => ({
        ...s,
        byTab: { ...s.byTab, [tab]: before },
        plan: planBefore,
      });
      setSnap(gone);
      try {
        await api.deleteExercise(tab, id);
      } catch (e) {
        toast(String((e as Error).message), true);
        setSnap(back);
        return null;
      }
      if (!ex) return null;
      return () => {
        setSnap(back);
        api.restoreExercise(tab, ex, planDays).catch((err) => {
          toast(String((err as Error).message), true);
          setSnap(gone);
        });
      };
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

  publishPlan(snap.plan, { add: addToPlan, remove: removeFromPlan, reorder: reorderPlanDay });

  const value: Gym = {
    plan: snap.plan,
    addPlanRow: addToPlan,
    deletePlanRow: removeFromPlan,
    reorderPlanDay,

    ready,
    syncing,
    logComplete,
    groups,
    log: snap.log,
    exercisesFor,
    allExercises,
    exerciseById,
    logFor,
    setsTodayFor,
    refresh,
    loadFullLog,
    addExercise,
    updateExercise,
    toggleStar,
    deleteExercise,
    reorder,
    addLog,
    updateLog,
    deleteLog,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
