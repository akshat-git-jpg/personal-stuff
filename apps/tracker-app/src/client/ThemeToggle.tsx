import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoredTheme, setTheme, type Theme } from "./theme";

const ORDER: Theme[] = ["light", "dark", "system"];
const ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const LABEL = { light: "Light", dark: "Dark", system: "System" } as const;

/** Cycles light → dark → system. Persists the choice. */
export function ThemeToggle() {
  const [theme, set] = useState<Theme>(() => getStoredTheme());
  const Icon = ICON[theme];
  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    set(next);
    setTheme(next);
  }
  return (
    <Button variant="ghost" size="icon" className="size-8" onClick={cycle}
      title={`Theme: ${LABEL[theme]} (click to change)`} aria-label={`Theme: ${LABEL[theme]}`}>
      <Icon className="size-4" />
    </Button>
  );
}
