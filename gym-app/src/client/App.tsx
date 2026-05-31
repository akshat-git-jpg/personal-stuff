import { useState } from "react";
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

function Router() {
  const [view, setView] = useState<View>({ name: "home" });

  switch (view.name) {
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
          spec={view.spec}
          onBack={() => setView({ name: "home" })}
          onOpenExercise={(id) =>
            setView({ name: "exercise", tab: view.spec.tab, id, back: view.spec, gym: view.gym })
          }
        />
      );
    case "exercise":
      return (
        <ExerciseDetail
          tab={view.tab}
          id={view.id}
          onBack={() => setView({ name: "group", spec: view.back, gym: view.gym })}
        />
      );
    case "history":
      return (
        <WorkoutHistory
          gym={view.gym}
          onBack={() => setView({ name: "home" })}
          onOpenDay={(day) => setView({ name: "session", day, gym: view.gym, from: "history" })}
        />
      );
    case "session":
      return (
        <SessionView
          day={view.day}
          gym={view.gym}
          onBack={() =>
            setView(
              view.from === "history" ? { name: "history", gym: view.gym } : { name: "home" },
            )
          }
        />
      );
  }
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
