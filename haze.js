import { APP_CONFIG } from "./config.js";
import { createAqiMap } from "./haze-map.js";
import { createPlaceSearch } from "./place-search.js";
import { initThemePicker } from "./theme.js";
import { createWeatherScene } from "./weather-animations.js";
import {
  buildAirQualityUrl,
  buildRankingUrl,
  categoryForAqi,
  categoryForPm25,
  dominantPollutant,
  findBestOutdoorWindow,
  formatBestWindow,
  healthAdvice,
  hourlyWindow,
  MALAYSIAN_CITIES,
  MALAYSIAN_MAP_POINTS,
} from "./air-quality.js";

const REVERSE_GEOCODING_API = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const REQUEST_TIMEOUT = 15_000;
const AIR_CACHE_MS = 5 * 60_000;
const RANKING_CACHE_MS = 10 * 60_000;
const MAP_CACHE_MS = 10 * 60_000;
const LOCATION_ASKED_KEY = "weatherly:location-asked";
const MALAYSIA_MAP_CENTER = { latitude: 4.2, longitude: 109.2 };

const $ = (selector, root = document) => root.querySelector(selector);

const elements = {
  searchForm: $("#searchForm"),
  searchInput: $("#searchInput"),
  searchResults: $("#searchResults"),
  locateButton: $("#locateButton"),
  refreshButton: $("#refreshButton"),
  githubLink: $("#githubLink"),
  footerGithubLink: $("#footerGithubLink"),
  themeButton: $("#themeButton"),
  hazeError: $("#hazeError"),
  hazeErrorMessage: $("#hazeErrorMessage"),
  hazeErrorRetry: $("#hazeErrorRetry"),
  hazeAlert: $("#hazeAlert"),
  hazeAlertTitle: $("#hazeAlertTitle"),
  hazeAlertText: $("#hazeAlertText"),
  hazeStatusCard: $("#hazeStatusCard"),
  hazeWeatherScene: $("#hazeWeatherScene"),
  hazeLiveDot: $("#hazeLiveDot"),
  hazeLiveStatus: $("#hazeLiveStatus"),
  hazeLocationName: $("#hazeLocationName"),
  hazeLocationMeta: $("#hazeLocationMeta"),
  hazeLocalTime: $("#hazeLocalTime"),
  aqiValue: $("#aqiValue"),
  aqiCategory: $("#aqiCategory"),
  aqiGauge: $("#aqiGauge"),
  gaugeVerdict: $("#gaugeVerdict"),
  pm25Value: $("#pm25Value"),
  pm25Unit: $("#pm25Unit"),
  pm10Value: $("#pm10Value"),
  dominantPollutant: $("#dominantPollutant"),
  dominantValue: $("#dominantValue"),
  aqiBandValue: $("#aqiBandValue"),
  hazeDataTime: $("#hazeDataTime"),
  verdictCard: $("#verdictCard"),
  verdictBadge: $("#verdictBadge"),
  verdictValue: $("#verdictValue"),
  verdictText: $("#verdictText"),
  adviceChildren: $("#adviceChildren"),
  adviceOlder: $("#adviceOlder"),
  adviceSensitive: $("#adviceSensitive"),
  guidanceMask: $("#guidanceMask"),
  guidanceExercise: $("#guidanceExercise"),
  guidanceWindows: $("#guidanceWindows"),
  bestWindow: $("#bestWindow"),
  chartSummary: $("#chartSummary"),
  aqiChart: $("#aqiChart"),
  chartLegend: $("#chartLegend"),
  rankingUpdated: $("#rankingUpdated"),
  cityRankingList: $("#cityRankingList"),
  hazeMapSearchForm: $("#hazeMapSearchForm"),
  hazeMapSearchInput: $("#hazeMapSearchInput"),
  hazeMapSearchResults: $("#hazeMapSearchResults"),
  hazeMap: $("#hazeMap"),
  hazeMapTiles: $("#hazeMapTiles"),
  hazeMapOffline: $("#hazeMapOffline"),
  hazeMapLoading: $("#hazeMapLoading"),
  hazeMapZoomIn: $("#hazeMapZoomIn"),
  hazeMapZoomOut: $("#hazeMapZoomOut"),
  hazeMapRecenter: $("#hazeMapRecenter"),
  hazeMapPlaceName: $("#hazeMapPlaceName"),
  hazeMapCoordinates: $("#hazeMapCoordinates"),
  hazeMapViewHaze: $("#hazeMapViewHaze"),
  hazeMapDataStatus: $("#hazeMapDataStatus"),
  hazeMapRetry: $("#hazeMapRetry"),
  toastRegion: $("#toastRegion"),
  screenReaderStatus: $("#screenReaderStatus"),
};

