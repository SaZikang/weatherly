# Weatherly

A two-page weather dashboard designed to run as a static website: live weather and a Malaysia
haze/air-quality outlook. Search for a city, pinpoint any location on the map, and pin favorite
places to the top of the weather page.

![No build step](https://img.shields.io/badge/build-none-203b2e)
![Open-Meteo](https://img.shields.io/badge/weather-Open--Meteo-3184a6)
![GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-d8f46b)

## Features

- Live current conditions, 24-hour forecast, and 7-day forecast.
- Keyless weather data from [Open-Meteo](https://open-meteo.com/).
- Air quality from the Open-Meteo Air Quality API.
- Malaysia haze page with estimated AQI, PM2.5, PM10, dominant pollutant, health guidance,
  a 48-hour forecast, and city ranking.
- Interactive Malaysia haze map with translucent AQI heat zones, coloured index labels,
  click/drag location picking, zoom, and reusable map search.
- Light, dark, and system themes with a no-flash first paint and persisted choice.
- Conditional weather scenes for clear day/night, clouds, rain, thunderstorms, snow, and haze.
- Shareable location URLs, first-visit geolocation, count-up values, and themed map/chart colors.
- Alerts when the estimated Malaysia AQI category reaches Unhealthy or worse.
- Search by city or region, with keyboard-friendly suggestions.
- Interactive OpenStreetMap with click-to-center, drag-to-move, and zoom controls.
- Favorites saved in `localStorage` and always shown in a pinned rail at the top.
- Browser geolocation support.
- Celsius/Fahrenheit switching.
- Responsive layout, reduced-motion support, accessible labels, and offline error handling.
- No framework, bundler, API key, backend, or npm dependencies.

## Run locally

Node 18 or newer:

```bash
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173).
The haze page is at [http://127.0.0.1:4173/haze.html](http://127.0.0.1:4173/haze.html).

Python is another option:

```bash
python3 -m http.server 4173
```

The app needs internet access for live weather, place search, reverse geocoding, and map tiles.
Geolocation requires `localhost` or an HTTPS deployment.

## Connect this project to GitHub

The local folder is already a Git repository with the intended remote configured as
`https://github.com/SaZikang/weatherly.git`.

1. Create an empty, public repository named `weatherly` at
   [github.com/new](https://github.com/new). Do not initialize it with a README.
2. Authenticate GitHub CLI if needed:

   ```bash
   gh auth login
   ```

3. Confirm the remote and push:

   ```bash
   git remote -v
   git push -u origin main
   ```

4. In the repository, open **Settings → Pages**, set **Source** to **GitHub Actions**, and
   run the **Deploy weather app to GitHub Pages** workflow if it has not started automatically.

5. Update `repositoryUrl` in [`config.js`](./config.js) if your repository uses a different
   owner or name.

The included [Pages workflow](./.github/workflows/pages.yml) deploys the site whenever `main`
is updated.

## Project structure

```text
weatherly/
├── .github/workflows/pages.yml  # GitHub Pages deployment
├── air-quality.js               # AQI bands, health guidance, and forecast helpers
├── app.js                       # Weather, favorites, and map logic
├── config.js                    # Repository URL and app defaults
├── favicon.svg
├── haze.html                    # Malaysia haze and air-quality page
├── haze.js                      # Haze page data loading and UI
├── haze-map.js                  # Dependency-free AQI heat map component
├── index.html
├── og-weatherly.png             # Open Graph social preview
├── package.json
├── place-search.js              # Reusable debounced place autocomplete
├── server.mjs                   # Dependency-free local static server
├── tests/                       # Node tests for search and air-quality helpers
├── theme-init.js                # Pre-paint theme selection
├── theme.js                     # Light/dark/system theme picker
├── theme.css                    # Central theme variables and dark overrides
├── weather-animations.js        # Conditional GPU-friendly weather scenes
└── styles.css
```

## Data and privacy

Weather and search requests go directly from the browser to Open-Meteo. Map tiles come from
OpenStreetMap, and map clicks use BigDataCloud's free reverse-geocode client endpoint. No API keys
or secrets are stored in this project. Favorites and temperature-unit preferences remain in the
visitor's browser.

The haze page uses Open-Meteo's modelled air-quality data, labelled as an estimate. Malaysia's
official DOE APIMS service currently redirects to the MyEQMS portal and does not expose a public
feed with cross-origin access for this static GitHub Pages site. Estimates must not replace
official DOE, MOH, or local authority advisories.

Please review the [Open-Meteo terms](https://open-meteo.com/en/terms), the
[OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/), and the
[BigDataCloud terms](https://www.bigdatacloud.com/terms) before running a high-traffic public
deployment. For a production app with heavy map traffic, use a dedicated tile provider.
