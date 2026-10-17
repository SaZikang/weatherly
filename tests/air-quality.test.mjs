import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAirQualityUrl,
  categoryForAqi,
  dominantPollutant,
  findBestOutdoorWindow,
  formatBestWindow,
  healthAdvice,
  hourlyWindow,
} from "../air-quality.js";

test("applies the requested Malaysia AQI colour bands", () => {
  assert.equal(categoryForAqi(0).key, "good");
  assert.equal(categoryForAqi(50).key, "good");
  assert.equal(categoryForAqi(51).key, "moderate");
  assert.equal(categoryForAqi(100).key, "moderate");
  assert.equal(categoryForAqi(101).key, "unhealthy");
  assert.equal(categoryForAqi(200).key, "unhealthy");
  assert.equal(categoryForAqi(201).key, "very-unhealthy");
  assert.equal(categoryForAqi(300).key, "very-unhealthy");
  assert.equal(categoryForAqi(301).key, "hazardous");
});

test("selects the pollutant with the highest estimated sub-index", () => {
  const pollutant = dominantPollutant({
    us_aqi_pm2_5: 82,
    us_aqi_pm10: 44,
    us_aqi_ozone: 61,
    pm2_5: 27.1,
  });
  assert.equal(pollutant.label, "PM2.5");
  assert.equal(pollutant.index, 82);
});

test("builds air quality requests with exact coordinates", () => {
  const url = new URL(
    buildAirQualityUrl({
      latitude: 5.41123,
      longitude: 100.33543,
    }),
  );
  assert.equal(url.searchParams.get("latitude"), "5.41123");
  assert.equal(url.searchParams.get("longitude"), "100.33543");
  assert.match(url.searchParams.get("hourly"), /us_aqi/);
});

test("health advice becomes stricter as the category worsens", () => {
  assert.match(healthAdvice(categoryForAqi(25)).exercise, /generally fine/i);
  assert.match(healthAdvice(categoryForAqi(75)).exercise, /reduce/i);
  assert.match(healthAdvice(categoryForAqi(150)).exercise, /avoid/i);
  assert.match(healthAdvice(categoryForAqi(350)).windows, /keep windows closed/i);
});

test("finds the lowest two-hour daytime AQI window", () => {
  const times = [];
  const usAqi = [];
  for (let hour = 0; hour < 24; hour += 1) {
    times.push(`2026-10-18T${String(hour).padStart(2, "0")}:00`);
    usAqi.push(hour >= 14 && hour <= 16 ? 30 : 80);
  }
  const data = {
    current: { time: "2026-10-18T10:00" },
    hourly: {
      time: times,
      us_aqi: usAqi,
      pm2_5: usAqi,
      pm10: usAqi,
    },
  };

  assert.equal(hourlyWindow(data).length, 14);
  const best = findBestOutdoorWindow(data);
  assert.equal(best.start.time, "2026-10-18T14:00");
  assert.equal(formatBestWindow(best), "2–4 PM today");
});