const state = {
  location: { ...APP_CONFIG.defaultLocation },
  airQuality: null,
  loadedKey: null,
  lastUpdated: null,
  isLoading: false,
  loadFailed: false,
  requestController: null,
  requestId: 0,
  rankingController: null,
  ranking: null,
  rankingUpdated: null,
  map: null,
  mapController: null,
  mapPoints: [],
  mapPickController: null,
  aqiAnimationFrame: null,
  displayedAqi: 0,
  weatherScene: null,
};

const airCache = new Map();
let rankingCache = null;
let mapPointsCache = null;

init();

function init() {
  elements.githubLink.href = APP_CONFIG.repositoryUrl;
  elements.footerGithubLink.href = APP_CONFIG.repositoryUrl;
  initThemePicker(elements.themeButton);
  state.weatherScene = createWeatherScene(elements.hazeWeatherScene);
  state.weatherScene.setScene("fog", true);

  const initialLocation = readLocationFromUrl() || { ...APP_CONFIG.defaultLocation };
  state.location = normalizePlace(initialLocation);
  renderLocation();
  updateLocalTime();

  createPlaceSearch({
    form: elements.searchForm,
    input: elements.searchInput,
    results: elements.searchResults,
    onSelect: (place) => goToPlace(place),
  });

  createPlaceSearch({
    form: elements.hazeMapSearchForm,
    input: elements.hazeMapSearchInput,
    results: elements.hazeMapSearchResults,
    onSelect: (place) => goToPlace(place, { focusMap: true }),
  });

  setupHazeMap();
  setupInteractions();
  loadHaze(state.location, { updateUrl: true });
  loadCityRanking();
  loadMapPoints();
  maybeRequestFirstVisitLocation();

  window.setInterval(updateLocalTime, 30_000);
  window.setInterval(() => {
    if (document.visibilityState === "visible") {
      loadHaze(state.location, { updateUrl: false, silent: true });
      loadCityRanking();
      loadMapPoints();
    }
  }, APP_CONFIG.refreshIntervalMs);
}

function setupInteractions() {
  elements.locateButton.addEventListener("click", locateUser);
  elements.refreshButton.addEventListener("click", () => {
    loadHaze(state.location, { updateUrl: false, force: true });
    loadCityRanking(true);
    loadMapPoints(true);
  });
  elements.hazeErrorRetry.addEventListener("click", () => {
    loadHaze(state.location, { updateUrl: false, force: true });
  });

  window.addEventListener("online", () => {
    hideError();
    showToast("Back online. Refreshing the haze estimate.");
    loadHaze(state.location, { updateUrl: false, force: true });
    loadCityRanking(true);
    loadMapPoints(true);
  });

  window.addEventListener("offline", () => {
    showError("You appear to be offline. The last estimate will remain visible.");
    elements.hazeLiveDot.classList.add("is-offline");
    elements.hazeLiveStatus.textContent = "Offline · last known estimate";
  });

  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      state.lastUpdated &&
      Date.now() - state.lastUpdated.getTime() > AIR_CACHE_MS
    ) {
      loadHaze(state.location, { updateUrl: false, silent: true });
    }
  });
}

function setupHazeMap() {
  const initialZoom =
    window.innerWidth <= 680 ? 4 : window.innerWidth <= 1000 ? 5 : 6;
  state.map = createAqiMap({
    container: elements.hazeMap,
    tiles: elements.hazeMapTiles,
    offline: elements.hazeMapOffline,
    center: MALAYSIA_MAP_CENTER,
    zoom: initialZoom,
    minZoom: 4,
    maxZoom: 12,
    onCenterChange: updateMapCard,
    onLocationPick: handleMapLocationPick,
    onPointSelect: (point) => {
      goToPlace(point, { focusMap: true });
    },
  });

  elements.hazeMapZoomIn.addEventListener("click", () => state.map.zoomIn());
  elements.hazeMapZoomOut.addEventListener("click", () => state.map.zoomOut());
  elements.hazeMapRecenter.addEventListener("click", () => state.map.recenter());
  elements.hazeMapViewHaze.addEventListener("click", () => {
    const center = state.map.getCenter();
    handleMapLocationPick(center);
  });
  elements.hazeMapRetry.addEventListener("click", () => loadMapPoints(true));
  updateMapCard({
    ...MALAYSIA_MAP_CENTER,
    zoom: 6,
    settled: false,
  });
}

function updateMapCard({ latitude, longitude, settled, source }) {
  elements.hazeMapCoordinates.textContent = formatCoordinates({ latitude, longitude });
  if (settled && ["drag", "click", "keyboard"].includes(source)) {
    elements.hazeMapPlaceName.textContent = "Pinned location";
  }
}

