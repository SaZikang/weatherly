const THEME_KEY = "weatherly:theme";
const ORDER = ["system", "light", "dark"];

const ICONS = {
  system:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>',
  light:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>',
  dark:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.8 14.8A8.2 8.2 0 0 1 9.2 4.2 8.3 8.3 0 1 0 19.8 14.8Z"></path></svg>',
};

export function initThemePicker(button) {
  if (!button) return null;

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let choice = readChoice();

  const getResolvedTheme = () =>
    choice === "system" ? (media.matches ? "dark" : "light") : choice;

  const updateButton = () => {
    const index = ORDER.indexOf(choice);
    const next = ORDER[(index + 1) % ORDER.length];
    button.innerHTML = ICONS[choice];
    button.dataset.themeChoice = choice;
    button.setAttribute(
      "aria-label",
      `Theme: ${capitalize(choice)}. Activate to switch to ${capitalize(next)}.`,
    );
    button.title = `Theme: ${capitalize(choice)} · next ${capitalize(next)}`;
  };

  const applyTheme = ({ persist = false, animate = false } = {}) => {
    const resolved = getResolvedTheme();
    const applyDom = () => {
      const root = document.documentElement;
      root.dataset.theme = resolved;
      root.dataset.themeChoice = choice;
      root.style.colorScheme = resolved;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute("content", resolved === "dark" ? "#0d1512" : "#eef3ed");
      }
      updateButton();
    };

    if (animate && document.startViewTransition) {
      document.startViewTransition(applyDom);
    } else {
      if (animate) {
        document.documentElement.classList.add("is-theme-changing");
        window.setTimeout(
          () => document.documentElement.classList.remove("is-theme-changing"),
          420,
        );
      }
      applyDom();
    }

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, choice);
      } catch {
        // The chosen theme still applies for this tab.
      }
    }
  };

  button.addEventListener("click", () => {
    const index = ORDER.indexOf(choice);
    choice = ORDER[(index + 1) % ORDER.length];
    applyTheme({ persist: true, animate: true });
  });

  media.addEventListener?.("change", () => {
    if (choice === "system") applyTheme({ animate: true });
  });

  applyTheme();
  return {
    getChoice: () => choice,
    getResolvedTheme,
  };
}

function readChoice() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return ORDER.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
