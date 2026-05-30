const CONFIG = {
  defaultAppName: "Mas Serradell",
  channelId: "2860284",
  fieldName: "field1",
  readApiKey: "UU4HPDW176EZ2FLK",
  results: 10,
};

const state = {
  readings: [],
  siteName: "",
};

const elements = {
  status: document.getElementById("status"),
  appTitle: document.getElementById("appTitle"),
  channelLabel: document.getElementById("channelLabel"),
  siteNameInput: document.getElementById("siteNameInput"),
  saveSiteNameButton: document.getElementById("saveSiteNameButton"),
  refreshButton: document.getElementById("refreshButton"),
  lastValue: document.getElementById("lastValue"),
  lastTime: document.getElementById("lastTime"),
  chart: document.getElementById("chart"),
  readingsTable: document.getElementById("readingsTable"),
};

function renderStaticText() {
  const appName = state.siteName || CONFIG.defaultAppName;

  document.title = appName;
  elements.appTitle.textContent = appName;
  elements.channelLabel.textContent = `Mas Serradell - Canal ${CONFIG.channelId}`;
  elements.siteNameInput.value = state.siteName;
}

function loadSiteName() {
  state.siteName = localStorage.getItem("koniSiteName") || "";
}

function saveSiteName() {
  state.siteName = elements.siteNameInput.value.trim();

  if (state.siteName) {
    localStorage.setItem("koniSiteName", state.siteName);
  } else {
    localStorage.removeItem("koniSiteName");
  }

  renderStaticText();
}

function apiUrl() {
  const params = new URLSearchParams({
    api_key: CONFIG.readApiKey,
    results: String(CONFIG.results),
  });

  return `https://api.thingspeak.com/channels/${CONFIG.channelId}/feeds.json?${params}`;
}

function formatKV(value) {
  return `${(value / 1000).toFixed(1)} kV`;
}

function isToday(date) {
  const now = new Date();

  return date.getDate() === now.getDate()
    && date.getMonth() === now.getMonth()
    && date.getFullYear() === now.getFullYear();
}