async function handleMapLocationPick({ latitude, longitude }) {
  if (!isValidCoordinate(latitude, longitude)) return;
  state.mapPickController?.abort();
  const controller = new AbortController();
  state.mapPickController = controller;
  showMapLoading(true, "Finding this place…");
  elements.hazeMapPlaceName.textContent = "Pinned location";

  try {
    const place = await reverseGeocode(latitude, longitude, controller.signal);
    goToPlace(place, { focusMap: true });
  } catch (error) {
    if (error?.name === "AbortError") return;
    goToPlace(
      {
        name: "Pinned location",
        latitude,
        longitude,
      },
      { focusMap: true },
    );
  } finally {
    if (state.mapPickController === controller) {
      state.mapPickController = null;
      showMapLoading(false);
    }
  }
}

async function loadMapPoints(force = false) {
  if (
    !force &&
    mapPointsCache &&
    Date.now() - mapPointsCache.savedAt < MAP_CACHE_MS
  ) {
    applyMapPoints(mapPointsCache.rows, mapPointsCache.savedAt);
    return;
  }

  state.mapController?.abort();
  const controller = new AbortController();
  state.mapController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  elements.hazeMapDataStatus.textContent = "Loading map overlays…";
  elements.hazeMapRetry.hidden = true;

  try {
    const data = await fetchJson(
      buildRankingUrl(MALAYSIAN_MAP_POINTS),
      controller.signal,
    );
    if (!Array.isArray(data)) throw new Error("Map response was not a list");

    const rows = data
      .map((result, index) => {
        const aqi = Number(result.current?.us_aqi);
        if (!MALAYSIAN_MAP_POINTS[index] || !Number.isFinite(aqi)) return null;
        return {
          ...MALAYSIAN_MAP_POINTS[index],
          current: result.current,
          aqi,
          category: categoryForAqi(aqi),
        };
      })
      .filter(Boolean);

    if (!rows.length) throw new Error("No map estimates returned");
    const savedAt = Date.now();
    mapPointsCache = { rows, savedAt };
    applyMapPoints(rows, savedAt);
  } catch {
    elements.hazeMapDataStatus.textContent = "Map overlays unavailable";
    elements.hazeMapRetry.hidden = false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function applyMapPoints(rows, savedAt) {
  state.mapPoints = rows;
  state.map?.setPoints(rows);
  elements.hazeMapDataStatus.textContent = `${rows.length} estimated areas · ${formatClockTime(
    new Date(savedAt),
  )}`;
  elements.hazeMapRetry.hidden = true;
}

function showMapLoading(show, message = "Finding this place…") {
  elements.hazeMapLoading.hidden = !show;
  const caption = elements.hazeMapLoading.querySelector("span:last-child");
  if (caption) caption.textContent = message;
}

async function loadHaze(location, options = {}) {
  const place = normalizePlace(location);
  if (!isValidCoordinate(place.latitude, place.longitude)) return;

  const key = locationKey(place);
  const isNewLocation = state.loadedKey !== key;
  const requestId = ++state.requestId;
  state.requestController?.abort();
  const controller = new AbortController();
  state.requestController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  state.location = place;
  state.loadFailed = false;
  renderLocation();
  setLoading(true);
  hideError();

  if (isNewLocation) {
    state.airQuality = null;
    renderLoadingState();
  }

  const cached = airCache.get(key);
  if (!options.force && cached && Date.now() - cached.savedAt < AIR_CACHE_MS) {
    window.clearTimeout(timeoutId);
    if (requestId !== state.requestId) return;
    applyAirQuality(cached.data, cached.savedAt, options);
    setLoading(false);
    return;
  }

  try {
    const data = await fetchJson(buildAirQualityUrl(place), controller.signal);
    if (requestId !== state.requestId) return;
    if (!data?.current) throw new Error("Air quality response did not include current data");

    const savedAt = Date.now();
    airCache.set(key, { data, savedAt });
    applyAirQuality(data, savedAt, options);
  } catch (error) {
    if (requestId !== state.requestId) return;
    state.loadFailed = true;
    const message = navigator.onLine
      ? "Estimated air quality could not be loaded. Check your connection and try again."
      : "You appear to be offline. Reconnect to load the latest estimate.";
    showError(message);
    if (!state.airQuality) renderUnavailableState();
    if (!options.silent) showToast("Air quality service unavailable.", "error");
  } finally {
    window.clearTimeout(timeoutId);
    if (requestId === state.requestId) {
      setLoading(false);
      updateLocalTime();
    }
  }
}

function applyAirQuality(data, savedAt, options = {}) {
  state.airQuality = data;
  state.loadedKey = locationKey(state.location);
  state.lastUpdated = new Date(savedAt);
  state.loadFailed = false;
  renderHaze();
  hideError();

  if (options.updateUrl !== false) {
    updateLocationUrl(state.location);
  }
}

function renderHaze() {
  const current = state.airQuality?.current;
  const aqi = Number(current?.us_aqi);
  const category = categoryForAqi(aqi);
  if (!current || !category) {
    renderUnavailableState();
    return;
  }

  renderLocation();
  applyCategoryTheme(category);
  elements.hazeStatusCard.classList.remove("is-loading");
  elements.hazeStatusCard.setAttribute("aria-busy", "false");
  animateAqi(aqi);
  elements.aqiCategory.textContent = category.label;
  elements.aqiBandValue.textContent = category.label;
  elements.gaugeVerdict.textContent = category.verdict;

  elements.pm25Value.textContent = formatConcentration(current.pm2_5);
  elements.pm10Value.textContent = formatConcentration(current.pm10);
  const pm25Band =
    categoryForAqi(current.us_aqi_pm2_5) ||
    categoryForPm25(current.pm2_5) ||
    category;
  const pm25Metric = elements.pm25Value.closest(".haze-metric");
  pm25Metric.classList.add("is-band-coded");
  pm25Metric.style.setProperty("--band-color", pm25Band.color);
  pm25Metric.title = `PM2.5 ${formatConcentration(current.pm2_5)} µg/m³ · ${pm25Band.label} health band`;
  elements.pm25Unit.textContent = `µg/m³ · ${pm25Band.label} band`;

  const dominant = dominantPollutant(current);
  elements.dominantPollutant.textContent = dominant?.label || "Mixed pollutants";
  if (dominant && Number.isFinite(dominant.concentration)) {
    elements.dominantValue.textContent = `Index ${Math.round(dominant.index)} · ${formatConcentration(
      dominant.concentration,
    )} µg/m³`;
  } else if (dominant) {
    elements.dominantValue.textContent = `Sub-index ${Math.round(dominant.index)}`;
  } else {
    elements.dominantValue.textContent = "Sub-index unavailable";
  }

  const advice = healthAdvice(category);
  renderVerdict(category, advice);
  renderAlert(category, advice);
  renderChart();
  elements.hazeDataTime.textContent = `Model hour ${formatApiTimestamp(
    current.time,
  )} · fetched ${formatClockTime(new Date())}`;
  elements.hazeLiveStatus.textContent = `Estimated air quality · ${
    state.airQuality.timezone_abbreviation || state.airQuality.timezone || "local"
  }`;
  elements.hazeLiveDot.classList.remove("is-offline");
  document.title = `AQI ${Math.round(aqi)} ${category.label} · ${state.location.name}`;
  elements.hazeStatusCard.dataset.category = category.key;
  elements.screenReaderStatus.textContent = `Estimated air quality index ${Math.round(
    aqi,
  )}, ${category.label}. ${category.verdict}.`;
  updateLocalTime();
}

function renderLoadingState() {
  window.cancelAnimationFrame(state.aqiAnimationFrame);
  applyCategoryTheme(null);
  elements.hazeStatusCard.classList.add("is-loading");
  elements.hazeStatusCard.setAttribute("aria-busy", "true");
  elements.aqiValue.textContent = "--";
  elements.aqiCategory.textContent = "Loading";
  elements.aqiBandValue.textContent = "Waiting";
  elements.pm25Value.textContent = "--";
  elements.pm25Unit.textContent = "µg/m³";
  elements.pm25Value.closest(".haze-metric")?.classList.remove("is-band-coded");
  elements.pm10Value.textContent = "--";
  elements.dominantPollutant.textContent = "--";
  elements.dominantValue.textContent = "Estimated sub-index";
  elements.aqiGauge.style.setProperty("--aqi-progress", "0deg");
  elements.gaugeVerdict.textContent = "Checking";
  elements.hazeDataTime.textContent = "Waiting for the latest estimate";
  elements.hazeLiveStatus.textContent = "Loading air quality";
  elements.hazeLiveDot.classList.remove("is-offline");
  elements.hazeAlert.hidden = true;

  elements.verdictCard.className = "panel haze-verdict-card verdict-loading";
  elements.verdictBadge.textContent = "Checking";
  elements.verdictValue.textContent = "Checking conditions";
  elements.verdictText.textContent =
    "We are estimating the current outdoor risk for this location.";
  elements.adviceChildren.textContent = "Checking guidance…";
  elements.adviceOlder.textContent = "Checking guidance…";
  elements.adviceSensitive.textContent = "Checking guidance…";
  elements.guidanceMask.textContent = "Checking mask guidance…";
  elements.guidanceExercise.textContent = "Checking outdoor activity guidance…";
  elements.guidanceWindows.textContent = "Checking indoor air guidance…";
  elements.bestWindow.textContent = "Finding the best window…";
  elements.chartSummary.textContent =
    "The forecast will show when air quality is expected to improve.";
  elements.aqiChart.innerHTML = '<div class="chart-skeleton"></div>';
}

function renderUnavailableState() {
  window.cancelAnimationFrame(state.aqiAnimationFrame);
  state.displayedAqi = 0;
  applyCategoryTheme(null);
  elements.hazeStatusCard.classList.remove("is-loading");
  elements.hazeStatusCard.setAttribute("aria-busy", "false");
  elements.aqiValue.textContent = "--";
  elements.aqiCategory.textContent = "Unavailable";
  elements.aqiBandValue.textContent = "No estimate";
  elements.pm25Value.textContent = "--";
  elements.pm25Unit.textContent = "µg/m³";
  elements.pm25Value.closest(".haze-metric")?.classList.remove("is-band-coded");
  elements.pm10Value.textContent = "--";
  elements.dominantPollutant.textContent = "--";
  elements.dominantValue.textContent = "No estimate";
  elements.aqiGauge.style.setProperty("--aqi-progress", "0deg");
  elements.gaugeVerdict.textContent = "No assessment";
  elements.hazeDataTime.textContent = "No current estimate";
  elements.hazeAlert.hidden = true;
  elements.verdictCard.className = "panel haze-verdict-card";
  elements.verdictBadge.textContent = "No data";
  elements.verdictValue.textContent = "Assessment unavailable";
  elements.verdictText.textContent =
    "Retry the air-quality request or follow official MOH/DOE guidance.";
  elements.bestWindow.textContent = "Forecast unavailable";
  elements.chartSummary.textContent = "No air-quality forecast is available right now.";
  elements.aqiChart.innerHTML =
    '<p class="ranking-message">The air-quality estimate could not be loaded.</p>';
}

function animateAqi(targetAqi) {
  window.cancelAnimationFrame(state.aqiAnimationFrame);
  const target = Math.max(0, Number(targetAqi));
  if (!Number.isFinite(target)) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.displayedAqi = Math.round(target);
    elements.aqiValue.textContent = state.displayedAqi;
    elements.aqiGauge.style.setProperty(
      "--aqi-progress",
      `${Math.min(target / 300, 1) * 360}deg`,
    );
    return;
  }

  const from = Number(state.displayedAqi) || 0;
  const startedAt = performance.now();
  const duration = 900;

  const tick = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    const current = from + (target - from) * eased;
    elements.aqiValue.textContent = Math.round(current);
    elements.aqiGauge.style.setProperty(
      "--aqi-progress",
      `${Math.min(current / 300, 1) * 360}deg`,
    );
    if (progress < 1) {
      state.aqiAnimationFrame = requestAnimationFrame(tick);
    } else {
      state.displayedAqi = Math.round(target);
      state.aqiAnimationFrame = null;
    }
  };

  state.aqiAnimationFrame = requestAnimationFrame(tick);
}

