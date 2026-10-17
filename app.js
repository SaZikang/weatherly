import { APP_CONFIG } from "./config.js";

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_QUALITY_API = "https://air-quality-api.open-meteo.com/v1/air-quality";
const REVERSE_GEOCODING_API = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const STORAGE_KEYS = {
  favorites: "codex-deepseek:favorites",
  unit: "codex-deepseek:unit",
};
const TILE_SIZE = 256;
const MAX_FAVORITES = 8;
const REQUEST_TIMEOUT = 15_000;

const CONDITIONS = {
  0: { label: "Clear sky", kind: "clear" },
  1: { label: "Mainly clear", kind: "partly" },
  2: { label: "Partly cloudy", kind: "partly" },
  3: { label: "Overcast", kind: "cloudy" },
  45: { label: "Foggy", kind: "fog" },
  48: { label: "Rime fog", kind: "fog" },
  51: { label: "Light drizzle", kind: "drizzle" },
  53: { label: "Drizzle", kind: "drizzle" },
  55: { label: "Heavy drizzle", kind: "drizzle" },
  56: { label: "Freezing drizzle", kind: "drizzle" },
  57: { label: "Heavy freezing drizzle", kind: "drizzle" },
  61: { label: "Light rain", kind: "rain" },
  63: { label: "Rain", kind: "rain" },
  65: { label: "Heavy rain", kind: "rain" },
  66: { label: "Freezing rain", kind: "rain" },
  67: { label: "Heavy freezing rain", kind: "rain" },
  71: { label: "Light snow", kind: "snow" },
  73: { label: "Snow", kind: "snow" },
  75: { label: "Heavy snow", kind: "snow" },
  77: { label: "Snow grains", kind: "snow" },
  80: { label: "Light showers", kind: "rain" },
  81: { label: "Rain showers", kind: "rain" },
  82: { label: "Heavy showers", kind: "rain" },
  85: { label: "Snow showers", kind: "snow" },
  86: { label: "Heavy snow showers", kind: "snow" },
  95: { label: "Thunderstorm", kind: "thunder" },
  96: { label: "Thunderstorm with hail", kind: "thunder" },
  99: { label: "Severe thunderstorm", kind: "thunder" },
};

const COMPASS_POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  searchForm: $("#searchForm"),
  searchInput: $("#searchInput"),
  searchResults: $("#searchResults"),
  locateButton: $("#locateButton"),
  refreshButton: $("#refreshButton"),
  githubLink: $("#githubLink"),
  footerGithubLink: $("#footerGithubLink"),
  unitButtons: $$("[data-unit]"),
  favoritesList: $("#favoritesList"),
  favoriteButton: $("#favoriteButton"),
  statusBanner: $("#statusBanner"),
  statusMessage: $("#statusMessage"),
  statusRetry: $("#statusRetry"),
  nowCard: $("#nowCard"),
  liveDot: $("#liveDot"),
  liveStatus: $("#liveStatus"),
  locationName: $("#locationName"),
  locationRegion: $("#locationRegion"),
  localDate: $("#localDate"),
  conditionLabel: $("#conditionLabel"),
  currentTemp: $("#currentTemp"),
  temperatureUnit: $("#temperatureUnit"),
  feelsLike: $("#feelsLike"),
  highLow: $("#highLow"),
  heroArt: $("#heroArt"),
  weatherNarrative: $("#weatherNarrative"),
  airQuality: $("#airQuality"),
  airQualityText: $("#airQualityText"),
  humidityValue: $("#humidityValue"),
  windValue: $("#windValue"),
  rainValue: $("#rainValue"),
  uvValue: $("#uvValue"),
  pressureValue: $("#pressureValue"),
  visibilityValue: $("#visibilityValue"),
  updatedTime: $("#updatedTime"),
  mapSearchForm: $("#mapSearchForm"),
  mapSearchInput: $("#mapSearchInput"),
  mapSearchResults: $("#mapSearchResults"),
  weatherMap: $("#weatherMap"),
  mapTiles: $("#mapTiles"),
  mapLoading: $("#mapLoading"),
  mapOffline: $("#mapOffline"),
  mapPlaceName: $("#mapPlaceName"),
  mapCoordinates: $("#mapCoordinates"),
  mapViewWeather: $("#mapViewWeather"),
  mapUseLocation: $("#mapUseLocation"),
  mapPinPlace: $("#mapPinPlace"),
  mapZoomIn: $("#mapZoomIn"),
  mapZoomOut: $("#mapZoomOut"),
  mapRecenter: $("#mapRecenter"),
  hourlyDate: $("#hourlyDate"),
  hourlyList: $("#hourlyList"),
  dailyList: $("#dailyList"),
  sunNote: $("#sunNote"),
  toastRegion: $("#toastRegion"),
  screenReaderStatus: $("#screenReaderStatus"),
};

const state = {
  location: { ...APP_CONFIG.defaultLocation },
  weather: null,
  airQuality: null,
  favorites: loadFavorites(),
  unit: loadUnit(),
  isLoading: false,
  loadFailed: false,
  lastUpdated: null,
  weatherController: null,
  weatherRequestId: 0,
  mapSettleTimer: null,
  mapSettleController: null,
  mapSettleRequestId: 0,
  mapDraft: null,
  map: {
    latitude: APP_CONFIG.defaultLocation.latitude,
    longitude: APP_CONFIG.defaultLocation.longitude,
    zoom: APP_CONFIG.map.zoom,
    stage: null,
    drag: null,
    tileFailures: 0,
    tileSuccesses: 0,
  },
};

init();

function init() {
  elements.githubLink.href = APP_CONFIG.repositoryUrl;
  elements.footerGithubLink.href = APP_CONFIG.repositoryUrl;

  const initialLocation = readLocationFromUrl() || { ...APP_CONFIG.defaultLocation };
  state.location = initialLocation;
  state.mapDraft = { ...initialLocation };
  state.map.latitude = initialLocation.latitude;
  state.map.longitude = initialLocation.longitude;

  setupSearch({
    input: elements.searchInput,
    results: elements.searchResults,
    form: elements.searchForm,
    onSelect: (place) => goToPlace(place),
  });

  setupSearch({
    input: elements.mapSearchInput,
    results: elements.mapSearchResults,
    form: elements.mapSearchForm,
    onSelect: (place) => goToPlace(place, { fromMap: true }),
  });

  setupMap();
  setupInteractions();
  renderFavorites();
  renderUnits();
  renderLocationChrome();
  updateFavoriteControls();
  renderMapLabels();
  updateClockAndFreshness();
  loadWeather(state.location, { updateUrl: true });

  window.setInterval(updateClockAndFreshness, 30_000);
  window.setInterval(() => {
    if (document.visibilityState === "visible") {
      loadWeather(state.location, { updateUrl: false, silentRefresh: true });
    }
  }, APP_CONFIG.refreshIntervalMs);
}

