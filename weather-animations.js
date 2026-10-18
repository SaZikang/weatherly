let visibilityBound = false;

export function createWeatherScene(container) {
  if (!container) {
    return { setScene() {}, destroy() {} };
  }

  bindVisibilityPause();
  container.classList.add("weather-scene-ready");

  const layers = [createLayer(), createLayer()];
  container.replaceChildren(...layers);
  let activeIndex = 0;
  let activeKey = "";

  const setScene = (kind, isDay = true) => {
    const key = `${kind}-${isDay ? "day" : "night"}`;
    if (key === activeKey) return;

    const nextIndex = activeIndex === 0 ? 1 : 0;
    const nextLayer = layers[nextIndex];
    const previousLayer = layers[activeIndex];
    nextLayer.replaceChildren();
    buildScene(nextLayer, kind, isDay);

    requestAnimationFrame(() => {
      nextLayer.classList.add("is-active");
      previousLayer.classList.remove("is-active");
    });

    activeIndex = nextIndex;
    activeKey = key;
  };

  return {
    setScene,
    destroy() {
      container.replaceChildren();
      container.classList.remove("weather-scene-ready");
    },
  };
}

function createLayer() {
  const layer = document.createElement("div");
  layer.className = "weather-scene-layer";
  return layer;
}

function buildScene(layer, kind, isDay) {
  const compact = window.innerWidth <= 680;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const showSun = isDay && (kind === "clear" || kind === "partly");
  const showMoon = !isDay && (kind === "clear" || kind === "partly");
  const showClouds = ["partly", "cloudy", "rain", "drizzle", "thunder", "snow"].includes(kind);
  const showRain = kind === "rain" || kind === "drizzle" || kind === "thunder";
  const showSnow = kind === "snow";
  const showFog = kind === "fog";

  if (showSun) layer.append(createSun());
  if (showMoon) {
    layer.append(createMoon());
    appendStars(layer, reduced ? 6 : compact ? 16 : 32);
  }
  if (showClouds) appendClouds(layer, reduced ? 1 : compact ? 2 : 4);
  if (showRain && !reduced) appendRain(layer, compact ? 16 : 34);
  if (showSnow && !reduced) appendSnow(layer, compact ? 12 : 24);
  if (showFog) appendMist(layer, reduced ? 1 : 3, reduced);
  if (kind === "thunder" && !reduced) {
    const flash = document.createElement("span");
    flash.className = "scene-lightning";
    layer.append(flash);
  }
}

function createSun() {
  const sun = document.createElement("div");
  sun.className = "scene-sun";
  const rays = document.createElement("div");
  rays.className = "scene-sun-rays";
  for (let index = 0; index < 12; index += 1) {
    const ray = document.createElement("i");
    ray.style.setProperty("--ray-index", index);
    rays.append(ray);
  }
  const core = document.createElement("span");
  core.className = "scene-sun-core";
  sun.append(rays, core);
  return sun;
}

function createMoon() {
  const moon = document.createElement("div");
  moon.className = "scene-moon";
  moon.innerHTML = '<span class="scene-moon-glow"></span><span class="scene-moon-core"></span>';
  return moon;
}

function appendStars(layer, count) {
  const field = document.createElement("div");
  field.className = "scene-stars";
  for (let index = 0; index < count; index += 1) {
    const star = document.createElement("i");
    star.style.setProperty("--star-x", `${random(2, 98)}%`);
    star.style.setProperty("--star-y", `${random(2, 88)}%`);
    star.style.setProperty("--star-size", `${random(1, 3)}px`);
    star.style.setProperty("--star-delay", `${random(0, 4)}s`);
    star.style.setProperty("--star-duration", `${random(2.2, 5.5)}s`);
    field.append(star);
  }
  layer.append(field);
}

function appendClouds(layer, count) {
  const field = document.createElement("div");
  field.className = "scene-clouds";
  for (let index = 0; index < count; index += 1) {
    const cloud = document.createElement("span");
    cloud.className = "scene-cloud";
    cloud.style.setProperty("--cloud-y", `${8 + index * 17 + random(-5, 5)}%`);
    cloud.style.setProperty("--cloud-scale", `${random(0.72, 1.32)}`);
    cloud.style.setProperty("--cloud-delay", `${random(-12, 0)}s`);
    cloud.style.setProperty("--cloud-duration", `${24 + index * 7 + random(0, 6)}s`);
    cloud.style.setProperty("--cloud-opacity", `${random(0.12, 0.25)}`);
    field.append(cloud);
  }
  layer.append(field);
}

function appendRain(layer, count) {
  const field = document.createElement("div");
  field.className = "scene-rain";
  for (let index = 0; index < count; index += 1) {
    const drop = document.createElement("i");
    drop.className = "scene-rain-drop";
    drop.style.setProperty("--drop-x", `${random(0, 100)}%`);
    drop.style.setProperty("--drop-delay", `${random(-2.4, 0)}s`);
    drop.style.setProperty("--drop-duration", `${random(0.75, 1.4)}s`);
    drop.style.setProperty("--drop-opacity", `${random(0.22, 0.48)}`);
    field.append(drop);
  }
  const splashes = document.createElement("div");
  splashes.className = "scene-splashes";
  for (let index = 0; index < (window.innerWidth <= 680 ? 3 : 6); index += 1) {
    const splash = document.createElement("i");
    splash.style.setProperty("--splash-x", `${random(5, 95)}%`);
    splash.style.setProperty("--splash-delay", `${random(0, 2)}s`);
    splashes.append(splash);
  }
  layer.append(field, splashes);
}

function appendSnow(layer, count) {
  const field = document.createElement("div");
  field.className = "scene-snow";
  for (let index = 0; index < count; index += 1) {
    const flake = document.createElement("i");
    flake.style.setProperty("--flake-x", `${random(0, 100)}%`);
    flake.style.setProperty("--flake-size", `${random(2, 6)}px`);
    flake.style.setProperty("--flake-drift", `${random(-80, 80)}px`);
    flake.style.setProperty("--flake-delay", `${random(-8, 0)}s`);
    flake.style.setProperty("--flake-duration", `${random(7, 14)}s`);
    field.append(flake);
  }
  layer.append(field);
}

function appendMist(layer, count, reduced) {
  const field = document.createElement("div");
  field.className = "scene-mist";
  for (let index = 0; index < count; index += 1) {
    const band = document.createElement("i");
    band.style.setProperty("--mist-y", `${20 + index * 24}%`);
    band.style.setProperty("--mist-delay", `${random(-14, 0)}s`);
    band.style.setProperty("--mist-duration", `${reduced ? 0 : 20 + index * 8}s`);
    band.style.setProperty("--mist-opacity", `${0.1 + index * 0.035}`);
    field.append(band);
  }
  layer.append(field);
}

function bindVisibilityPause() {
  if (visibilityBound) return;
  visibilityBound = true;
  const update = () => {
    document.documentElement.classList.toggle("animations-paused", document.hidden);
  };
  document.addEventListener("visibilitychange", update);
  update();
}

function random(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}