function formatDateTime(date) {
  const time = new Intl.DateTimeFormat("ca-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);

  if (isToday(date)) {
    return `Avui ${time}`;
  }

  const day = new Intl.DateTimeFormat("ca-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  return `${day} ${time}`;
}

function formatShortTime(date) {
  const time = new Intl.DateTimeFormat("ca-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (isToday(date)) {
    return `Avui ${time}`;
  }

  const day = new Intl.DateTimeFormat("ca-ES", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  return `${day} ${time}`;
}

async function loadReadings() {
  elements.status.classList.remove("error");
  elements.status.textContent = "Carregant dades...";
  elements.refreshButton.disabled = true;

  try {
    const response = await fetch(apiUrl(), { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`ThingSpeak ha respost amb l'estat ${response.status}`);
    }

    const payload = await response.json();
    const feeds = Array.isArray(payload.feeds) ? payload.feeds : [];

    state.readings = feeds
      .map((feed) => {
        const rawValue = Number(feed[CONFIG.fieldName]);

        if (!Number.isFinite(rawValue)) {
          return null;
        }

        const utcTime = new Date(feed.created_at);

        return {
          value: rawValue,
          valueKV: rawValue / 1000,
          time: utcTime,
        };
      })
      .filter(Boolean);

    if (state.readings.length === 0) {
      throw new Error("No hi ha lectures valides per mostrar.");
    }

    render();
    elements.status.textContent = `Actualitzat: ${formatDateTime(new Date())}`;
  } catch (error) {
    elements.status.textContent = `Error en carregar les dades: ${error.message}`;
    elements.status.classList.add("error");
  } finally {
    elements.refreshButton.disabled = false;
  }
}

function render() {
  renderLastReading();
  renderChart();
  renderTable();
}

function renderLastReading() {
  const readings = state.readings;
  const last = readings[readings.length - 1];

  elements.lastValue.textContent = formatKV(last.value);
  elements.lastTime.textContent = formatDateTime(last.time);
}

function renderChart() {
  const readings = state.readings;
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const width = isMobile ? 680 : 940;
  const height = 430;
  const padding = {
    top: 36,
    right: isMobile ? 18 : 26,
    bottom: 86,
    left: isMobile ? 54 : 64,
  };
  const labelFontSize = isMobile ? 17 : 15;
  const axisFontSize = isMobile ? 16 : 14;
  const xFontSize = isMobile ? 15 : 13;

  const minY = Math.min(...readings.map((item) => item.valueKV));
  const maxY = Math.max(...readings.map((item) => item.valueKV));
  const rangeY = maxY - minY || 1;
  const chartMinY = minY - rangeY * 0.2;
  const chartMaxY = maxY + rangeY * 0.28;
  const chartRangeY = chartMaxY - chartMinY;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const xFor = (index) => {
    if (readings.length === 1) {
      return padding.left + innerWidth / 2;
    }

    return padding.left + (index / (readings.length - 1)) * innerWidth;
  };

  const yFor = (value) => {
    return padding.top + ((chartMaxY - value) / chartRangeY) * innerHeight;
  };

  const points = readings.map((item, index) => ({
    ...item,
    x: xFor(index),
    y: yFor(item.valueKV),
  }));

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const yTicks = 4;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, index) => {
    const value = chartMinY + (chartRangeY / yTicks) * index;
    const y = yFor(value);

    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"></line>
      <text x="${padding.left - 10}" y="${y + 5}" class="axis-label" text-anchor="end">${value.toFixed(1)}</text>
    `;
  }).join("");

  const pointNodes = points.map((point, index) => `
    <g>
      <circle cx="${point.x}" cy="${point.y}" r="6" class="point"></circle>
      <text x="${point.x}" y="${point.y - 13}" class="value-label" text-anchor="middle">${point.valueKV.toFixed(1)} kV</text>
      <text x="${point.x}" y="${height - 52}" class="x-label" text-anchor="middle" transform="rotate(-35 ${point.x} ${height - 52})">${formatShortTime(point.time)}</text>
      <text x="${point.x}" y="${height - 16}" class="index-label" text-anchor="middle">${index + 1}</text>
    </g>
  `).join("");

  elements.chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <style>
        .grid-line { stroke: #d9e2ef; stroke-width: 1; }
        .axis { stroke: #667085; stroke-width: 1.3; }
        .line { fill: none; stroke: #174b2b; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
        .point { fill: #ffffff; stroke: #174b2b; stroke-width: 4; }
        .axis-label { fill: #667085; font-size: ${axisFontSize}px; font-weight: 700; }
        .value-label { fill: #174b2b; font-size: ${labelFontSize}px; font-weight: 700; }
        .x-label { fill: #172033; font-size: ${xFontSize}px; font-weight: 700; }
        .index-label { fill: #667085; font-size: 12px; }
      </style>
      ${gridLines}
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="axis"></line>
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="axis"></line>
      <path d="${path}" class="line"></path>
      ${pointNodes}
      <text x="18" y="${padding.top + 8}" class="axis-label" transform="rotate(-90 18 ${padding.top + 8})">kV</text>
    </svg>
  `;
}

function renderTable() {
  const readingsNewestFirst = [...state.readings].reverse();

  elements.readingsTable.innerHTML = readingsNewestFirst
    .map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${formatDateTime(item.time)}</td>
        <td><strong>${formatKV(item.value)}</strong></td>
      </tr>
    `)
    .join("");
}

elements.refreshButton.addEventListener("click", loadReadings);
elements.saveSiteNameButton.addEventListener("click", saveSiteName);
elements.siteNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveSiteName();
  }
});

loadSiteName();
renderStaticText();
loadReadings();
