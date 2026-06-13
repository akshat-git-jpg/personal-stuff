import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { ToastHost } from "./ui";
import { GymProvider } from "./store";
import { Home } from "./Home";
import { GroupView } from "./GroupView";
import { ExerciseDetail } from "./ExerciseDetail";
import { WorkoutHistory, SessionView } from "./History";
import type { Gym, GroupSpec } from "./gym";

type View =
  | { name: "home" }
  | { name: "group"; spec: GroupSpec; gym: Gym }
  | { name: "exercise"; tab: string; id: string; back: GroupSpec; gym: Gym }
  | { name: "history"; gym: Gym }
  | { name: "session"; day: string; gym: Gym; from: "home" | "history" };

// The parent each view goes "back" to. Single source of truth so the breadcrumb
// arrow and the left-edge swipe gesture always agree. null = nowhere to go (home).
function parentOf(view: View): View | null {
  switch (view.name) {
    case "home":
      return null;
    case "group":
      return { name: "home" };
    case "exercise":
      return { name: "group", spec: view.back, gym: view.gym };
    case "history":
      return { name: "home" };
    case "session":
      return view.from === "history"
        ? { name: "history", gym: view.gym }
        : { name: "home" };
  }
}

// Interactive back-swipe tuning.
const EDGE = 28; // px from the left edge where a back-swipe may start
const PARALLAX = 0.26; // how far (fraction of width) the parent sits left at rest
const DIM_MAX = 0.32; // peak darkness over the incoming parent
const DIST_DONE = 0.42; // release past this fraction of width → complete the pop
const VEL_DONE = 0.5; // …or fling faster than this (px/ms) → complete the pop
const SPRING = "transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1)";
const DIM_SPRING = "opacity 0.34s cubic-bezier(0.22, 0.61, 0.36, 1)";