function setupInteractions() {
  elements.favoriteButton.addEventListener("click", () => {
    toggleFavorite(state.location);
  });

  elements.locateButton.addEventListener("click", () => locateUser());
  elements.mapUseLocation.addEventListener("click", () => locateUser());
  elements.refreshButton.addEventListener("click", () => {
    loadWeather(state.location, { updateUrl: false });
  });
  elements.statusRetry.addEventListener("click", () => {
    loadWeather(state.location, { updateUrl: false });
  });

  elements.unitButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextUnit = button.dataset.unit;
      if (nextUnit === state.unit) return;
      state.unit = nextUnit;
      saveUnit(nextUnit);
      renderUnits();
      if (state.weather) {
        renderWeather();
      } else {
        elements.temperatureUnit.textContent = state.unit === "fahrenheit" ? "°F" : "°C";
      }
    });
  });

  elements.mapViewWeather.addEventListener("click", () => {
    cancelMapSettle();
    settleMapLocation({ immediate: true });
  });
  elements.mapPinPlace.addEventListener("click", pinMapLocation);
  elements.mapZoomIn.addEventListener("click", () => changeMapZoom(1));
  elements.mapZoomOut.addEventListener("click", () => changeMapZoom(-1));
  elements.mapRecenter.addEventListener("click", recenterMapOnLocation);

  window.addEventListener("online", () => {
    renderLiveStatus();
    hideStatus();
    showToast("Back online. Refreshing live weather.");
    loadWeather(state.location, { updateUrl: false });
  });

  window.addEventListener("offline", () => {
    renderLiveStatus();
    showStatus("You appear to be offline. The last successful forecast will stay on screen.");
  });

  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      state.lastUpdated &&
      Date.now() - state.lastUpdated.getTime() > APP_CONFIG.refreshIntervalMs
    ) {
      loadWeather(state.location, { updateUrl: false, silentRefresh: true });
    }
  });
}

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter(
        (place) =>
          place &&
          Number.isFinite(Number(place.latitude)) &&
          Number.isFinite(Number(place.longitude)) &&
          typeof place.name === "string",
      )
      .slice(0, MAX_FAVORITES)
      .map(normalizePlace);
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites));
  } catch {
    showToast("Favorites could not be saved in this browser.", "error");
  }
}

function loadUnit() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.unit);
    return saved === "fahrenheit" ? "fahrenheit" : "celsius";
  } catch {
    return "celsius";
  }
}

function saveUnit(unit) {
  try {
    localStorage.setItem(STORAGE_KEYS.unit, unit);
  } catch {
    // The preference still works for this tab if storage is unavailable.
  }
}

function renderUnits() {
  elements.unitButtons.forEach((button) => {
    const active = button.dataset.unit === state.unit;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.temperatureUnit.textContent = state.unit === "fahrenheit" ? "°F" : "°C";
}

function readLocationFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const latitude = Number(params.get("lat"));
    const longitude = Number(params.get("lon"));
    if (!isValidCoordinate(latitude, longitude)) return null;
    return normalizePlace({
      name: cleanText(params.get("name"), 80) || "Pinned location",
      admin1: cleanText(params.get("region"), 80),
      country: cleanText(params.get("country"), 80),
      latitude,
      longitude,
    });
  } catch {
    return null;
  }
}

function updateLocationUrl(location) {
  if (!["http:", "https:"].includes(window.location.protocol)) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("lat", location.latitude.toFixed(5));
    url.searchParams.set("lon", location.longitude.toFixed(5));
    url.searchParams.set("name", location.name);
    if (location.admin1) url.searchParams.set("region", location.admin1);
    else url.searchParams.delete("region");
    if (location.country) url.searchParams.set("country", location.country);
    else url.searchParams.delete("country");
    window.history.replaceState(null, "", url);
  } catch {
    // Deep-linking is a convenience; the app still works without it.
  }
}

async function loadWeather(location, options = {}) {
  const place = normalizePlace(location);
  if (!isValidCoordinate(place.latitude, place.longitude)) return;

  const requestId = ++state.weatherRequestId;
  state.weatherController?.abort();
  const controller = new AbortController();
  state.weatherController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  state.location = place;
  state.loadFailed = false;
  renderLocationChrome();
  updateFavoriteControls();
  setLoading(true);
  if (!options.silentRefresh) hideStatus();

  if (!options.keepMap) {
    const distance = Math.abs(place.latitude - state.map.latitude) + Math.abs(place.longitude - state.map.longitude);
    if (distance > 0.01) {
      moveMapTo(place, { zoom: Math.max(state.map.zoom, 11) });
    } else {
      state.mapDraft = { ...place };
      renderMapLabels();
    }
  }

  const weatherUrl = buildWeatherUrl(place);
  const airQualityUrl = buildAirQualityUrl(place);

  try {
    const [weatherResult, airResult] = await Promise.allSettled([
      fetchJson(weatherUrl, controller.signal),
      fetchJson(airQualityUrl, controller.signal),
    ]);

    if (requestId !== state.weatherRequestId) return;
    if (weatherResult.status === "rejected") throw weatherResult.reason;

    state.weather = weatherResult.value;
    state.airQuality = airResult.status === "fulfilled" ? airResult.value : null;
    state.loadFailed = false;
    state.lastUpdated = new Date();
    state.location = {
      ...place,
      latitude: Number(state.weather.latitude) || place.latitude,
      longitude: Number(state.weather.longitude) || place.longitude,
    };
    state.mapDraft = { ...state.location };

    renderWeather();
    renderMapLabels();
    updateFavoriteControls();
    hideStatus();

    if (options.updateUrl !== false) {
      updateLocationUrl(state.location);
    }
  } catch (error) {
    if (requestId !== state.weatherRequestId) return;
    if (error?.name === "AbortError" && requestId !== state.weatherRequestId) return;

    state.loadFailed = true;
    const fallbackMessage = navigator.onLine
      ? "Live weather could not be reached. Check your connection, then try again."
      : "You appear to be offline. Reconnect to load live weather.";
    showStatus(
      state.weather
        ? `Could not refresh this forecast. Showing the last successful update. ${fallbackMessage}`
        : fallbackMessage,
    );
    if (!options.silentRefresh) {
      showToast("Weather service unavailable. Please try again.", "error");
    }
  } finally {
    window.clearTimeout(timeoutId);
    if (requestId === state.weatherRequestId) {
      setLoading(false);
      updateClockAndFreshness();
    }
  }
}

function buildWeatherUrl(place) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "7",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });
  return `${WEATHER_API}?${params}`;
}

function buildAirQualityUrl(place) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "us_aqi,pm2_5,european_aqi",
    timezone: "auto",
  });
  return `${AIR_QUALITY_API}?${params}`;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  elements.refreshButton.classList.toggle("is-loading", isLoading);
  elements.refreshButton.disabled = isLoading;
  elements.nowCard.setAttribute("aria-busy", String(isLoading));
  if (isLoading) {
    elements.liveStatus.textContent = "Updating live weather";
    elements.liveDot.classList.remove("is-offline");
  } else {
    renderLiveStatus();
  }
}

