import { useEffect, useState } from "react";
import type { DocItem } from "../shared";
import { getIndex, getMe } from "./api";
import { SignIn } from "./SignIn";
import { Home } from "./Home";
import { Detail } from "./Detail";
import { AddSheet } from "./AddSheet";

type Auth = "loading" | "out" | string; // string = signed-in email
type View = { kind: "home" } | { kind: "detail"; id: string } | { kind: "add" };

export function App() {
  const [auth, setAuth] = useState<Auth>("loading");
  const [items, setItems] = useState<DocItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>({ kind: "home" });

  useEffect(() => {
    getMe()
      .then((email) => {
        if (!email) return setAuth("out");
        setAuth(email);
        return getIndex().then((it) => {
          setItems(it);
          setLoaded(true);
        });
      })
      .catch(() => setAuth("out"));
  }, []);

  if (auth === "loading") return <div className="splash">Loading…</div>;
  if (auth === "out") return <SignIn />;

  if (view.kind === "add") {
    return (
      <AddSheet
        items={items}
        onSaved={(next) => {
          setItems(next);
          setView({ kind: "home" });
        }}
        onCancel={() => setView({ kind: "home" })}
      />
    );
  }

  if (view.kind === "detail") {
    const item = items.find((i) => i.id === view.id);
    if (!item) {
      setView({ kind: "home" });
      return null;
    }
    return (
      <Detail
        item={item}
        items={items}
        onBack={() => setView({ kind: "home" })}
        onChanged={(next) => setItems(next)}
        onDeleted={(next) => {
          setItems(next);
          setView({ kind: "home" });
        }}
      />
    );
  }

  return (
    <Home
      items={items}
      loaded={loaded}
      onOpen={(id) => setView({ kind: "detail", id })}
      onAdd={() => setView({ kind: "add" })}
    />
  );
}