function Router() {
  const [view, setView] = useState<View>({ name: "home" });
  // Non-null while a back-swipe (or its release animation) is in flight; holds
  // the parent view that's sliding in underneath the current one.
  const [swiping, setSwiping] = useState<View | null>(null);
  // Suppress the .screen fade for one render right after a swipe completes —
  // the parent has already slid fully into place, so a fade would flicker.
  const [noAnim, setNoAnim] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);
  const underRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);

  // Live gesture state kept in refs so touchmove can drive the DOM directly
  // (state is only used to mount/unmount the layers).
  const dxRef = useRef(0);
  const startScrollRef = useRef(0);

  // Position the two layers for a given horizontal offset.
  const applyFrame = useCallback((dx: number, animate: boolean) => {
    const top = topRef.current;
    const under = underRef.current;
    const dim = dimRef.current;
    if (!top || !under) return;
    const w = window.innerWidth || 1;
    const p = Math.min(1, Math.max(0, dx / w)); // 0 = closed, 1 = fully popped
    const trans = animate ? SPRING : "none";
    top.style.transition = trans;
    under.style.transition = trans;
    top.style.transform = `translateX(${dx}px)`;
    under.style.transform = `translateX(${-(1 - p) * PARALLAX * w}px)`;
    if (dim) {
      dim.style.transition = animate ? DIM_SPRING : "none";
      dim.style.opacity = String((1 - p) * DIM_MAX);
    }
  }, []);

  // When the layers mount, restore the outgoing screen's scroll and paint the
  // first frame so there's no flash of the un-offset state.
  useLayoutEffect(() => {
    if (!swiping) return;
    if (topRef.current) topRef.current.scrollTop = startScrollRef.current;
    applyFrame(dxRef.current, false);
  }, [swiping, applyFrame]);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let vx = 0;
    let tracking = false; // touch began at the edge, still a candidate
    let engaged = false; // confirmed horizontal back-swipe, layers mounted
    let parent: View | null = null;
    let finishing = false; // release animation running, ignore further input

    const onStart = (e: TouchEvent) => {
      if (finishing) return;
      const t = e.touches[0];
      tracking = t.clientX <= EDGE;
      engaged = false;
      if (!tracking) return;
      parent = parentOf(view);
      if (!parent) {
        tracking = false;
        return;
      }
      startX = lastX = t.clientX;
      startY = t.clientY;
      lastT = e.timeStamp;
      vx = 0;
      dxRef.current = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!engaged) {
        // Decide intent: clearly rightward & more horizontal than vertical.
        if (dx > 10 && dx > Math.abs(dy)) {
          engaged = true;
          startScrollRef.current = window.scrollY || 0;
          dxRef.current = dx;
          setSwiping(parent); // mount the layers
        } else if (Math.abs(dy) > 10) {
          tracking = false; // it's a vertical scroll — let it be
          return;
        } else {
          return;
        }
      }
      vx = (t.clientX - lastX) / Math.max(1, e.timeStamp - lastT);
      lastX = t.clientX;
      lastT = e.timeStamp;
      dxRef.current = Math.max(0, dx);
      applyFrame(dxRef.current, false);
      e.preventDefault(); // stop the page from scrolling under the gesture
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!engaged) return;
      engaged = false;
      finishing = true;
      const w = window.innerWidth || 1;
      const complete = dxRef.current > w * DIST_DONE || vx > VEL_DONE;
      const target = parent!;

      const cleanup = (commit: boolean) => {
        finishing = false;
        // Clear the imperatively-set inline styles — React reuses this same
        // .nav-top element across renders, so a leftover translateX would push
        // the freshly-committed view off-screen (blank page).
        const node = topRef.current;
        if (node) {
          node.style.transform = "";
          node.style.transition = "";
        }
        if (commit) {
          setNoAnim(true);
          setView(target);
        }
        setSwiping(null);
      };

      const top = topRef.current;
      if (!top) {
        cleanup(complete);
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        top.removeEventListener("transitionend", onDone);
        clearTimeout(timer);
        cleanup(complete);
      };
      const onDone = (ev: TransitionEvent) => {
        if (ev.propertyName === "transform") finish();
      };
      top.addEventListener("transitionend", onDone);
      // Fallback: if the transform doesn't actually change, transitionend never
      // fires — don't leave the UI stuck in the fixed-layer state.
      const timer = setTimeout(finish, 420);
      applyFrame(complete ? w : 0, true);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [view, applyFrame]);

  // Drop the fade-suppression flag once the committed view has painted.
  useEffect(() => {
    if (!noAnim) return;
    const id = requestAnimationFrame(() => setNoAnim(false));
    return () => cancelAnimationFrame(id);
  }, [noAnim]);

  function renderView(v: View) {
    switch (v.name) {
      case "home":
        return (
          <Home
            onOpen={(spec, gym) => setView({ name: "group", spec, gym })}
            onOpenHistory={(gym) => setView({ name: "history", gym })}
            onOpenDay={(day, gym) => setView({ name: "session", day, gym, from: "home" })}
          />
        );
      case "group":
        return (
          <GroupView
            spec={v.spec}
            onBack={() => setView({ name: "home" })}
            onOpenExercise={(id) =>
              setView({ name: "exercise", tab: v.spec.tab, id, back: v.spec, gym: v.gym })
            }
          />
        );
      case "exercise":
        return (
          <ExerciseDetail
            tab={v.tab}
            id={v.id}
            onBack={() => setView({ name: "group", spec: v.back, gym: v.gym })}
          />
        );
      case "history":
        return (
          <WorkoutHistory
            gym={v.gym}
            onBack={() => setView({ name: "home" })}
            onOpenDay={(day) => setView({ name: "session", day, gym: v.gym, from: "history" })}
          />
        );
      case "session":
        return (
          <SessionView
            day={v.day}
            gym={v.gym}
            onBack={() =>
              setView(v.from === "history" ? { name: "history", gym: v.gym } : { name: "home" })
            }
          />
        );
    }
  }

  const cls = `viewport${swiping ? " swiping" : ""}${noAnim ? " no-anim" : ""}`;
  return (
    <div className={cls}>
      {swiping && (
        <>
          <div className="nav-layer nav-under" ref={underRef}>
            {renderView(swiping)}
          </div>
          <div className="nav-dim" ref={dimRef} />
        </>
      )}
      <div className="nav-layer nav-top" ref={topRef}>
        {renderView(view)}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastHost>
      <GymProvider>
        <Router />
      </GymProvider>
    </ToastHost>
  );
}
