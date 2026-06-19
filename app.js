const CONFIG = {
  defaultAppName: "Mas Serradell",
  results: 10,
  safeVoltageKV: 3.0,
  nameConfig: {
    enabled: true,
  },
  sensors: [
    {
      id: "sensor-1",
      location: "Sensor 1",
      channelId: "2860284",
      readApiKey: "UU4HPDW176EZ2FLK",
      fieldName: "field1",
      nameConfig: {
        channelId: "3409739",
        readApiKey: "AZ49FG1HF9MSE8QT",
        writeApiKey: "ZMEQEY1EDVOMGPYD",
        fieldName: "field1",
      },
      color: "#174b2b",
      background: "#e8f6ef",
    },
    {
      id: "sensor-2",
      location: "Sensor 2",
      channelId: "3409705",
      readApiKey: "JEYL0NZRE5BYDY4K",
      fieldName: "field1",
      nameConfig: {
        channelId: "3409749",
        readApiKey: "0QYFD8AS99VCKC1K",
        writeApiKey: "LZ6W782CNECG1SHU",
        fieldName: "field1",
      },
      color: "#174b2b",
      background: "#f8faf9",
    },
  ],
};

const state = {
  readings: [],
  siteName: "",
  selectedSensor: null,
  sensorSummaries: {},
  sharedSiteNames: {},
};

const elements = {
  dashboard: document.getElementById("dashboard"),
  sensorMenu: document.getElementById("sensorMenu"),
  sensorCards: document.getElementById("sensorCards"),
  status: document.getElementById("status"),
  appTitle: document.getElementById("appTitle"),
  channelLabel: document.getElementById("channelLabel"),
  siteNameInput: document.getElementById("siteNameInput"),
  saveSiteNameButton: document.getElementById("saveSiteNameButton"),
  backToSensorsButton: document.getElementById("backToSensorsButton"),
  refreshButton: document.getElementById("refreshButton"),
  lastValue: document.getElementById("lastValue"),
  lastTime: document.getElementById("lastTime"),
  cowImage: document.getElementById("cowImage"),
  chart: document.getElementById("chart"),
  readingsTable: document.getElementById("readingsTable"),
};

function renderStaticText() {
  const appName = state.selectedSensor
    ? getSensorLocation(state.selectedSensor)
    : CONFIG.defaultAppName;
  const location = state.selectedSensor ? getSensorLocation(state.selectedSensor) : "";

  document.title = appName;
  elements.appTitle.textContent = appName;
  elements.channelLabel.textContent = state.selectedSensor
    ? `Mas Serradell - ${state.selectedSensor.channelId}`
    : "";
  elements.siteNameInput.value = state.siteName;
}

function loadSiteName() {
  if (!state.selectedSensor) {
    state.siteName = "";
    return;
  }

  state.siteName = state.sharedSiteNames[state.selectedSensor.id]
    || localStorage.getItem(siteNameStorageKey())
    || "";
}

async function saveSiteName() {
  if (!state.selectedSensor) {
    return;
  }

  state.siteName = elements.siteNameInput.value.trim();

  if (state.siteName) {
    localStorage.setItem(siteNameStorageKey(), state.siteName);
    state.sharedSiteNames[state.selectedSensor.id] = state.siteName;
  } else {
    localStorage.removeItem(siteNameStorageKey());
    delete state.sharedSiteNames[state.selectedSensor.id];
  }

  renderStaticText();
  renderSensorCards();
  await saveSharedSiteName(state.selectedSensor, state.siteName);
}

function siteNameStorageKey() {
  return `koniSiteName-${state.selectedSensor.id}`;
}

function renderSensorCards() {
  elements.sensorCards.innerHTML = CONFIG.sensors
    .map((sensor) => {
      const location = getSensorLocation(sensor);
      const summary = state.sensorSummaries[sensor.id];
      const lastValue = summary === undefined
        ? "Carregant ultima lectura..."
        : summary
        ? `${formatKV(summary.value)} - ${formatDateTime(summary.time)}`
        : "Sense lectures valides";

      return `
        <button
          class="sensor-card"
          type="button"
          data-sensor-id="${sensor.id}"
          style="--sensor-color: ${sensor.color}; --sensor-bg: ${sensor.background};"
        >
          <strong>${escapeHtml(location)}</strong>
          <span>Ultima lectura</span>
          <small>${escapeHtml(lastValue)}</small>
        </button>
      `;
    })
    .join("");
}

