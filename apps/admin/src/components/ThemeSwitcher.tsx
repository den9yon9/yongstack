import { Paintbrush } from "lucide-react";
import { useEffect, useState } from "react";

const THEMES = [
  "light",
  "dark",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "forest",
  "dracula",
  "nord",
  "dim",
] as const;

const STORAGE_KEY = "daisyui-theme";

function getStoredTheme(): string {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(STORAGE_KEY) ?? "light";
}

function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="dropdown dropdown-top dropdown-end w-full">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost w-full justify-start gap-3 text-base-content/60"
      >
        <Paintbrush className="h-4 w-4 shrink-0" />
        <span className="text-sm normal-case">主题</span>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu menu-sm bg-base-200 rounded-box z-10 w-40 shadow"
      >
        {THEMES.map((t) => (
          <li key={t}>
            <button
              type="button"
              onClick={() => setTheme(t)}
              className={theme === t ? "menu-active" : ""}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