function renderLiveStatus() {
  if (!navigator.onLine) {
    elements.liveStatus.textContent = state.weather ? "Offline · last known conditions" : "Offline";
    elements.liveDot.classList.add("is-offline");
    return;
  }
  elements.liveDot.classList.remove("is-offline");
  if (state.isLoading) {
    elements.liveStatus.textContent = "Updating live weather";
  } else if (state.weather && state.loadFailed) {
    elements.liveStatus.textContent = "Refresh failed · last known conditions";
  } else if (state.weather) {
    const zone = state.weather.timezone_abbreviation || state.weather.timezone || "local";
    elements.liveStatus.textContent = `Live conditions · ${zone}`;
  } else if (state.loadFailed) {
    elements.liveStatus.textContent = "Live data unavailable";
  } else {
    elements.liveStatus.textContent = "Connecting to live weather";
  }
}

function renderLocationChrome() {
  const location = state.location;
  elements.locationName.textContent = location.name || "Pinned location";
  const region = [location.admin1, location.country].filter(Boolean).join(", ");
  elements.locationRegion.textContent = region || formatCoordinatesShort(location);
  elements.nowCard.dataset.location = locationKey(location);
  renderFavorites();
}

function renderWeather() {
  const weather = state.weather;
  if (!weather?.current || !weather?.daily) return;

  const current = weather.current;
  const today = weather.daily;
  const code = Number(current.weather_code);
  const info = conditionFor(code);
  const isDay = Number(current.is_day) !== 0;
  const hourly = getHourlyWindow(weather);
  const currentHour = hourly[0];
  const rainChance =
    currentHour?.precipitationProbability ?? today.precipitation_probability_max?.[0] ?? 0;

  applyWeatherTheme(info.kind, isDay);
  elements.heroArt.innerHTML = weatherArt(info.kind, isDay);
  elements.conditionLabel.textContent = info.label;
  elements.currentTemp.textContent = temperatureNumber(current.temperature_2m);
  elements.temperatureUnit.textContent = state.unit === "fahrenheit" ? "°F" : "°C";
  elements.feelsLike.textContent = temperatureText(current.apparent_temperature);
  elements.highLow.textContent = `H ${temperatureText(today.temperature_2m_max?.[0])}  L ${temperatureText(
    today.temperature_2m_min?.[0],
  )}`;
  elements.humidityValue.textContent = Number.isFinite(Number(current.relative_humidity_2m))
    ? `${Math.round(Number(current.relative_humidity_2m))}%`
    : "--%";

  const windDirection = Number(current.wind_direction_10m);
  const compass = windDirectionToCompass(windDirection);
  elements.windValue.textContent = Number.isFinite(Number(current.wind_speed_10m))
    ? `${round(current.wind_speed_10m)} km/h ${compass}`
    : "-- km/h";
  elements.windValue.title = Number.isFinite(Number(current.wind_gusts_10m))
    ? `Gusts up to ${round(current.wind_gusts_10m)} km/h`
    : "";
  elements.rainValue.textContent = Number.isFinite(Number(rainChance))
    ? `${Math.round(Number(rainChance))}%`
    : "--%";
  elements.uvValue.textContent = Number.isFinite(Number(today.uv_index_max?.[0]))
    ? Number(today.uv_index_max[0]).toFixed(1)
    : "--";
  elements.pressureValue.textContent = Number.isFinite(Number(current.surface_pressure))
    ? `${Math.round(Number(current.surface_pressure))} hPa`
    : "-- hPa";
  elements.visibilityValue.textContent = Number.isFinite(Number(current.visibility))
    ? `${(Number(current.visibility) / 1000).toFixed(1)} km`
    : "-- km";

  elements.weatherNarrative.textContent = buildNarrative(info, current, today, state.location);
  elements.hourlyDate.textContent = formatFullDate(today.time?.[0]);
  elements.sunNote.textContent = `Sunrise ${formatClockTime(today.sunrise?.[0])} · Sunset ${formatClockTime(
    today.sunset?.[0],
  )}`;
  elements.updatedTime.textContent = "Updated just now";
  renderAirQuality();
  renderHourly(hourly);
  renderDaily();
  updateClockAndFreshness();
  renderLiveStatus();
  updateFavoriteControls();

  document.title = `${temperatureText(current.temperature_2m)} ${info.label} · ${state.location.name}`;
}

function renderAirQuality() {
  const aqi = Number(state.airQuality?.current?.us_aqi);
  if (!Number.isFinite(aqi)) {
    elements.airQuality.hidden = true;
    return;
  }

  const category = aqiCategory(aqi);
  const dot = $(".aqi-dot", elements.airQuality);
  dot.classList.toggle("moderate", category.level === "moderate");
  dot.classList.toggle("unhealthy", category.level === "unhealthy");
  elements.airQualityText.textContent = `${Math.round(aqi)} AQI · ${category.label}`;
  const pm25 = Number(state.airQuality?.current?.pm2_5);
  elements.airQuality.title = Number.isFinite(pm25)
    ? `US AQI ${Math.round(aqi)}. PM2.5 ${pm25.toFixed(1)} µg/m³.`
    : `US AQI ${Math.round(aqi)}`;
  elements.airQuality.hidden = false;
}