function applyCategoryTheme(category) {
  [
    "haze-good",
    "haze-moderate",
    "haze-unhealthy",
    "haze-very-unhealthy",
    "haze-hazardous",
    "haze-unavailable",
  ].forEach((className) => elements.hazeStatusCard.classList.remove(className));
  elements.hazeStatusCard.classList.add(category ? `haze-${category.key}` : "haze-unavailable");
}

function renderVerdict(category, advice) {
  const tone = category.level === 0 ? "safe" : category.level === 1 ? "careful" : "unsafe";
  elements.verdictCard.className = `panel haze-verdict-card verdict-${tone}`;
  elements.verdictBadge.textContent = category.label;
  elements.verdictValue.textContent = category.verdict;
  elements.verdictText.textContent = advice.summary;
  elements.adviceChildren.textContent = advice.children;
  elements.adviceOlder.textContent = advice.olderAdults;
  elements.adviceSensitive.textContent = advice.sensitive;
  elements.guidanceMask.textContent = advice.mask;
  elements.guidanceExercise.textContent = advice.exercise;
  elements.guidanceWindows.textContent = advice.windows;
}

function renderAlert(category, advice) {
  const shouldShow = category.level >= 2;
  elements.hazeAlert.hidden = !shouldShow;
  if (!shouldShow) return;

  elements.hazeAlert.className = `haze-alert haze-alert-${category.key}`;
  elements.hazeAlertTitle.textContent = `${category.label} air quality in ${state.location.name}`;
  elements.hazeAlertText.textContent = `${advice.exercise} ${
    category.level >= 3 ? advice.mask : "Follow MOH/DOE guidance if you must go outside."
  }`;
}

