export const AIR_QUALITY_API = "https://air-quality-api.open-meteo.com/v1/air-quality";

export const MALAYSIA_AQI_BANDS = [
  {
    key: "good",
    label: "Good",
    min: 0,
    max: 50,
    level: 0,
    verdict: "Safe outdoors",
    color: "#4f9668",
  },
  {
    key: "moderate",
    label: "Moderate",
    min: 51,
    max: 100,
    level: 1,
    verdict: "Be careful",
    color: "#c6a235",
  },
  {
    key: "unhealthy",
    label: "Unhealthy",
    min: 101,
    max: 200,
    level: 2,
    verdict: "Not safe outdoors",
    color: "#d8783e",
  },
  {
    key: "very-unhealthy",
    label: "Very Unhealthy",
    min: 201,
    max: 300,
    level: 3,
    verdict: "Not safe outdoors",
    color: "#c24b4b",
  },
  {
    key: "hazardous",
    label: "Hazardous",
    min: 301,
    max: Number.POSITIVE_INFINITY,
    level: 4,
    verdict: "Not safe outdoors",
    color: "#785082",
  },
];

export const MALAYSIAN_CITIES = [
  { name: "Kuala Lumpur", admin1: "Kuala Lumpur", latitude: 3.139, longitude: 101.6869 },
  { name: "George Town", admin1: "Penang", latitude: 5.4141, longitude: 100.3288 },
  { name: "Johor Bahru", admin1: "Johor", latitude: 1.4927, longitude: 103.7414 },
  { name: "Ipoh", admin1: "Perak", latitude: 4.5975, longitude: 101.0901 },
  { name: "Shah Alam", admin1: "Selangor", latitude: 3.0738, longitude: 101.5183 },
  { name: "Kota Kinabalu", admin1: "Sabah", latitude: 5.9804, longitude: 116.0735 },
  { name: "Kuching", admin1: "Sarawak", latitude: 1.5533, longitude: 110.3592 },
  { name: "Malacca", admin1: "Malacca", latitude: 2.1896, longitude: 102.2501 },
  { name: "Alor Setar", admin1: "Kedah", latitude: 6.1184, longitude: 100.3667 },
  { name: "Kuantan", admin1: "Pahang", latitude: 3.8077, longitude: 103.326 },
  { name: "Kota Bharu", admin1: "Kelantan", latitude: 6.1254, longitude: 102.2386 },
  { name: "Seremban", admin1: "Negeri Sembilan", latitude: 2.7297, longitude: 101.9381 },
];

const CURRENT_FIELDS = [
  "us_aqi",
  "us_aqi_pm2_5",
  "us_aqi_pm10",
  "us_aqi_ozone",
  "us_aqi_nitrogen_dioxide",
  "us_aqi_sulphur_dioxide",
  "us_aqi_carbon_monoxide",
  "pm2_5",
  "pm10",
  "ozone",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "carbon_monoxide",
].join(",");

const DOMINANT_POLLUTANTS = [
  { key: "pm2_5", field: "us_aqi_pm2_5", label: "PM2.5", unit: "µg/m³" },
  { key: "pm10", field: "us_aqi_pm10", label: "PM10", unit: "µg/m³" },
  { key: "ozone", field: "us_aqi_ozone", label: "Ozone", unit: "µg/m³" },
  {
    key: "nitrogen_dioxide",
    field: "us_aqi_nitrogen_dioxide",
    label: "NO₂",
    unit: "µg/m³",
  },
  {
    key: "sulphur_dioxide",
    field: "us_aqi_sulphur_dioxide",
    label: "SO₂",
    unit: "µg/m³",
  },
  {
    key: "carbon_monoxide",
    field: "us_aqi_carbon_monoxide",
    label: "CO",
    unit: "µg/m³",
  },
];

export function categoryForAqi(value) {
  const aqi = Number(value);
  if (!Number.isFinite(aqi)) return null;
  if (aqi <= 50) return MALAYSIA_AQI_BANDS[0];
  if (aqi <= 100) return MALAYSIA_AQI_BANDS[1];
  if (aqi <= 200) return MALAYSIA_AQI_BANDS[2];
  if (aqi <= 300) return MALAYSIA_AQI_BANDS[3];
  return MALAYSIA_AQI_BANDS[4];
}

export function dominantPollutant(current = {}) {
  const candidates = DOMINANT_POLLUTANTS.map((pollutant) => ({
    ...pollutant,
    index: Number(current[pollutant.field]),
    concentration: Number(current[pollutant.key]),
  })).filter((pollutant) => Number.isFinite(pollutant.index));

  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.index - a.index)[0];
}