function renderHourly(hourly) {
  if (!hourly.length) {
    elements.hourlyList.innerHTML =
      '<p class="search-message">Hourly data is not available for this location.</p>';
    return;
  }

  elements.hourlyList.innerHTML = hourly
    .map((hour, index) => {
      const info = conditionFor(hour.weatherCode);
      const chance = Number(hour.precipitationProbability);
      return `
        <article class="hourly-item${index === 0 ? " is-now" : ""}" role="listitem" title="${info.label}">
          <span class="hourly-time">${index === 0 ? "Now" : formatHour(hour.time)}</span>
          <div class="hourly-icon">${weatherArt(info.kind, hour.isDay)}</div>
          <strong class="hourly-temp">${temperatureText(hour.temperature)}</strong>
          <span class="hourly-meta">
            ${
              Number.isFinite(chance) && chance > 0
                ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s5 5.3 5 10a5 5 0 0 1-10 0c0-4.7 5-10 5-10Z"></path></svg>${Math.round(
                    chance,
                  )}%`
                : "&nbsp;"
            }
          </span>
        </article>
      `;
    })
    .join("");
}

function renderDaily() {
  const daily = state.weather?.daily;
  if (
    !daily?.time?.length ||
    !Array.isArray(daily.temperature_2m_min) ||
    !Array.isArray(daily.temperature_2m_max) ||
    !Array.isArray(daily.weather_code)
  ) {
    elements.dailyList.innerHTML =
      '<p class="search-message">Daily data is not available for this location.</p>';
    return;
  }

  const lows = daily.temperature_2m_min.map(Number).filter(Number.isFinite);
  const highs = daily.temperature_2m_max.map(Number).filter(Number.isFinite);
  const weekMin = Math.min(...lows);
  const weekMax = Math.max(...highs);
  const spread = Math.max(weekMax - weekMin, 1);

  elements.dailyList.innerHTML = daily.time
    .map((date, index) => {
      const code = Number(daily.weather_code[index]);
      const info = conditionFor(code);
      const low = Number(daily.temperature_2m_min[index]);
      const high = Number(daily.temperature_2m_max[index]);
      const chance = Number(daily.precipitation_probability_max[index]);
      const left = Math.max(0, Math.min(100, ((low - weekMin) / spread) * 100));
      const width = Math.max(5, Math.min(100 - left, ((high - low) / spread) * 100));
      const dayLabel = index === 0 ? "Today" : formatWeekday(date);
      const dateLabel = formatShortDate(date);

      return `
        <div class="daily-row" title="${info.label}, ${formatRange(low, high)}">
          <div class="daily-day">
            <strong>${dayLabel}</strong>
            <span>${dateLabel}</span>
          </div>
          <div class="daily-weather">
            <div class="daily-icon">${weatherArt(info.kind, true)}</div>
            <span>${info.label}</span>
          </div>
          <div class="daily-range" aria-label="Low ${temperatureText(low)}, high ${temperatureText(high)}">
            <span>${temperatureText(low)}</span>
            <span class="range-track"><i style="left:${left}%;width:${width}%"></i></span>
            <strong>${temperatureText(high)}</strong>
          </div>
          <span class="daily-pop" title="Chance of precipitation">
            ${Number.isFinite(chance) && chance > 0 ? `${Math.round(chance)}%` : "—"}
          </span>
        </div>
      `;
    })
    .join("");
}

function getHourlyWindow(weather) {
  const hourly = weather?.hourly;
  const currentTime = weather?.current?.time;
  if (!hourly?.time?.length) return [];

  let startIndex = hourly.time.findIndex((time) => time.slice(0, 13) === currentTime?.slice(0, 13));
  if (startIndex < 0) {
    startIndex = hourly.time.findIndex((time) => time >= currentTime);
  }
  if (startIndex < 0) startIndex = 0;

  return hourly.time.slice(startIndex, startIndex + 24).map((time, offset) => {
    const index = startIndex + offset;
    return {
      time,
      temperature: hourly.temperature_2m?.[index],
      weatherCode: hourly.weather_code?.[index],
      precipitationProbability: hourly.precipitation_probability?.[index],
      isDay: Number(hourly.is_day?.[index]) !== 0,
    };
  });
}

function applyWeatherTheme(kind, isDay) {
  const theme =
    kind === "clear"
      ? isDay
        ? "sky-clear-day"
        : "sky-clear-night"
      : kind === "partly" || kind === "cloudy"
        ? isDay
          ? "sky-cloudy-day"
          : "sky-cloudy-night"
        : kind === "fog"
          ? "sky-fog"
          : kind === "snow"
            ? "sky-snow"
            : kind === "thunder"
              ? "sky-storm"
              : "sky-rain";

  [...elements.nowCard.classList]
    .filter((name) => name.startsWith("sky-"))
    .forEach((name) => elements.nowCard.classList.remove(name));
  elements.nowCard.classList.add(theme);
}

function conditionFor(code) {
  return CONDITIONS[Number(code)] || { label: "Mixed skies", kind: "cloudy" };
}

function buildNarrative(info, current, daily, location) {
  const rainChance = Number(daily.precipitation_probability_max?.[0]);
  const humidity = Number(current.relative_humidity_2m);
  const temperature = Number(current.temperature_2m);
  const wind = Number(current.wind_speed_10m);
  const direction = windDirectionToCompass(Number(current.wind_direction_10m));

  if (info.kind === "thunder") {
    return "Thunderstorms are in the area. Keep an eye on the sky and plan indoor cover.";
  }
  if (info.kind === "rain" || info.kind === "drizzle") {
    return "Wet weather is happening now. A waterproof layer will earn its place today.";
  }
  if (info.kind === "snow") {
    return "Snow is falling nearby. Expect slippery surfaces and bundle up.";
  }
  if (info.kind === "fog") {
    return "Visibility is reduced. Take it slowly if you are heading out.";
  }
  if (Number.isFinite(rainChance) && rainChance >= 60) {
    return `A ${Math.round(rainChance)}% chance of rain today, so keep an umbrella close.`;
  }
  if (Number.isFinite(temperature) && temperature >= 30 && humidity >= 70) {
    return `Warm and humid in ${location.name}, with a ${direction} breeze at ${round(wind)} km/h.`;
  }
  if (Number.isFinite(temperature) && temperature <= 8) {
    return `A crisp ${temperatureText(temperature)} in ${location.name}. Layer up before heading out.`;
  }
  if (info.kind === "clear") {
    return `Clear skies over ${location.name}, with a gentle ${direction} breeze.`;
  }
  return `${info.label} over ${location.name}, with a high of ${temperatureText(
    daily.temperature_2m_max?.[0],
  )} today.`;
}

function updateClockAndFreshness() {
  const timezone = state.weather?.timezone;
  elements.localDate.textContent = timezone ? formatLocalClock(timezone) : "Local time";

  if (!state.lastUpdated) {
    elements.updatedTime.textContent = state.isLoading
      ? "Requesting the latest conditions"
      : "Waiting for the first update";
    return;
  }

  const age = Date.now() - state.lastUpdated.getTime();
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) {
    elements.updatedTime.textContent = "Updated just now";
  } else if (minutes === 1) {
    elements.updatedTime.textContent = "Updated 1 min ago";
  } else if (minutes < 60) {
    elements.updatedTime.textContent = `Updated ${minutes} min ago`;
  } else {
    const hours = Math.floor(minutes / 60);
    elements.updatedTime.textContent = `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
}

function renderFavorites() {
  const list = elements.favoritesList;
  list.replaceChildren();

  if (!state.favorites.length) {
    const empty = document.createElement("span");
    empty.className = "favorites-empty";
    empty.textContent = "Star a location to keep it at the top.";
    list.append(empty);
    return;
  }

  const activeKey = locationKey(state.location);
  state.favorites.forEach((place) => {
    const chip = document.createElement("div");
    chip.className = `favorite-chip${locationKey(place) === activeKey ? " is-active" : ""}`;

    const loadButton = document.createElement("button");
    loadButton.className = "favorite-chip-load";
    loadButton.type = "button";
    loadButton.dataset.favoriteKey = locationKey(place);
    loadButton.textContent = place.name;
    loadButton.title = `Show weather for ${placeLabel(place)}`;
    loadButton.addEventListener("click", () => {
      goToPlace(place);
    });

    const removeButton = document.createElement("button");
    removeButton.className = "favorite-chip-remove";
    removeButton.type = "button";
    removeButton.dataset.removeFavorite = locationKey(place);
    removeButton.setAttribute("aria-label", `Remove ${place.name} from pinned places`);
    removeButton.title = "Remove pin";
    removeButton.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"></path></svg>';
    removeButton.addEventListener("click", () => {
      removeFavorite(place);
    });

    chip.append(loadButton, removeButton);
    list.append(chip);
  });
}

function toggleFavorite(place) {
  const normalized = normalizePlace(place);
  const existingIndex = state.favorites.findIndex(
    (favorite) => locationKey(favorite) === locationKey(normalized),
  );

  if (existingIndex >= 0) {
    state.favorites.splice(existingIndex, 1);
    saveFavorites();
    renderFavorites();
    updateFavoriteControls();
    showToast(`${normalized.name} removed from pinned places.`);
    return;
  }

  if (state.favorites.length >= MAX_FAVORITES) {
    showToast(`You can pin up to ${MAX_FAVORITES} places. Remove one to add another.`, "error");
    return;
  }

  state.favorites.push(normalized);
  saveFavorites();
  renderFavorites();
  updateFavoriteControls();
  showToast(`${normalized.name} pinned to the top.`);
}

function removeFavorite(place) {
  state.favorites = state.favorites.filter(
    (favorite) => locationKey(favorite) !== locationKey(place),
  );
  saveFavorites();
  renderFavorites();
  updateFavoriteControls();
  showToast(`${place.name} removed from pinned places.`);
}

function updateFavoriteControls() {
  const favorite = isFavorite(state.location);
  elements.favoriteButton.setAttribute("aria-pressed", String(favorite));
  elements.favoriteButton.setAttribute(
    "aria-label",
    favorite ? "Remove this location from pinned places" : "Pin this location",
  );
  elements.favoriteButton.title = favorite ? "Remove pin" : "Pin this location";

  const draft = getMapDraft();
  const draftFavorite = isFavorite(draft);
  elements.mapPinPlace.innerHTML = draftFavorite
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"></path></svg>Unpin place'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"></path></svg>Pin place';
  elements.mapPinPlace.setAttribute(
    "aria-label",
    draftFavorite ? "Remove the map location from pinned places" : "Pin the map location",
  );
}

function isFavorite(place) {
  const key = locationKey(place);
  return state.favorites.some((favorite) => locationKey(favorite) === key);
}

function goToPlace(place, options = {}) {
  const normalized = normalizePlace(place);
  cancelMapSettle();
  if (options.fromMap) {
    moveMapTo(normalized, { zoom: Math.max(12, state.map.zoom) });
  }
  loadWeather(normalized, {
    keepMap: Boolean(options.fromMap),
    updateUrl: true,
  });
}

async function locateUser(options = {}) {
  if (!navigator.geolocation) {
    showToast("This browser does not support location access.", "error");
    return;
  }

  elements.locateButton.disabled = true;
  elements.locateButton.setAttribute("aria-busy", "true");
  if (!options.automatic) showToast("Finding your location…");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      elements.locateButton.disabled = false;
      elements.locateButton.removeAttribute("aria-busy");
      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      const fallback = {
        name: "Current location",
        latitude,
        longitude,
      };

      moveMapTo(fallback, { zoom: 13 });
      showMapLoading(true, "Locating your area…");
      try {
        const place = await reverseGeocode(latitude, longitude);
        if (!options.automatic) showToast("Location found. Loading local weather.");
        goToPlace(place, { fromMap: true });
      } catch {
        goToPlace(fallback, { fromMap: true });
      } finally {
        showMapLoading(false);
      }
    },
    (error) => {
      elements.locateButton.disabled = false;
      elements.locateButton.removeAttribute("aria-busy");
      const message =
        error.code === error.PERMISSION_DENIED
          ? "Location access was blocked. You can search for a city instead."
          : error.code === error.TIMEOUT
            ? "Your location took too long to find. Try searching for a city."
            : "Your location could not be found right now.";
      if (!options.automatic) showToast(message, "error");
    },
    {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 5 * 60_000,
    },
  );
}

