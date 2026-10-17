import test from "node:test";
import assert from "node:assert/strict";
import {
  countryFlag,
  formatPlaceLabel,
  formatPlaceRegion,
  normalizeSearchPlace,
  parseCoordinates,
} from "../place-search.js";

test("normalizes Open-Meteo geocoding results without changing coordinates", () => {
  const place = normalizeSearchPlace({
    id: 1735161,
    name: "Kuala Lumpur",
    latitude: 3.1412,
    longitude: 101.68653,
    admin1: "Kuala Lumpur",
    country: "Malaysia",
    country_code: "MY",
    timezone: "Asia/Kuala_Lumpur",
  });

  assert.equal(place.name, "Kuala Lumpur");
  assert.equal(place.countryCode, "MY");
  assert.equal(place.latitude, 3.1412);
  assert.equal(place.longitude, 101.68653);
});

test("formats City, State, Country while avoiding repeated labels", () => {
  assert.equal(
    formatPlaceLabel({
      name: "George Town",
      admin1: "Penang",
      country: "Malaysia",
    }),
    "George Town, Penang, Malaysia",
  );
  assert.equal(
    formatPlaceLabel({
      name: "Kuala Lumpur",
      admin1: "Kuala Lumpur",
      country: "Malaysia",
    }),
    "Kuala Lumpur, Malaysia",
  );
  assert.equal(
    formatPlaceRegion({
      name: "George Town",
      admin1: "Penang",
      country: "Malaysia",
    }),
    "Penang, Malaysia",
  );
});

test("parses coordinates and rejects invalid values", () => {
  assert.deepEqual(parseCoordinates("3.1412, 101.68653"), {
    latitude: 3.1412,
    longitude: 101.68653,
  });
  assert.deepEqual(parseCoordinates("-6.2 106.8"), {
    latitude: -6.2,
    longitude: 106.8,
  });
  assert.equal(parseCoordinates("91, 10"), null);
  assert.equal(parseCoordinates("not coordinates"), null);
});

test("converts a country code to a flag", () => {
  assert.equal(countryFlag("MY"), "🇲🇾");
  assert.equal(countryFlag(""), "");
});
