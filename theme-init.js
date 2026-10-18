(function applyInitialTheme() {
  const key = "weatherly:theme";
  let choice = "system";

  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark" || saved === "system") {
      choice = saved;
    }
  } catch {
    // System preference is still available when storage is blocked.
  }

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const resolved = choice === "system" ? (prefersDark ? "dark" : "light") : choice;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeChoice = choice;
  root.style.colorScheme = resolved;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", resolved === "dark" ? "#0d1512" : "#eef3ed");
  }
})();