function setupSearch({ input, results, form, onSelect }) {
  let debounceTimer = null;
  let searchController = null;
  let searchRequestId = 0;
  let items = [];
  let highlightedIndex = -1;

  const close = () => {
    results.hidden = true;
    results.replaceChildren();
    highlightedIndex = -1;
    input.setAttribute("aria-expanded", "false");
  };

  const highlight = (index) => {
    const buttons = $$(".search-result", results);
    if (!buttons.length) return;
    highlightedIndex = (index + buttons.length) % buttons.length;
    buttons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === highlightedIndex;
      button.classList.toggle("is-highlighted", selected);
      button.setAttribute("aria-selected", String(selected));
      if (selected) button.scrollIntoView({ block: "nearest" });
    });
  };

  const select = (place) => {
    input.value = "";
    close();
    onSelect(place);
  };

  const renderItems = () => {
    results.replaceChildren();
    if (!items.length) {
      const message = document.createElement("p");
      message.className = "search-message";
      message.textContent = "No matching places found. Try a broader search.";
      results.append(message);
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
      return;
    }

    items.forEach((place, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");

      const icon = document.createElement("span");
      icon.className = "search-result-icon";
      icon.textContent = countryFlag(place.countryCode) || "◎";

      const copy = document.createElement("span");
      copy.className = "search-result-copy";
      const name = document.createElement("strong");
      name.textContent = place.name;
      const detail = document.createElement("span");
      detail.textContent = placeLabel(place);
      copy.append(name, detail);

      const arrow = document.createElement("span");
      arrow.className = "search-result-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↗";

      button.append(icon, copy, arrow);
      button.addEventListener("mouseenter", () => highlight(index));
      button.addEventListener("click", () => select(place));
      results.append(button);
    });

    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    highlightedIndex = -1;
  };

  const executeSearch = async (query, shouldSelectFirst = false) => {
    const text = query.trim();
    if (!text) {
      close();
      return;
    }

    const coordinates = parseCoordinates(text);
    if (coordinates) {
      items = [
        normalizePlace({
          name: "Dropped pin",
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        }),
      ];
      renderItems();
      if (shouldSelectFirst) select(items[0]);
      return;
    }

    if (text.length < 2) {
      close();
      return;
    }

    const requestId = ++searchRequestId;
    items = [];
    highlightedIndex = -1;
    searchController?.abort();
    searchController = new AbortController();
    const timeoutId = window.setTimeout(() => searchController.abort(), 10_000);
    results.hidden = false;
    results.innerHTML = '<p class="search-message">Searching places…</p>';
    input.setAttribute("aria-expanded", "true");

    try {
      const params = new URLSearchParams({
        name: text,
        count: "6",
        language: "en",
        format: "json",
      });
      const response = await fetch(`${GEOCODING_API}?${params}`, {
        signal: searchController.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Geocoding failed");
      const data = await response.json();
      if (requestId !== searchRequestId) return;
      items = Array.isArray(data.results) ? data.results.map(normalizePlace) : [];
      renderItems();
      if (shouldSelectFirst && items[0]) select(items[0]);
    } catch (error) {
      if (requestId !== searchRequestId || error?.name === "AbortError") return;
      items = [];
      results.innerHTML =
        '<p class="search-message">Place search is unavailable right now. Check your connection.</p>';
      results.hidden = false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  input.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    items = [];
    highlightedIndex = -1;
    const query = input.value;
    if (query.trim().length < 2 && !parseCoordinates(query)) {
      close();
      return;
    }
    debounceTimer = window.setTimeout(() => executeSearch(query), 300);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
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
      highlight(highlightedIndex - 1);
      return;
    }
    if (event.key === "Enter" && highlightedIndex >= 0 && items[highlightedIndex]) {
      event.preventDefault();
      select(items[highlightedIndex]);
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(debounceTimer);
    if (items[highlightedIndex]) {
      select(items[highlightedIndex]);
    } else {
      executeSearch(input.value, true);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!form.contains(event.target)) close();
  });
}

function setupMap() {
  const map = elements.weatherMap;

  map.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, a")) return;
    state.map.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLatitude: state.map.latitude,
      startLongitude: state.map.longitude,
      stageLeft: state.map.stage ? Number.parseFloat(state.map.stage.style.left) || 0 : 0,
      stageTop: state.map.stage ? Number.parseFloat(state.map.stage.style.top) || 0 : 0,
      moved: false,
    };
    state.mapDraft = null;
    map.setPointerCapture?.(event.pointerId);
    map.classList.add("is-dragging");
  });

  map.addEventListener("pointermove", (event) => {
    const drag = state.map.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) drag.moved = true;
    if (!drag.moved) return;

    event.preventDefault();
    if (state.map.stage) {
      state.map.stage.style.left = `${drag.stageLeft + deltaX}px`;
      state.map.stage.style.top = `${drag.stageTop + deltaY}px`;
    }

    const zoom = state.map.zoom;
    const centerX = longitudeToWorldX(drag.startLongitude, zoom) - deltaX;
    const centerY = latitudeToWorldY(drag.startLatitude, zoom) - deltaY;
    state.map.latitude = worldYToLatitude(centerY, zoom);
    state.map.longitude = worldXToLongitude(centerX, zoom);
    updateMapCoordinateLabel();
  });

  map.addEventListener("pointerup", (event) => {
    const drag = state.map.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    map.classList.remove("is-dragging");
    map.releasePointerCapture?.(event.pointerId);
    state.map.drag = null;

    if (drag.moved) {
      buildMapTiles();
      scheduleMapSettle();
      return;
    }

    const rect = map.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    const zoom = state.map.zoom;
    const centerX = longitudeToWorldX(state.map.longitude, zoom) + offsetX;
    const centerY = latitudeToWorldY(state.map.latitude, zoom) + offsetY;
    state.map.latitude = worldYToLatitude(centerY, zoom);
    state.map.longitude = worldXToLongitude(centerX, zoom);
    state.mapDraft = null;
    buildMapTiles();
    scheduleMapSettle(250);
  });

  map.addEventListener("pointercancel", () => {
    state.map.drag = null;
    map.classList.remove("is-dragging");
    buildMapTiles();
  });

  map.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      changeMapZoom(event.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );

  map.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeMapZoom(1);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      changeMapZoom(-1);
    } else if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const amount = 70;
      const zoom = state.map.zoom;
      let x = longitudeToWorldX(state.map.longitude, zoom);
      let y = latitudeToWorldY(state.map.latitude, zoom);
      if (event.key === "ArrowLeft") x -= amount;
      if (event.key === "ArrowRight") x += amount;
      if (event.key === "ArrowUp") y -= amount;
      if (event.key === "ArrowDown") y += amount;
      state.map.longitude = worldXToLongitude(x, zoom);
      state.map.latitude = worldYToLatitude(y, zoom);
      state.mapDraft = null;
      buildMapTiles();
      scheduleMapSettle(450);
    }
  });

  if ("ResizeObserver" in window) {
    let resizeTimer = null;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(buildMapTiles, 120);
    });
    observer.observe(map);
  } else {
    window.addEventListener("resize", buildMapTiles);
  }

  buildMapTiles();
}

