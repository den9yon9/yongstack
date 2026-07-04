import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "theme";

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") return "dark";
  if (stored === "light") return "light";
  return getSystemPreference();
}

function applyTheme(theme: "light" | "dark") {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<"light" | "dark">(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-on-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-on-sidebar"
      aria-label={theme === "light" ? "切换深色模式" : "切换浅色模式"}
    >
      {theme === "light" ? (
        <Moon className="size-5 shrink-0" />
      ) : (
        <Sun className="size-5 shrink-0" />
      )}
      <span>{theme === "light" ? "深色模式" : "浅色模式"}</span>
    </button>
  );
}
