const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_SIZE = 256;

/**
 * Lightweight slippy map for the haze page. It keeps the site dependency-free
 * while adding translucent AQI heat zones and clickable index labels.
 */
export function createAqiMap({
  container,
  tiles,
  offline,
  center,
  zoom = 6,
  minZoom = 5,
  maxZoom = 12,
  onCenterChange,
  onLocationPick,
  onPointSelect,
}) {
  let latitude = Number(center.latitude);
  let longitude = Number(center.longitude);
  let currentZoom = zoom;
  let points = [];
  let stage = null;
  let drag = null;
  let tileSuccesses = 0;
  let tileFailures = 0;

  const render = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    const scale = 2 ** currentZoom;
    const centerWorldX = longitudeToWorldX(longitude, currentZoom);
    const centerWorldY = latitudeToWorldY(latitude, currentZoom);
    const centerTileX = Math.floor(centerWorldX / TILE_SIZE);
    const centerTileY = Math.floor(centerWorldY / TILE_SIZE);
    const columns = Math.max(3, Math.ceil(width / TILE_SIZE) + 2);
    const rows = Math.max(3, Math.ceil(height / TILE_SIZE) + 2);
    const startTileX = centerTileX - Math.floor(columns / 2);
    const startTileY = Math.max(0, centerTileY - Math.floor(rows / 2));
    const endTileY = Math.min(scale - 1, centerTileY + Math.floor(rows / 2));
    const stageStartX = startTileX * TILE_SIZE;
    const stageStartY = startTileY * TILE_SIZE;

    const nextStage = document.createElement("div");
    nextStage.className = "haze-map-stage";
    nextStage.style.width = `${columns * TILE_SIZE}px`;
    nextStage.style.height = `${(endTileY - startTileY + 1) * TILE_SIZE}px`;
    nextStage.style.left = `${width / 2 - (centerWorldX - stageStartX)}px`;
    nextStage.style.top = `${height / 2 - (centerWorldY - stageStartY)}px`;

    tileSuccesses = 0;
    tileFailures = 0;
    if (offline) offline.hidden = true;

    for (let row = 0; row < rows; row += 1) {
      const tileY = startTileY + row;
      if (tileY > endTileY) break;
      for (let column = 0; column < columns; column += 1) {
        const tileX = startTileX + column;
        const wrappedX = ((tileX % scale) + scale) % scale;
        const image = document.createElement("img");
        image.className = "map-tile";
        image.alt = "";
        image.width = TILE_SIZE;
        image.height = TILE_SIZE;
        image.draggable = false;
        image.loading = "eager";
        image.referrerPolicy = "strict-origin-when-cross-origin";
        image.src = TILE_URL.replace("{z}", String(currentZoom))
          .replace("{x}", String(wrappedX))
          .replace("{y}", String(tileY));
        image.style.left = `${column * TILE_SIZE}px`;
        image.style.top = `${row * TILE_SIZE}px`;
        image.addEventListener("load", () => {
          tileSuccesses += 1;
          image.classList.add("is-loaded");
          if (offline) offline.hidden = true;
        });
        image.addEventListener("error", () => {
          tileFailures += 1;
        });
        nextStage.append(image);
      }
    }

    points.forEach((point, index) => {
      if (!Number.isFinite(Number(point.aqi)) || !point.category) return;
      const pointX = longitudeToWorldX(point.longitude, currentZoom);
      const pointY = latitudeToWorldY(point.latitude, currentZoom);
      const relativeX = pointX - stageStartX;
      const relativeY = pointY - stageStartY;

      const heat = document.createElement("span");
      heat.className = `haze-map-heat level-${point.category.level}`;
      const heatSize = Math.min(
        300,
        68 + Math.max(currentZoom - 4, 0) * 38 + point.category.level * 18,
      );
      heat.style.left = `${relativeX}px`;
      heat.style.top = `${relativeY}px`;
      heat.style.width = `${heatSize}px`;
      heat.style.height = `${heatSize}px`;
      heat.style.setProperty("--point-color", point.category.color);
      heat.style.setProperty("--heat-delay", `${(index % 7) * -0.55}s`);
      nextStage.append(heat);

      if (currentZoom < (point.labelMinZoom ?? 7)) return;
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = `haze-map-index${point.category.key === "moderate" ? " is-light" : ""}`;
      marker.style.left = `${relativeX}px`;
      marker.style.top = `${relativeY}px`;
      marker.style.setProperty("--point-color", point.category.color);
      marker.style.setProperty("--marker-delay", `${(index % 9) * -0.08}s`);
      marker.textContent = Math.round(point.aqi);
      marker.title = `${point.name}: estimated AQI ${Math.round(point.aqi)} · ${point.category.label}`;
      marker.setAttribute(
        "aria-label",
        `${point.name}, estimated AQI ${Math.round(point.aqi)}, ${point.category.label}. Show haze details.`,
      );
      marker.addEventListener("click", (event) => {
        event.stopPropagation();
        onPointSelect?.(point);
      });
      marker.addEventListener("pointerdown", (event) => event.stopPropagation());
      nextStage.append(marker);
    });

    tiles.replaceChildren(nextStage);
    stage = nextStage;

    window.setTimeout(() => {
      if (stage === nextStage && tileSuccesses === 0 && tileFailures > 0 && offline) {
        offline.hidden = false;
      }
    }, 4_500);
  };

  const updateCenter = (settled = false, source = "sync") => {
    onCenterChange?.({ latitude, longitude, zoom: currentZoom, settled, source });
  };

  const setCenter = (place, options = {}) => {
    latitude = clamp(Number(place.latitude), -85, 85);
    longitude = wrapLongitude(Number(place.longitude));
    if (Number.isFinite(Number(options.zoom))) {
      currentZoom = clamp(Number(options.zoom), minZoom, maxZoom);
    }
    render();
    updateCenter(true, "set");
  };

  const zoomBy = (delta) => {
    const nextZoom = clamp(currentZoom + delta, minZoom, maxZoom);
    if (nextZoom === currentZoom) return;
    currentZoom = nextZoom;
    render();
    updateCenter(true, "zoom");
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0 || event.target.closest("button, a")) return;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLatitude: latitude,
      startLongitude: longitude,
      stageLeft: Number.parseFloat(stage?.style.left) || 0,
      stageTop: Number.parseFloat(stage?.style.top) || 0,
      moved: false,
    };
    container.setPointerCapture?.(event.pointerId);
    container.classList.add("is-dragging");
  };

  const handlePointerMove = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) drag.moved = true;
    if (!drag.moved) return;

    event.preventDefault();
    if (stage) {
      stage.style.left = `${drag.stageLeft + deltaX}px`;
      stage.style.top = `${drag.stageTop + deltaY}px`;
    }
    const centerX = longitudeToWorldX(drag.startLongitude, currentZoom) - deltaX;
    const centerY = latitudeToWorldY(drag.startLatitude, currentZoom) - deltaY;
    longitude = worldXToLongitude(centerX, currentZoom);
    latitude = worldYToLatitude(centerY, currentZoom);
    updateCenter(false, "drag");
  };

  const handlePointerUp = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved;
    drag = null;
    container.classList.remove("is-dragging");
    container.releasePointerCapture?.(event.pointerId);

    if (moved) {
      render();
      updateCenter(true, "drag");
      onLocationPick?.({ latitude, longitude });
      return;
    }

    const rect = container.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    latitude = worldYToLatitude(
      latitudeToWorldY(latitude, currentZoom) + offsetY,
      currentZoom,
    );
    longitude = worldXToLongitude(
      longitudeToWorldX(longitude, currentZoom) + offsetX,
      currentZoom,
    );
    render();
    updateCenter(true, "click");
    onLocationPick?.({ latitude, longitude });
  };

  const handlePointerCancel = () => {
    drag = null;
    container.classList.remove("is-dragging");
    render();
  };

  const handleKeyDown = (event) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(1);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomBy(-1);
    } else if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      let x = longitudeToWorldX(longitude, currentZoom);
      let y = latitudeToWorldY(latitude, currentZoom);
      if (event.key === "ArrowLeft") x -= 70;
      if (event.key === "ArrowRight") x += 70;
      if (event.key === "ArrowUp") y -= 70;
      if (event.key === "ArrowDown") y += 70;
      longitude = worldXToLongitude(x, currentZoom);
      latitude = worldYToLatitude(y, currentZoom);
      render();
      updateCenter(true, "keyboard");
      onLocationPick?.({ latitude, longitude });
    }
  };

  container.addEventListener("pointerdown", handlePointerDown);
  container.addEventListener("pointermove", handlePointerMove);
  container.addEventListener("pointerup", handlePointerUp);
  container.addEventListener("pointercancel", handlePointerCancel);
  container.addEventListener("keydown", handleKeyDown);

  const resizeObserver = new ResizeObserver(render);
  resizeObserver.observe(container);
  render();
  updateCenter(true, "init");

  return {
    setPoints(nextPoints) {
      points = Array.isArray(nextPoints) ? [...nextPoints] : [];
      render();
    },
    setCenter,
    zoomIn: () => zoomBy(1),
    zoomOut: () => zoomBy(-1),
    recenter: () =>
      setCenter(
        {
          latitude: center.latitude,
          longitude: center.longitude,
        },
        { zoom },
      ),
    getCenter: () => ({ latitude, longitude, zoom: currentZoom }),
    destroy() {
      resizeObserver.disconnect();
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", handlePointerCancel);
      container.removeEventListener("keydown", handleKeyDown);
    },
  };
}

function latitudeToWorldY(latitude, zoom) {
  const clamped = clamp(latitude, -85.05112878, 85.05112878);
  const sin = Math.sin((clamped * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * TILE_SIZE * 2 ** zoom;
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