function buildMapTiles() {
  const map = elements.weatherMap;
  if (!map) return;
  const width = map.clientWidth;
  const height = map.clientHeight;
  if (!width || !height) return;

  const zoom = state.map.zoom;
  const scale = 2 ** zoom;
  const centerWorldX = longitudeToWorldX(state.map.longitude, zoom);
  const centerWorldY = latitudeToWorldY(state.map.latitude, zoom);
  const centerTileX = Math.floor(centerWorldX / TILE_SIZE);
  const centerTileY = Math.floor(centerWorldY / TILE_SIZE);
  const columns = Math.max(3, Math.ceil(width / TILE_SIZE) + 2);
  const rows = Math.max(3, Math.ceil(height / TILE_SIZE) + 2);
  const columnBuffer = Math.floor(columns / 2);
  const rowBuffer = Math.floor(rows / 2);
  const startTileX = centerTileX - columnBuffer;
  const startTileY = Math.max(0, centerTileY - rowBuffer);
  const endTileY = Math.min(scale - 1, centerTileY + rowBuffer);

  const stage = document.createElement("div");
  stage.className = "map-stage";
  const stageWidth = columns * TILE_SIZE;
  const stageHeight = (endTileY - startTileY + 1) * TILE_SIZE;
  stage.style.width = `${stageWidth}px`;
  stage.style.height = `${stageHeight}px`;

  state.map.tileFailures = 0;
  state.map.tileSuccesses = 0;
  elements.mapOffline.hidden = true;

  for (let rowOffset = 0; rowOffset < rows; rowOffset += 1) {
    const tileY = startTileY + rowOffset;
    if (tileY > endTileY) break;
    for (let columnOffset = 0; columnOffset < columns; columnOffset += 1) {
      const tileX = startTileX + columnOffset;
      const wrappedX = ((tileX % scale) + scale) % scale;
      const image = document.createElement("img");
      image.className = "map-tile";
      image.alt = "";
      image.width = TILE_SIZE;
      image.height = TILE_SIZE;
      image.draggable = false;
      image.loading = "eager";
      image.referrerPolicy = "strict-origin-when-cross-origin";
      image.src = TILE_URL.replace("{z}", String(zoom))
        .replace("{x}", String(wrappedX))
        .replace("{y}", String(tileY));
      image.style.left = `${columnOffset * TILE_SIZE}px`;
      image.style.top = `${rowOffset * TILE_SIZE}px`;
      image.addEventListener("load", () => {
        state.map.tileSuccesses += 1;
        image.classList.add("is-loaded");
        if (state.map.tileSuccesses > 0) elements.mapOffline.hidden = true;
      });
      image.addEventListener("error", () => {
        state.map.tileFailures += 1;
      });
      stage.append(image);
    }
  }

  const stageStartX = startTileX * TILE_SIZE;
  const stageStartY = startTileY * TILE_SIZE;
  stage.style.left = `${width / 2 - (centerWorldX - stageStartX)}px`;
  stage.style.top = `${height / 2 - (centerWorldY - stageStartY)}px`;

  elements.mapTiles.replaceChildren(stage);
  state.map.stage = stage;
  updateMapCoordinateLabel();

  window.setTimeout(() => {
    if (state.map.stage === stage && state.map.tileSuccesses === 0 && state.map.tileFailures > 0) {
      elements.mapOffline.hidden = false;
    }
  }, 4_500);
}

