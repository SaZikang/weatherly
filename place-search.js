const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MIN_CHARS = 2;
const SEARCH_TIMEOUT_MS = 10_000;

let searchInstanceId = 0;

/**
 * A reusable Open-Meteo place autocomplete.
 *
 * The selected value always contains the exact latitude/longitude returned by
 * geocoding, so callers can fetch weather or air quality for that precise point.
 */
export function createPlaceSearch({
  form,
  input,
  results,
  onSelect,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minChars = DEFAULT_MIN_CHARS,
  fetchImpl = globalThis.fetch,
}) {
  const instanceId = `place-search-${++searchInstanceId}`;
  const announcement = document.createElement("div");
  announcement.className = "search-announcement sr-only";
  announcement.setAttribute("aria-live", "polite");
  form.append(announcement);

  let debounceTimer = null;
  let requestController = null;
  let requestId = 0;
  let items = [];
  let highlightedIndex = -1;
  let currentQuery = "";

  input.setAttribute("aria-controls", results.id);
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-haspopup", "listbox");
  input.setAttribute("role", "combobox");
  results.setAttribute("aria-label", "Place suggestions");

  const announce = (message) => {
    announcement.textContent = "";
    window.setTimeout(() => {
      announcement.textContent = message;
    }, 20);
  };

  const clearHighlight = () => {
    highlightedIndex = -1;
    input.removeAttribute("aria-activedescendant");
    results.querySelectorAll(".search-result").forEach((option) => {
      option.classList.remove("is-highlighted");
      option.setAttribute("aria-selected", "false");
    });
  };

  const close = () => {
    window.clearTimeout(debounceTimer);
    requestId += 1;
    requestController?.abort();
    requestController = null;
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-busy", "false");
    clearHighlight();
    results.hidden = true;
    results.replaceChildren();
  };

  const renderState = (kind, message, options = {}) => {
    results.replaceChildren();
    clearHighlight();

    const state = document.createElement("div");
    state.className = `search-state search-state-${kind}`;
    state.setAttribute("role", "status");

    const icon = document.createElement("span");
    icon.className = kind === "loading" ? "search-spinner" : "search-state-icon";
    icon.setAttribute("aria-hidden", "true");
    if (kind === "empty") icon.textContent = "⌕";
    if (kind === "error") icon.textContent = "!";

    const text = document.createElement("span");
    text.className = "search-state-text";
    text.textContent = message;
    state.append(icon, text);

    if (options.retry) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "search-retry";
      retry.textContent = "Try again";
      retry.addEventListener("click", options.retry);
      state.append(retry);
    }

    results.append(state);
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    announce(message);
  };

  const highlight = (index) => {
    const options = [...results.querySelectorAll(".search-result")];
    if (!options.length) return;

    highlightedIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
      const selected = optionIndex === highlightedIndex;
      option.classList.toggle("is-highlighted", selected);
      option.setAttribute("aria-selected", String(selected));
      if (selected) {
        input.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
      }
    });
  };

  const select = (place) => {
    if (!place) return;
    window.clearTimeout(debounceTimer);
    input.value = "";
    close();
    onSelect(place);
  };

  const renderItems = () => {
    results.replaceChildren();
    clearHighlight();

    items.forEach((place, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "search-result";
      option.id = `${instanceId}-option-${index}`;
      option.tabIndex = -1;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.setAttribute("aria-label", formatPlaceLabel(place));
      option.dataset.latitude = String(place.latitude);
      option.dataset.longitude = String(place.longitude);

      const icon = document.createElement("span");
      icon.className = "search-result-icon";
      icon.textContent = countryFlag(place.countryCode) || "◎";
      icon.setAttribute("aria-hidden", "true");

      const copy = document.createElement("span");
      copy.className = "search-result-copy";
      const name = document.createElement("strong");
      name.textContent = place.name;
      const detail = document.createElement("span");
      detail.textContent = formatPlaceRegion(place);
      copy.append(name, detail);

      const arrow = document.createElement("span");
      arrow.className = "search-result-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↗";

      option.append(icon, copy, arrow);
      option.addEventListener("focus", () => highlight(index));
      option.addEventListener("mouseenter", () => highlight(index));
      option.addEventListener("click", () => select(place));
      results.append(option);
    });

    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    announce(`${items.length} place${items.length === 1 ? "" : "s"} found.`);
  };

  const executeSearch = async (query, shouldSelectFirst = false) => {
    const text = query.trim();
    currentQuery = text;
    if (!text) {
      close();
      return;
    }

    const coordinates = parseCoordinates(text);
    if (coordinates) {
      items = [
        normalizeSearchPlace({
          name: "Dropped pin",
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        }),
      ];
      renderItems();
      if (shouldSelectFirst) select(items[0]);
      return;
    }

    if (text.length < minChars) {
      close();
      return;
    }

    const activeRequest = ++requestId;
    requestController?.abort();
    const activeController = new AbortController();
    requestController = activeController;
    input.setAttribute("aria-busy", "true");
    renderState("loading", "Searching places…");

    const timeoutId = window.setTimeout(() => activeController.abort(), SEARCH_TIMEOUT_MS);

    try {
      const params = new URLSearchParams({
        name: text,
        count: "6",
        language: "en",
        format: "json",
      });
      const response = await fetchImpl(`${GEOCODING_API}?${params}`, {
        signal: activeController.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`Geocoding failed with ${response.status}`);
      const data = await response.json();
      if (activeRequest !== requestId) return;

      items = Array.isArray(data.results)
        ? data.results.map(normalizeSearchPlace)
        : [];

      if (!items.length) {
        renderState("empty", `No places found for “${text}”. Try a broader search.`);
        return;
      }

      renderItems();
      if (shouldSelectFirst) select(items[0]);
    } catch (error) {
      if (activeRequest !== requestId) return;
      items = [];
      const timedOut = error?.name === "AbortError";
      renderState(
        "error",
        timedOut
          ? "Place search took too long. Check your connection and try again."
          : "Place suggestions are unavailable right now.",
        { retry: () => executeSearch(currentQuery) },
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (activeRequest === requestId) {
        input.setAttribute("aria-busy", "false");
        requestController = null;
      }
    }
  };

  const onInput = () => {
    window.clearTimeout(debounceTimer);
    requestId += 1;
    requestController?.abort();
    requestController = null;
    items = [];
    clearHighlight();
    currentQuery = input.value;

    if (!currentQuery.trim()) {
      close();
      return;
    }

    if (!parseCoordinates(currentQuery) && currentQuery.trim().length < minChars) {
      close();
      return;
    }

    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    debounceTimer = window.setTimeout(
      () => executeSearch(currentQuery),
      debounceMs,
    );
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlight(highlightedIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      highlight(highlightedIndex < 0 ? items.length - 1 : highlightedIndex - 1);
      return;
    }

    if (event.key === "Home" && items.length) {
      event.preventDefault();
      highlight(0);
      return;
    }

    if (event.key === "End" && items.length) {
      event.preventDefault();
      highlight(items.length - 1);
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0 && items[highlightedIndex]) {
      event.preventDefault();
      select(items[highlightedIndex]);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    window.clearTimeout(debounceTimer);

    if (items[highlightedIndex]) {
      select(items[highlightedIndex]);
    } else if (items.length) {
      select(items[0]);
    } else {
      executeSearch(input.value, true);
    }
  };

  const onDocumentPointerDown = (event) => {
    if (!form.contains(event.target) && !results.contains(event.target)) close();
  };

  const onFocus = () => {
    if (items.length && results.hidden) renderItems();
  };

  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("focus", onFocus);
  form.addEventListener("submit", onSubmit);
  document.addEventListener("pointerdown", onDocumentPointerDown);

  return {
    close,
    destroy() {
      close();
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKeyDown);
      input.removeEventListener("focus", onFocus);
      form.removeEventListener("submit", onSubmit);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      announcement.remove();
    },
  };
}

export function normalizeSearchPlace(place = {}) {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  return {
    id: place.id ?? null,
    name: cleanText(place.name, 80) || cleanText(place.locality, 80) || "Pinned location",
    admin1: cleanText(place.admin1, 80),
    country: cleanText(place.country, 80),
    countryCode: cleanText(place.countryCode || place.country_code, 3).toUpperCase(),
    timezone: cleanText(place.timezone, 80),
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
  };
}

export function formatPlaceLabel(place) {
  return [
    cleanText(place?.name, 80),
    cleanText(place?.admin1, 80),
    cleanText(place?.country, 80),
  ]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
}

export function formatPlaceRegion(place) {
  const name = cleanText(place?.name, 80);
  return (
    [
      cleanText(place?.admin1, 80),
      cleanText(place?.country, 80),
    ].filter(
      (part, index, parts) =>
        part && part !== name && parts.indexOf(part) === index,
    ).join(", ") || formatCoordinates(place)
  );
}

export function parseCoordinates(value) {
  const match = String(value || "")
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*(?:,|\s)\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null;
}

export function countryFlag(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code].map((character) => 127397 + character.charCodeAt(0)),
  );
}

function formatCoordinates(place) {
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return "Coordinates unavailable";
  }
  return `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
}

function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