function renderChart() {
  const data = state.airQuality;
  const series = hourlyWindow(data, 24).filter((point) => Number.isFinite(point.aqi));
  if (series.length < 2) {
    elements.aqiChart.innerHTML =
      '<p class="ranking-message">The 24-hour forecast is unavailable.</p>';
    elements.bestWindow.textContent = "Forecast unavailable";
    return;
  }

  const width = 960;
  const height = 285;
  const padding = { top: 22, right: 18, bottom: 36, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxAqi = Math.max(100, ...series.map((point) => point.aqi));
  const chartMax = Math.ceil(maxAqi / 50) * 50;
  const xFor = (index) =>
    padding.left + (index / Math.max(series.length - 1, 1)) * plotWidth;
  const yFor = (value) =>
    padding.top + (1 - Math.min(value, chartMax) / chartMax) * plotHeight;

  const linePath = series
    .map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index).toFixed(1)},${yFor(point.aqi).toFixed(1)}`)
    .join(" ");
  const baseY = padding.top + plotHeight;
  const areaPath = `${linePath} L${xFor(series.length - 1).toFixed(1)},${baseY} L${padding.left},${baseY} Z`;

  const thresholds = [50, 100, 200, 300]
    .filter((value) => value < chartMax)
    .map((value) => {
      const category = categoryForAqi(value + 1);
      return `<line class="chart-threshold" x1="${padding.left}" y1="${yFor(
        value,
      )}" x2="${width - padding.right}" y2="${yFor(value)}" stroke="${category.color}" opacity=".42"></line>
        <text class="chart-axis-label" x="${width - padding.right}" y="${
          yFor(value) - 4
        }" text-anchor="end">${category.label}</text>`;
    })
    .join("");

  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const value = (chartMax / 4) * (index + 1);
    return `<line class="chart-grid" x1="${padding.left}" y1="${yFor(
      value,
    )}" x2="${width - padding.right}" y2="${yFor(value)}"></line>`;
  }).join("");

  const tickIndexes = [];
  for (let index = 0; index < series.length; index += 6) tickIndexes.push(index);
  if (tickIndexes.at(-1) !== series.length - 1) tickIndexes.push(series.length - 1);

  const xLabels = tickIndexes
    .map((index) => {
      const point = series[index];
      return `<text class="chart-axis-label" x="${xFor(index)}" y="${
        height - 13
      }" text-anchor="middle">${formatChartTime(point.time, index === 0)}</text>`;
    })
    .join("");

  const points = tickIndexes
    .map((index) => {
      const point = series[index];
      const category = categoryForAqi(point.aqi);
      return `<circle class="chart-point" cx="${xFor(index)}" cy="${yFor(
        point.aqi,
      )}" r="4" stroke="${category.color}"><title>${formatApiTimestamp(
        point.time,
      )}: estimated AQI ${Math.round(point.aqi)}</title></circle>`;
    })
    .join("");

  const best = findBestOutdoorWindow(data);
  elements.bestWindow.textContent = best
    ? `Best: ${formatBestWindow(best)}`
    : "No clear outdoor window";

  const lowest = Math.min(...series.map((point) => point.aqi));
  const highest = Math.max(...series.map((point) => point.aqi));
  elements.chartSummary.textContent = `24-hour range: ${Math.round(
    lowest,
  )} to ${Math.round(highest)} estimated AQI. Coloured lines mark Malaysia's category thresholds.`;

  elements.aqiChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Estimated AQI for the next 24 hours, ranging from ${Math.round(
      lowest,
    )} to ${Math.round(highest)}.">
      <defs>
        <linearGradient id="aqiAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop class="aqi-area-stop" offset="0%" stop-color="#466d58" stop-opacity=".2"></stop>
          <stop class="aqi-area-stop" offset="100%" stop-color="#466d58" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      ${gridLines}
      ${thresholds}
      <path class="chart-area" d="${areaPath}" fill="url(#aqiAreaFill)"></path>
      <path class="chart-line" d="${linePath}"></path>
      <line class="chart-now" x1="${padding.left}" y1="${padding.top}" x2="${
        padding.left
      }" y2="${baseY}"></line>
      ${points}
      ${xLabels}
      <text class="chart-axis-label" x="${padding.left}" y="${
        padding.top - 7
      }">Now</text>
    </svg>
  `;
}

async function loadCityRanking(force = false) {
  if (
    !force &&
    rankingCache &&
    Date.now() - rankingCache.savedAt < RANKING_CACHE_MS
  ) {
    renderCityRanking(rankingCache.rows, rankingCache.savedAt);
    return;
  }

  state.rankingController?.abort();
  const controller = new AbortController();
  state.rankingController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  renderRankingLoading();

  try {
    const data = await fetchJson(buildRankingUrl(), controller.signal);
    if (!Array.isArray(data)) throw new Error("Ranking response was not a list");

    const rows = data
      .map((result, index) => ({
        ...MALAYSIAN_CITIES[index],
        current: result.current,
      }))
      .filter(
        (city) =>
          city.name && Number.isFinite(Number(city.current?.us_aqi)),
      )
      .map((city) => ({
        ...city,
        aqi: Number(city.current.us_aqi),
        category: categoryForAqi(Number(city.current.us_aqi)),
      }))
      .sort((a, b) => a.aqi - b.aqi);

    if (!rows.length) throw new Error("No city estimates returned");
    const savedAt = Date.now();
    rankingCache = { rows, savedAt };
    state.ranking = rows;
    state.rankingUpdated = new Date(savedAt);
    renderCityRanking(rows, savedAt);
  } catch {
    renderRankingError();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function renderRankingLoading() {
  elements.rankingUpdated.textContent = "Loading cities…";
  elements.cityRankingList.innerHTML = Array.from(
    { length: 6 },
    () => '<div class="city-row-skeleton"></div>',
  ).join("");
}

function renderCityRanking(rows, savedAt) {
  elements.rankingUpdated.textContent = `Updated ${formatClockTime(
    new Date(savedAt),
  )} · estimated`;
  elements.cityRankingList.replaceChildren();
  const currentKey = locationKey(state.location);

  rows.forEach((city, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `city-ranking-row${
      locationKey(city) === currentKey ? " is-current" : ""
    }`;
    row.style.setProperty("--city-color", city.category.color);
    row.style.setProperty("--row-index", index);
    row.setAttribute(
      "aria-label",
      `${city.name}, estimated AQI ${Math.round(city.aqi)}, ${city.category.label}. Show haze outlook.`,
    );

    const rank = document.createElement("span");
    rank.className = "city-rank";
    rank.textContent = String(index + 1).padStart(2, "0");

    const copy = document.createElement("span");
    copy.className = "city-copy";
    const name = document.createElement("strong");
    name.textContent = city.name;
    const region = document.createElement("span");
    region.textContent = city.admin1;
    copy.append(name, region);

    const aqi = document.createElement("span");
    aqi.className = "city-aqi";
    aqi.textContent = Math.round(city.aqi);

    const dot = document.createElement("span");
    dot.className = "city-band-dot";
    dot.setAttribute("aria-hidden", "true");

    row.append(rank, copy, aqi, dot);
    row.addEventListener("click", () => {
      goToPlace(city);
      elements.hazeStatusCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.cityRankingList.append(row);
  });
}

function renderRankingError() {
  elements.rankingUpdated.textContent = "Ranking unavailable";
  elements.cityRankingList.innerHTML = `
    <div class="ranking-message">
      <div>
        <p>City ranking could not be loaded.</p>
        <button type="button">Try again</button>
      </div>
    </div>
  `;
  $("button", elements.cityRankingList).addEventListener("click", () =>
    loadCityRanking(true),
  );
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  elements.refreshButton.classList.toggle("is-loading", isLoading);
  elements.refreshButton.disabled = isLoading;
  if (isLoading) {
    elements.hazeLiveStatus.textContent = "Updating air quality";
    elements.hazeLiveDot.classList.remove("is-offline");
    elements.hazeStatusCard.setAttribute("aria-busy", "true");
  } else if (state.airQuality) {
    elements.hazeLiveStatus.textContent = state.loadFailed
      ? "Refresh failed · last estimate"
      : `Estimated air quality · ${
          state.airQuality.timezone_abbreviation || state.airQuality.timezone || "local"
        }`;
    elements.hazeStatusCard.setAttribute("aria-busy", "false");
  }
}

function renderLocation() {
  elements.hazeLocationName.textContent = state.location.name;
  const region = [state.location.admin1, state.location.country]
    .filter((part, index, parts) => part && part !== state.location.name && parts.indexOf(part) === index)
    .join(", ");
  elements.hazeLocationMeta.textContent = region || formatCoordinates(state.location);
}

function updateLocalTime() {
  const timezone = state.airQuality?.timezone;
  elements.hazeLocalTime.textContent = timezone
    ? formatLocalClock(timezone)
    : "Local time";
}

function goToPlace(place, options = {}) {
  const normalized = normalizePlace(place);
  loadHaze(normalized, { updateUrl: true, force: true });
  if (state.map) {
    const currentZoom = state.map.getCenter().zoom;
    state.map.setCenter(normalized, {
      zoom: options.focusMap ? 8 : Math.max(currentZoom, 7),
    });
  }
  elements.hazeMapPlaceName.textContent = normalized.name;
  elements.hazeMapCoordinates.textContent = formatCoordinates(normalized);
}

function locateUser(options = {}) {
  if (!navigator.geolocation) {
    showToast("This browser does not support location access.", "error");
    return;
  }

  elements.locateButton.disabled = true;
  elements.locateButton.setAttribute("aria-busy", "true");
  if (!options.automatic) showToast("Finding your location…");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      try {
        const place = await reverseGeocode(latitude, longitude);
        goToPlace(place);
        if (!options.automatic) {
          showToast("Location found. Loading the local haze estimate.");
        }
      } catch {
        goToPlace({
          name: "Current location",
          latitude,
          longitude,
        });
      } finally {
        elements.locateButton.disabled = false;
        elements.locateButton.removeAttribute("aria-busy");
      }
    },
    (error) => {
      elements.locateButton.disabled = false;
      elements.locateButton.removeAttribute("aria-busy");
      const message =
        error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Search for a Malaysian city instead."
          : error.code === error.TIMEOUT
            ? "Your location took too long to find. Try the search bar instead."
            : "Your location could not be found right now.";
      if (!options.automatic || options.smartStart) showToast(message, "error");
    },
    {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 5 * 60_000,
    },
  );
}

async function maybeRequestFirstVisitLocation() {
  if (readLocationFromUrl() || !navigator.geolocation) return;

  try {
    if (localStorage.getItem(LOCATION_ASKED_KEY)) return;
    localStorage.setItem(LOCATION_ASKED_KEY, "true");
  } catch {
    // Continue to the permission request when storage is unavailable.
  }

  try {
    const permission = await navigator.permissions?.query({ name: "geolocation" });
    if (permission?.state === "denied") {
      showToast("Using Kuala Lumpur. Allow location access or search for another city.");
      return;
    }
  } catch {
    // Fall through to the browser geolocation prompt.
  }

  window.setTimeout(
    () => locateUser({ automatic: true, smartStart: true }),
    550,
  );
}

async function reverseGeocode(latitude, longitude, signal = undefined) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "en",
    });
    const data = await fetchJson(
      `${REVERSE_GEOCODING_API}?${params}`,
      controller.signal,
    );
    return normalizePlace({
      name: data.city || data.locality || data.principalSubdivision || "Current location",
      admin1: data.principalSubdivision,
      country: data.countryName,
      countryCode: data.countryCode,
      latitude,
      longitude,
    });
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

function readLocationFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const latitudeValue = params.get("lat");
    const longitudeValue = params.get("lon");
    if (!latitudeValue?.trim() || !longitudeValue?.trim()) return null;
    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);
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
    // Search and local weather remain usable without deep links.
  }
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json();
}

function showError(message) {
  elements.hazeErrorMessage.textContent = message;
  elements.hazeError.hidden = false;
}

function hideError() {
  elements.hazeError.hidden = true;
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

function normalizePlace(place = {}) {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  return {
    name: cleanText(place.name, 80) || cleanText(place.locality, 80) || "Pinned location",
    admin1: cleanText(place.admin1, 80),
    country: cleanText(place.country, 80),
    countryCode: cleanText(place.countryCode || place.country_code, 3).toUpperCase(),
    latitude: Number.isFinite(latitude) ? latitude : 0,
    longitude: Number.isFinite(longitude) ? longitude : 0,
  };
}

function locationKey(place) {
  return `${Number(place?.latitude).toFixed(3)}:${Number(place?.longitude).toFixed(3)}`;
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

function formatConcentration(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "--";
}

function formatCoordinates(place) {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "Location";
  return `${Math.abs(latitude).toFixed(2)}° ${latitude >= 0 ? "N" : "S"}, ${Math.abs(
    longitude,
  ).toFixed(2)}° ${longitude >= 0 ? "E" : "W"}`;
}

function formatApiTimestamp(timeString) {
  if (!timeString) return "--";
  const [date, time] = timeString.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const hour = Number(time?.slice(0, 2));
  const minute = Number(time?.slice(3, 5));
  const monthLabel = new Intl.DateTimeFormat("en", { month: "short" }).format(
    new Date(year, month - 1, day, 12),
  );
  return `${day} ${monthLabel}, ${formatHourNumber(hour, minute)}`;
}

function formatChartTime(timeString, includeDay) {
  const hour = Number(timeString?.slice(11, 13));
  const day = timeString ? new Date(`${timeString.slice(0, 10)}T12:00:00`) : null;
  const hourLabel = formatHourNumber(hour, 0);
  if (!includeDay) return hourLabel;
  const dayLabel = day
    ? new Intl.DateTimeFormat("en", { weekday: "short" }).format(day)
    : "";
  return `${dayLabel} ${hourLabel}`;
}

function formatHourNumber(hour, minute = 0) {
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatClockTime(date) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
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

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
