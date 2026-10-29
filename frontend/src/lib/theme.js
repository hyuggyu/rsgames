export const THEME_KEY = "rs_color_theme";

export function preferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  localStorage.setItem(THEME_KEY, next);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "light" ? "#f8f5ed" : "#0c0a07");
  window.dispatchEvent(new CustomEvent("rs:theme", { detail: next }));
  return next;
}