function changeMapZoom(delta) {
  const nextZoom = Math.max(APP_CONFIG.map.minZoom, Math.min(APP_CONFIG.map.maxZoom, state.map.zoom + delta));
  if (nextZoom === state.map.zoom) return;
  state.map.zoom = nextZoom;
  buildMapTiles();
}

function moveMapTo(place, options = {}) {
  state.map.latitude = clamp(Number(place.latitude), -85, 85);
  state.map.longitude = wrapLongitude(Number(place.longitude));
  if (Number.isFinite(Number(options.zoom))) {
    state.map.zoom = Math.max(
      APP_CONFIG.map.minZoom,
      Math.min(APP_CONFIG.map.maxZoom, Number(options.zoom)),
    );
  }
  state.mapDraft = normalizePlace({ ...place, ...state.map });
  buildMapTiles();
  renderMapLabels();
}

function recenterMapOnLocation() {
  const place = getMapDraft();
  state.map.latitude = clamp(Number(place.latitude), -85, 85);
  state.map.longitude = wrapLongitude(Number(place.longitude));
  buildMapTiles();
  showToast("Map centered on the selected place.");
}

function renderMapLabels() {
  const draft = getMapDraft();
  elements.mapPlaceName.textContent = draft.name || "Pinned location";
  elements.mapCoordinates.textContent = formatCoordinates(draft);
  updateMapCoordinateLabel();
  updateFavoriteControls();
}

function updateMapCoordinateLabel() {
  elements.mapCoordinates.textContent = formatCoordinates({
    latitude: state.map.latitude,
    longitude: state.map.longitude,
  });
  if (!state.mapDraft) {
    elements.mapPlaceName.textContent = "Pinned location";
  }
}

function getMapDraft() {
  return normalizePlace(
    state.mapDraft || {
      name: "Pinned location",
      latitude: state.map.latitude,
      longitude: state.map.longitude,
    },
  );
}

function scheduleMapSettle(delay = 700) {
  cancelMapSettle();
  state.mapSettleTimer = window.setTimeout(() => {
    state.mapSettleTimer = null;
    settleMapLocation();
  }, delay);
}

function cancelMapSettle() {
  window.clearTimeout(state.mapSettleTimer);
  state.mapSettleTimer = null;
  state.mapSettleRequestId += 1;
  state.mapSettleController?.abort();
  state.mapSettleController = null;
  showMapLoading(false);
}

async function settleMapLocation(options = {}) {
  const latitude = state.map.latitude;
  const longitude = state.map.longitude;
  if (!isValidCoordinate(latitude, longitude)) return;

  if (
    state.weather &&
    Math.abs(latitude - state.location.latitude) < 0.0005 &&
    Math.abs(longitude - state.location.longitude) < 0.0005 &&
    state.mapDraft
  ) {
    renderMapLabels();
    return;
  }

  const requestId = ++state.mapSettleRequestId;
  state.mapSettleController?.abort();
  state.mapSettleController = new AbortController();
  showMapLoading(true, "Finding this place…");

  try {
    const place = await reverseGeocode(
      latitude,
      longitude,
      state.mapSettleController.signal,
      options.immediate ? 8_000 : 12_000,
    );
    if (requestId !== state.mapSettleRequestId) return;
    state.mapDraft = place;
    renderMapLabels();
    await loadWeather(place, {
      keepMap: true,
      updateUrl: true,
    });
  } catch (error) {
    if (requestId !== state.mapSettleRequestId || error?.name === "AbortError") return;
    const fallback = normalizePlace({
      name: "Pinned location",
      latitude,
      longitude,
    });
    state.mapDraft = fallback;
    renderMapLabels();
    await loadWeather(fallback, {
      keepMap: true,
      updateUrl: true,
    });
  } finally {
    if (requestId === state.mapSettleRequestId) {
      showMapLoading(false);
    }
  }
}

function showMapLoading(show, message = "Finding this place…") {
  elements.mapLoading.hidden = !show;
  const caption = elements.mapLoading.querySelector("span:last-child");
  if (caption && message) caption.textContent = message;
}

async function pinMapLocation() {
  const draft = getMapDraft();
  if (isFavorite(draft)) {
    removeFavorite(draft);
    return;
  }

  cancelMapSettle();
  state.mapDraft = draft;
  renderMapLabels();
  toggleFavorite(draft);
  await loadWeather(draft, {
    keepMap: true,
    updateUrl: true,
  });
}

async function reverseGeocode(
  latitude,
  longitude,
  signal = undefined,
  timeout = 12_000,
) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "en",
    });
    const data = await fetchJson(`${REVERSE_GEOCODING_API}?${params}`, controller.signal);
    const name = cleanText(data.city, 80) || cleanText(data.locality, 80) || "Pinned location";
    const admin1 = cleanText(data.principalSubdivision, 80);
    return normalizePlace({
      name,
      admin1: admin1 && admin1 !== name ? admin1 : "",
      country: cleanText(data.countryName, 80),
      countryCode: cleanText(data.countryCode, 3),
      latitude,
      longitude,
    });
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

function normalizePlace(place) {
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  return {
    name: cleanText(place?.name, 80) || cleanText(place?.locality, 80) || "Pinned location",
    admin1: cleanText(place?.admin1, 80),
    country: cleanText(place?.country, 80),
    countryCode: cleanText(place?.countryCode || place?.country_code, 3).toUpperCase(),
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
  };
}

function placeLabel(place) {
  return [place.admin1, place.country].filter(Boolean).join(", ") || formatCoordinates(place);
}