export function healthAdvice(category) {
  const level = category?.level ?? 0;
  const advice = {
    summary: "",
    children: "",
    olderAdults: "",
    sensitive: "",
    mask: "",
    exercise: "",
    windows: "",
  };

  if (level === 0) {
    return {
      summary: "Air quality looks acceptable. Most people can continue normal outdoor plans.",
      children: "Outdoor play is generally safe; stop if a child coughs or feels unwell.",
      olderAdults: "No special restriction, but monitor any breathing or heart symptoms.",
      sensitive:
        "People with asthma, heart or lung conditions should keep reliever medication nearby.",
      mask: "An N95 is not normally needed.",
      exercise: "Outdoor exercise is generally fine.",
      windows: "Ventilation is generally fine.",
    };
  }

  if (level === 1) {
    return {
      summary:
        "Air quality is acceptable for most people, but sensitive groups should take it easier outdoors.",
      children: "Limit long or intense outdoor play, especially near busy roads.",
      olderAdults: "Reduce prolonged or strenuous outdoor activity.",
      sensitive:
        "Follow your asthma or heart/lung action plan and avoid intense outdoor exercise.",
      mask: "Consider a fitted N95 if haze or smoke is noticeable.",
      exercise: "Sensitive groups should reduce strenuous outdoor exercise.",
      windows: "Close windows if smoke or haze is noticeable.",
    };
  }

  if (level === 2) {
    return {
      summary:
        "Air quality is unhealthy. Reduce outdoor exposure, especially for children and vulnerable adults.",
      children: "Keep children indoors; outdoor play is not recommended.",
      olderAdults: "Stay indoors where possible and avoid physical exertion.",
      sensitive:
        "People with asthma, heart or lung conditions should stay indoors and follow their medical plan.",
      mask: "Wear a fitted N95 outdoors and limit time outside.",
      exercise: "Avoid outdoor exercise.",
      windows: "Keep windows closed and use an air purifier if available.",
    };
  }

  return {
    summary:
      "Air quality is very unhealthy to hazardous. Avoid outdoor exposure and protect indoor air.",
    children: "Do not let children play outdoors.",
    olderAdults: "Stay indoors, avoid exertion and seek help if symptoms worsen.",
    sensitive:
      "Avoid all outdoor exposure. Follow your medical action plan and seek medical help for breathing difficulty.",
    mask: "Use a fitted N95 only if you must go outside.",
    exercise: "Do not exercise outdoors.",
    windows: "Keep windows closed, seal gaps where practical and run a purifier.",
  };
}

export function buildAirQualityUrl(place) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: CURRENT_FIELDS,
    hourly: "us_aqi,pm2_5,pm10",
    timezone: "auto",
    forecast_days: "3",
  });
  return `${AIR_QUALITY_API}?${params}`;
}

export function buildRankingUrl(cities = MALAYSIAN_CITIES) {
  const params = new URLSearchParams({
    latitude: cities.map((city) => city.latitude).join(","),
    longitude: cities.map((city) => city.longitude).join(","),
    current: "us_aqi,us_aqi_pm2_5,pm2_5,pm10",
    timezone: "Asia/Kuala_Lumpur",
  });
  return `${AIR_QUALITY_API}?${params}`;
}

export function hourlyWindow(data, limit = 48) {
  const times = data?.hourly?.time;
  const currentTime = data?.current?.time;
  if (!Array.isArray(times) || !times.length || !currentTime) return [];

  let startIndex = times.findIndex(
    (time) => time.slice(0, 13) === currentTime.slice(0, 13),
  );
  if (startIndex < 0) startIndex = times.findIndex((time) => time >= currentTime);
  if (startIndex < 0) startIndex = 0;

  return times.slice(startIndex, startIndex + limit).map((time, offset) => {
    const index = startIndex + offset;
    return {
      time,
      aqi: Number(data.hourly.us_aqi?.[index]),
      pm25: Number(data.hourly.pm2_5?.[index]),
      pm10: Number(data.hourly.pm10?.[index]),
    };
  });
}

export function findBestOutdoorWindow(data) {
  const series = hourlyWindow(data, 40);
  if (!series.length) return null;

  const currentDate = data.current.time.slice(0, 10);
  const currentHour = Number(data.current.time.slice(11, 13));
  const todayCandidates = [];
  const tomorrowCandidates = [];

  for (let index = 0; index < series.length - 1; index += 1) {
    const start = series[index];
    const end = series[index + 1];
    const hour = Number(start.time.slice(11, 13));
    const date = start.time.slice(0, 10);
    if (hour < 6 || hour > 20) continue;
    if (!Number.isFinite(start.aqi) || !Number.isFinite(end.aqi)) continue;

    const candidate = {
      start,
      end,
      average: (start.aqi + end.aqi) / 2,
      dayLabel: date === currentDate ? "today" : "tomorrow",
    };

    if (date === currentDate && hour >= currentHour) {
      todayCandidates.push(candidate);
    } else if (date !== currentDate) {
      tomorrowCandidates.push(candidate);
    }
  }

  const pool = todayCandidates.length ? todayCandidates : tomorrowCandidates;
  if (!pool.length) return null;
  return pool.sort((a, b) => a.average - b.average)[0];
}

export function formatBestWindow(window) {
  if (!window) return "No clear outdoor window";
  const startHour = Number(window.start.time.slice(11, 13));
  const endHour = Number(window.end.time.slice(11, 13)) + 1;
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return "No clear outdoor window";
  return `${formatHourRangeNumbers(startHour, endHour)} ${window.dayLabel}`;
}

export function formatHourRange(startTime, endTime) {
  const startHour = Number(startTime?.slice(11, 13));
  const endHour = Number(endTime?.slice(11, 13));
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return "--";
  return formatHourRangeNumbers(startHour, endHour);
}

export function formatHourRangeNumbers(startHour, endHour) {
  const startPeriod = startHour >= 12 ? "PM" : "AM";
  const endPeriod = endHour >= 12 ? "PM" : "AM";
  const startDisplay = startHour % 12 || 12;
  const endDisplay = endHour % 12 || 12;
  return startPeriod === endPeriod
    ? `${startDisplay}–${endDisplay} ${endPeriod}`
    : `${startDisplay} ${startPeriod}–${endDisplay} ${endPeriod}`;
}
