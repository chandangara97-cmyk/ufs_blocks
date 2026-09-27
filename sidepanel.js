let records = [];
let columns = [];
let mapping = {}; // { columnName: cssSelector }
let currentIndex = 0;
let hostname = "";

const fileInput = document.getElementById("fileInput");
const mapList = document.getElementById("mapList");
const recordBox = document.getElementById("recordBox");
const fieldsEl = document.getElementById("fields");
const idxLabel = document.getElementById("idxLabel");
const statusEl = document.getElementById("status");

function setStatus(msg) {
  statusEl.textContent = msg;
  if (msg) setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ""; }, 4000);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  const tab = await getActiveTab();
  if (tab && tab.url) {
    try { hostname = new URL(tab.url).hostname; } catch { hostname = ""; }
  }
  const stored = await chrome.storage.local.get(storageKey());
  mapping = stored[storageKey()] || {};
}

function storageKey() {
  return `eaf_mapping_${hostname}`;
}

async function saveMapping() {
  await chrome.storage.local.set({ [storageKey()]: mapping });
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
  if (!lines.length) return { columns: [], records: [] };
  const parseLine = (line) => {
    const out = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else cur += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { out.push(cur); cur = ""; }
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const header = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const obj = {};
    header.forEach((h, i) => (obj[h] = vals[i] ?? ""));
    return obj;
  });
  return { columns: header, records: rows };
}

function parseXLSX(data) {
  const wb = XLSX.read(data, { type: "array" });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { columns, records: rows };
}

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const isCSV = /\.csv$/i.test(file.name);
  if (isCSV) {
    const text = await file.text();
    ({ columns, records } = parseCSV(text));
  } else {
    const buf = await file.arrayBuffer();
    ({ columns, records } = parseXLSX(buf));
  }
  currentIndex = 0;
  // Drop any saved mapping entries for columns no longer present.
  for (const col of Object.keys(mapping)) {
    if (!columns.includes(col)) delete mapping[col];
  }
  renderMapList();
  renderRecord();
  setStatus(`Loaded ${records.length} rows, ${columns.length} columns.`);
});

function renderMapList() {
  if (!columns.length) {
    mapList.innerHTML = "<em>Load a file first.</em>";
    return;
  }
  mapList.innerHTML = "";
  columns.forEach((col) => {
    const row = document.createElement("div");
    row.className = "mapRow";
    const sel = mapping[col];
    row.innerHTML = `
      <span class="colName" title="${col}">${col}</span>
      <span class="selText" title="${sel || ""}">${sel ? sel : "(not mapped)"}</span>
      <button data-col="${col}" class="mapBtn">${sel ? "Re-map" : "Map"}</button>
    `;
    mapList.appendChild(row);
  });
  mapList.querySelectorAll(".mapBtn").forEach((btn) => {
    btn.addEventListener("click", () => startPickingFor(btn.dataset.col));
  });
}

async function startPickingFor(col) {
  const tab = await getActiveTab();
  if (!tab) return;
  setStatus(`Click the field on the page for "${col}"…`);
  const listener = (msg) => {
    if (msg.type === "EAF_FIELD_PICKED") {
      mapping[col] = msg.selector;
      saveMapping();
      renderMapList();
      setStatus(`Mapped "${col}" → ${msg.selector}`);
      chrome.runtime.onMessage.removeListener(listener);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  chrome.tabs.sendMessage(tab.id, { type: "EAF_START_PICKING" });
}

function renderRecord() {
  if (!records.length) {
    recordBox.style.display = "none";
    return;
  }
  recordBox.style.display = "block";
  const rec = records[currentIndex];
  idxLabel.textContent = `Row ${currentIndex + 1} / ${records.length}`;
  fieldsEl.innerHTML = "";
  columns.forEach((col) => {
    const r = document.createElement("div");
    r.className = "fieldRow";
    r.innerHTML = `<span class="k">${col}</span><span class="v">${rec[col] ?? ""}</span>`;
    fieldsEl.appendChild(r);
  });
}

document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentIndex > 0) { currentIndex--; renderRecord(); }
});
document.getElementById("nextBtn").addEventListener("click", () => {
  if (currentIndex < records.length - 1) { currentIndex++; renderRecord(); }
});

document.getElementById("fillBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab || !records.length) return;
  const rec = records[currentIndex];
  const pairs = Object.entries(mapping)
    .filter(([col]) => col in rec)
    .map(([col, selector]) => ({ selector, value: String(rec[col] ?? "") }));
  if (!pairs.length) {
    setStatus("No fields mapped yet — click Map next to each column.");
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "EAF_FILL_VALUES", pairs }, (resp) => {
    if (!resp) { setStatus("Could not reach the page (try reloading it)."); return; }
    const failed = resp.results.filter((r) => !r.ok);
    setStatus(failed.length ? `Filled with ${failed.length} field(s) not found.` : "Filled ✓");
  });
});

init().then(() => renderMapList());