function getSensorLocation(sensor) {
  return state.sharedSiteNames[sensor.id]
    || localStorage.getItem(`koniSiteName-${sensor.id}`)
    || sensor.location;
}

function selectSensor(sensorId) {
  const sensor = CONFIG.sensors.find((item) => item.id === sensorId);

  if (!sensor) {
    return;
  }

  state.selectedSensor = sensor;
  localStorage.setItem("koniSelectedSensorId", sensor.id);
  state.readings = [];
  document.documentElement.style.setProperty("--active-sensor-color", sensor.color);
  loadSiteName();
  renderStaticText();
  clearDashboard();

  elements.sensorMenu.classList.add("is-hidden");
  elements.dashboard.classList.remove("is-hidden");
  elements.backToSensorsButton.hidden = false;
  elements.backToSensorsButton.classList.remove("is-hidden");
  elements.refreshButton.hidden = false;
  loadReadings();
}

function showSensorMenu() {
  state.selectedSensor = null;
  state.siteName = "";
  localStorage.removeItem("koniSelectedSensorId");
  renderStaticText();
  renderSensorCards();
  loadSensorSummaries();
  elements.backToSensorsButton.hidden = true;
  elements.backToSensorsButton.classList.add("is-hidden");
  elements.refreshButton.hidden = true;
  elements.dashboard.classList.add("is-hidden");
  elements.sensorMenu.classList.remove("is-hidden");
}

function clearDashboard() {
  elements.lastValue.textContent = "--";
  elements.lastTime.textContent = "--";
  renderCowState(null);
  elements.chart.innerHTML = "";
  elements.readingsTable.innerHTML = "";
  elements.status.classList.remove("error");
  elements.status.textContent = "Carregant dades...";
}

function apiUrl(sensor, results = CONFIG.results) {
  const params = new URLSearchParams({
    api_key: sensor.readApiKey,
    results: String(results),
  });

  return `https://api.thingspeak.com/channels/${sensor.channelId}/feeds.json?${params}`;
}

function configReadUrl(sensor, results = 20) {
  const params = new URLSearchParams({
    api_key: sensor.nameConfig.readApiKey,
    results: String(results),
  });

  return `https://api.thingspeak.com/channels/${sensor.nameConfig.channelId}/feeds.json?${params}`;
}

function configWriteUrl(sensor, name) {
  const params = new URLSearchParams({
    api_key: sensor.nameConfig.writeApiKey,
  });
  const fieldName = sensor.nameConfig.fieldName;

  params.set(fieldName, name);

  return `https://api.thingspeak.com/update?${params}`;
}

function isNameConfigReady() {
  return CONFIG.nameConfig.enabled;
}