function locationKey(place) {
  return `${Number(place?.latitude).toFixed(3)}:${Number(place?.longitude).toFixed(3)}`;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseCoordinates(value) {
  const match = value
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*(?:,|\s)\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null;
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

function latitudeToWorldY(latitude, zoom) {
  const clamped = clamp(latitude, -85.05112878, 85.05112878);
  const sin = Math.sin((clamped * Math.PI) / 180);
  return (
    ((0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE_SIZE * 2 ** zoom)
  );
}

function worldYToLatitude(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / (TILE_SIZE * 2 ** zoom);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

function longitudeToWorldX(longitude, zoom) {
  return ((wrapLongitude(longitude) + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function worldXToLongitude(x, zoom) {
  return wrapLongitude((x / (TILE_SIZE * 2 ** zoom)) * 360 - 180);
}

function wrapLongitude(longitude) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function windDirectionToCompass(degrees) {
  if (!Number.isFinite(degrees)) return "";
  const index = ((Math.round(degrees) % 360) + 360) % 360;
  return COMPASS_POINTS[Math.round(index / 22.5) % 16];
}

function temperatureNumber(celsius) {
  const number = Number(celsius);
  if (!Number.isFinite(number)) return "--";
  return String(Math.round(state.unit === "fahrenheit" ? (number * 9) / 5 + 32 : number));
}

function temperatureText(celsius) {
  const number = Number(celsius);
  if (!Number.isFinite(number)) return "--°";
  return `${temperatureNumber(number)}°`;
}

function formatRange(low, high) {
  return `${temperatureText(low)} to ${temperatureText(high)}`;
}

function formatCoordinates(place) {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "Coordinates unavailable";
  const latitudeLabel = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? "N" : "S"}`;
  const longitudeLabel = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? "E" : "W"}`;
  return `${latitudeLabel}, ${longitudeLabel}`;
}

function formatCoordinatesShort(place) {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "Location";
  return `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
}

function formatLocalClock(timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(new Date());
    const part = (type) => parts.find((entry) => entry.type === type)?.value || "";
    return `${part("weekday")}, ${part("month")} ${part("day")} · ${part("hour")}:${part(
      "minute",
    )} ${part("dayPeriod")}`;
  } catch {
    return "Local time";
  }
}

function formatFullDate(dateString) {
  if (!dateString) return "Today";
  try {
    return new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(parseDate(dateString));
  } catch {
    return "Today";
  }
}

function formatWeekday(dateString) {
  try {
    return new Intl.DateTimeFormat("en", { weekday: "short" }).format(parseDate(dateString));
  } catch {
    return "—";
  }
}

function formatShortDate(dateString) {
  try {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
      parseDate(dateString),
    );
  } catch {
    return "";
  }
}

function parseDate(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function formatHour(timeString) {
  const hour = Number(timeString?.slice(11, 13));
  if (!Number.isFinite(hour)) return "—";
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour} ${suffix}`;
}

function formatClockTime(timeString) {
  const hour = Number(timeString?.slice(11, 13));
  const minute = Number(timeString?.slice(14, 16));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "--";
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function countryFlag(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((character) => 127397 + character.charCodeAt(0)));
}

function aqiCategory(value) {
  if (value <= 50) return { label: "Good", level: "good" };
  if (value <= 100) return { label: "Moderate", level: "moderate" };
  return { label: "Sensitive groups", level: "unhealthy" };
}

function round(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : "--";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function showStatus(message) {
  elements.statusMessage.textContent = message;
  elements.statusBanner.hidden = false;
}

function hideStatus() {
  elements.statusBanner.hidden = true;
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " is-error" : ""}`;
  const dot = document.createElement("span");
  dot.className = "toast-dot";
  dot.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(dot, text);
  elements.toastRegion.append(toast);
  elements.screenReaderStatus.textContent = message;

  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 240);
  }, 3_400);
}

function weatherArt(kind, isDay = true) {
  const sun = createSun(80, 77, 33, 49, 64);
  const smallSun = createSun(116, 35, 18, 27, 38);

  const stars = `
    <circle class="art-star" cx="44" cy="39" r="2.3"></circle>
    <circle class="art-star" cx="61" cy="27" r="1.4"></circle>
    <circle class="art-star" cx="127" cy="35" r="1.7"></circle>
    <circle class="art-star" cx="35" cy="73" r="1.3"></circle>
    <path class="art-star" d="M132 64l1.7 4.1 4.1 1.7-4.1 1.7L132 76l-1.7-4.5-4.1-1.7 4.1-1.7L132 64Z"></path>
  `;

  const moon = `
    <path class="moon-core" d="M111 36A43 43 0 1 0 111 127 34 34 0 1 1 111 36Z"></path>
    ${stars}
  `;

  const cloud = `
    <g class="cloud-group">
      <ellipse class="cloud-under" cx="76" cy="108" rx="44" ry="8"></ellipse>
      <path class="cloud-main" d="M40 108C25 108 13 96 13 81 13 67 24 56 38 56 43 40 58 29 75 29 95 29 112 42 117 61 128 63 136 73 136 85 136 99 125 110 111 110H40Z"></path>
      <path class="cloud-shade" d="M38 95c0-11 9-20 20-20 4-8 12-13 21-13 13 0 24 9 26 22 8 1 14 8 14 16 0 6-3 11-8 14H47c-5 0-9-4-9-9V95Z"></path>
    </g>
  `;

  const rain = `
    <line class="rain-line" x1="61" y1="119" x2="56" y2="136"></line>
    <line class="rain-line" x1="83" y1="119" x2="78" y2="139"></line>
    <line class="rain-line" x1="105" y1="119" x2="100" y2="135"></line>
  `;

  const snow = `
    <circle class="snow-flake" cx="58" cy="127" r="4"></circle>
    <circle class="snow-flake" cx="83" cy="139" r="3.3"></circle>
    <circle class="snow-flake" cx="108" cy="126" r="3.7"></circle>
  `;

  const thunder = `
    <path class="bolt" d="m91 111-17 30h15l-7 19 27-35H94l8-14H91Z"></path>
  `;

  const fog = `
    <line class="fog-line" x1="39" y1="121" x2="123" y2="121"></line>
    <line class="fog-line" x1="54" y1="136" x2="137" y2="136"></line>
    <line class="fog-line" x1="31" y1="151" x2="107" y2="151"></line>
  `;

  let content = "";
  if (kind === "clear") {
    content = isDay ? sun : moon;
  } else if (kind === "partly") {
    content = `${isDay ? smallSun : moon}${cloud}`;
  } else if (kind === "cloudy") {
    content = cloud;
  } else if (kind === "fog") {
    content = `${cloud}${fog}`;
  } else if (kind === "drizzle" || kind === "rain") {
    content = `${isDay ? smallSun : ""}${cloud}${rain}`;
  } else if (kind === "snow") {
    content = `${isDay ? smallSun : ""}${cloud}${snow}`;
  } else if (kind === "thunder") {
    content = `${cloud}${thunder}`;
  }

  return `<svg class="weather-svg" viewBox="0 0 160 160" aria-hidden="true">${content}</svg>`;
}

function createSun(centerX, centerY, radius, rayStart, rayEnd) {
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 8;
    const x1 = centerX + Math.cos(angle) * rayStart;
    const y1 = centerY + Math.sin(angle) * rayStart;
    const x2 = centerX + Math.cos(angle) * rayEnd;
    const y2 = centerY + Math.sin(angle) * rayEnd;
    return `<line class="sun-ray" x1="${x1.toFixed(1)}" y1="${y1.toFixed(
      1,
    )}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"></line>`;
  }).join("");

  return `
    <g>
      ${rays}
      <circle class="sun-core" cx="${centerX}" cy="${centerY}" r="${radius}"></circle>
      <circle class="sun-inner" cx="${centerX - radius * 0.24}" cy="${
        centerY - radius * 0.27
      }" r="${radius * 0.36}"></circle>
    </g>
  `;
}