function hasSharedNameField(sensor) {
  return Boolean(
    sensor.nameConfig
    && sensor.nameConfig.channelId
    && sensor.nameConfig.readApiKey
    && sensor.nameConfig.writeApiKey
    && sensor.nameConfig.fieldName
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  if (!state.selectedSensor) {
    return;
  }

  elements.status.classList.remove("error");
  elements.status.textContent = "Carregant dades...";
  elements.refreshButton.disabled = true;

  try {
    const response = await fetch(apiUrl(state.selectedSensor), { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`ThingSpeak ha respost amb l'estat ${response.status}`);
    }

    const payload = await response.json();
    const feeds = Array.isArray(payload.feeds) ? payload.feeds : [];

    state.readings = feeds
      .map((feed) => {
        const rawValue = Number(feed[state.selectedSensor.fieldName]);

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

async function loadSharedSiteNames() {
  if (!isNameConfigReady()) {
    return;
  }

  await Promise.all(CONFIG.sensors.filter(hasSharedNameField).map(async (sensor) => {
    try {
      const response = await fetch(configReadUrl(sensor), { cache: "no-store" });

      if (!response.ok) {
        throw new Error("ThingSpeak config error");
      }

      const payload = await response.json();
      const feeds = Array.isArray(payload.feeds) ? payload.feeds : [];
      const fieldName = sensor.nameConfig.fieldName;
      const feed = [...feeds].reverse().find((item) => {
        return typeof item[fieldName] === "string" && item[fieldName].trim();
      });

      if (feed) {
        state.sharedSiteNames[sensor.id] = feed[fieldName].trim();
      }
    } catch (error) {
      console.warn(`No s'ha pogut carregar el nom compartit de ${sensor.id}.`, error);
    }
  }));

  renderSensorCards();
  if (state.selectedSensor) {
    loadSiteName();
    renderStaticText();
  }
}

async function saveSharedSiteName(sensor, name) {
  if (!isNameConfigReady() || !hasSharedNameField(sensor)) {
    return;
  }

  try {
    const response = await fetch(configWriteUrl(sensor, name), { cache: "no-store" });

    if (!response.ok) {
      throw new Error("ThingSpeak config write error");
    }

    state.sharedSiteNames[sensor.id] = name;
    renderSensorCards();
    if (state.selectedSensor && state.selectedSensor.id === sensor.id) {
      loadSiteName();
      renderStaticText();
    }
  } catch (error) {
    elements.status.classList.add("error");
    elements.status.textContent = "El nom s'ha guardat en aquest dispositiu, pero no s'ha pogut compartir.";
  }
}

async function loadSensorSummaries() {
  await Promise.all(CONFIG.sensors.map(async (sensor) => {
    try {
      const response = await fetch(apiUrl(sensor, CONFIG.results), { cache: "no-store" });

      if (!response.ok) {
        throw new Error("ThingSpeak error");
      }

      const payload = await response.json();
      const feeds = Array.isArray(payload.feeds) ? payload.feeds : [];
      const lastFeed = [...feeds].reverse().find((feed) => Number.isFinite(Number(feed[sensor.fieldName])));

      if (!lastFeed) {
        state.sensorSummaries[sensor.id] = null;
        return;
      }

      state.sensorSummaries[sensor.id] = {
        value: Number(lastFeed[sensor.fieldName]),
        time: new Date(lastFeed.created_at),
      };
    } catch (error) {
      state.sensorSummaries[sensor.id] = null;
    }
  }));

  renderSensorCards();
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
  renderCowState(last.valueKV);
}

function renderCowState(valueKV) {
  if (valueKV === null || valueKV >= CONFIG.safeVoltageKV) {
    elements.cowImage.src = "cow-safe.png?v=20260619-3";
    elements.cowImage.alt = "Vaca segura darrere la tanca";
  } else {
    elements.cowImage.src = "cow-alert.png?v=20260619-3";
    elements.cowImage.alt = "Vaca escapant de la tanca";
  }
}

function renderChart() {
  const readings = [...state.readings].reverse();
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
        .line { fill: none; stroke: ${state.selectedSensor.color}; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
        .point { fill: #ffffff; stroke: ${state.selectedSensor.color}; stroke-width: 4; }
        .axis-label { fill: #667085; font-size: ${axisFontSize}px; font-weight: 700; }
        .value-label { fill: ${state.selectedSensor.color}; font-size: ${labelFontSize}px; font-weight: 700; }
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
elements.backToSensorsButton.addEventListener("click", showSensorMenu);
elements.sensorCards.addEventListener("click", (event) => {
  const card = event.target.closest("[data-sensor-id]");

  if (card) {
    selectSensor(card.dataset.sensorId);
  }
});
elements.saveSiteNameButton.addEventListener("click", saveSiteName);
elements.siteNameInput.addEventListener("focus", () => {
  elements.siteNameInput.select();
  setTimeout(() => {
    elements.siteNameInput.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, 250);
});
elements.siteNameInput.addEventListener("blur", () => {
  if (state.selectedSensor && elements.siteNameInput.value.trim() !== state.siteName) {
    saveSiteName();
  }
});
elements.siteNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveSiteName();
    elements.siteNameInput.blur();
  }
});

async function initialize() {
  renderSensorCards();
  renderStaticText();
  elements.backToSensorsButton.hidden = true;
  elements.refreshButton.hidden = true;
  await loadSharedSiteNames();
  const lastSensorId = localStorage.getItem("koniSelectedSensorId");

  if (shouldRestoreSensorOnLoad() && lastSensorId && CONFIG.sensors.some((sensor) => sensor.id === lastSensorId)) {
    selectSensor(lastSensorId);
  } else {
    localStorage.removeItem("koniSelectedSensorId");
    renderSensorCards();
    renderStaticText();
    loadSensorSummaries();
  }
}

function shouldRestoreSensorOnLoad() {
  if (!window.performance || !performance.getEntriesByType) {
    return false;
  }

  const entries = performance.getEntriesByType("navigation");
  const navigationType = entries.length ? entries[0].type : "";

  return navigationType === "reload";
}

initialize();
