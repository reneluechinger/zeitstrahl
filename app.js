// Zeitstrahl-App
const $ = s => document.querySelector(s);
const DEFAULT_CENTER = [47.4036, 9.6337]; // Widnau
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// ---------- Speicher ----------
function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
let plan = load("zs-plan", { len: 50, s: null, e: null });
let seen = new Set(load("zs-seen", []));

function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- Hütchen (Stationen mit gleicher Position) ----------
function cones(len) {
  const map = new Map();
  for (const st of STATIONS) {
    const p = roundHalf(positionM(st, len));
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(st);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
    .map(([pos, stations], i) => ({ n: i + 1, pos, stations }));
}
function coneLabel(c) {
  return c.stations.map(s => s.title).join(" · ");
}

// ---------- Geometrie ----------
const R = 6371000, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
function bearing(a, b) {
  const [la1, lo1, la2, lo2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const y = Math.sin(lo2 - lo1) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return Math.atan2(y, x);
}
function dest(a, brg, d) {
  const la1 = rad(a[0]), lo1 = rad(a[1]), dr = d / R;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(dr) + Math.cos(la1) * Math.sin(dr) * Math.cos(brg));
  const lo2 = lo1 + Math.atan2(Math.sin(brg) * Math.sin(dr) * Math.cos(la1), Math.cos(dr) - Math.sin(la1) * Math.sin(la2));
  return [deg(la2), deg(lo2)];
}
function conePoint(pos) { return dest(plan.s, bearing(plan.s, plan.e), pos); }

// ---------- Navigation ----------
function go(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  window.scrollTo(0, 0);
  if (id === "plan") initPlan();
  if (id === "walk") initWalk();
  if (id === "print") renderPrint();
  if (id === "home") checkOffline();
}
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));

// ---------- Karte ----------
function makeMap(el) {
  const m = L.map(el, { zoomControl: true, attributionControl: true });
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(m);
  return m;
}
function drawPlan(map, layer, clickable) {
  layer.clearLayers();
  if (!plan.s) return;
  L.circleMarker(plan.s, { radius: 8, color: "#1a1200", fillColor: "#ffd27a", fillOpacity: 1 }).addTo(layer);
  if (!plan.e) return;
  const end = conePoint(plan.len);
  L.polyline([plan.s, end], { color: "#ffd27a", weight: 5, opacity: .9 }).addTo(layer);
  for (const c of cones(plan.len)) {
    const gap = c.stations.every(s => s.gap);
    const icon = L.divIcon({ className: "conemark" + (gap ? " gap" : ""), html: c.n, iconSize: [26, 26] });
    const mk = L.marker(conePoint(c.pos), { icon }).addTo(layer);
    mk.bindTooltip(`Hütchen ${c.n} · ${fmtDist(c.pos)}<br>${coneLabel(c)}`);
    if (clickable) mk.on("click", () => openStations(c.stations));
  }
  map.fitBounds(L.latLngBounds([plan.s, end]).pad(0.25));
}

// ---------- Planen ----------
let planMap, planLayer;
function initPlan() {
  $("#len").value = plan.len;
  if (!planMap) {
    planMap = makeMap("planMap");
    planLayer = L.layerGroup().addTo(planMap);
    planMap.setView(plan.s || DEFAULT_CENTER, 17);
    planMap.on("click", ev => {
      const p = [ev.latlng.lat, ev.latlng.lng];
      if (!plan.s || plan.e) { plan.s = p; plan.e = null; }
      else plan.e = p;
      save("zs-plan", plan); refreshPlan();
    });
    if (navigator.geolocation && !plan.s) {
      navigator.geolocation.getCurrentPosition(pos => planMap.setView([pos.coords.latitude, pos.coords.longitude], 18), () => {}, { timeout: 5000 });
    }
  }
  setTimeout(() => { planMap.invalidateSize(); refreshPlan(); }, 50);
}
function refreshPlan() {
  drawPlan(planMap, planLayer, false);
  $("#planHint").innerHTML = !plan.s ? "Tippe auf die Karte: zuerst den <b>Start</b>, dann die <b>Richtung</b>."
    : !plan.e ? "Jetzt in die <b>Richtung</b> tippen, in die gelaufen wird." : "Strecke steht. Erneut tippen setzt einen neuen Start.";
  renderConeList($("#coneList"), false);
}
$("#len").addEventListener("input", () => {
  const v = Math.max(5, Math.min(5000, +$("#len").value || 50));
  plan.len = v; save("zs-plan", plan); if (planMap) refreshPlan();
});
$("#btnReset").addEventListener("click", () => { plan.s = plan.e = null; save("zs-plan", plan); refreshPlan(); });

function renderConeList(el, tappable) {
  el.innerHTML = "";
  for (const c of cones(plan.len)) {
    const gap = c.stations.every(s => s.gap);
    const done = c.stations.every(s => seen.has(String(s.id)));
    const b = document.createElement(tappable ? "button" : "div");
    b.className = "cone" + (gap ? " gap" : "");
    b.innerHTML = `<span class="n">${c.n}</span><span class="m">${fmtDist(c.pos)}</span><span class="t">${coneLabel(c)}</span>${tappable && done ? '<span class="seen">✓</span>' : ""}`;
    if (tappable) b.addEventListener("click", () => openStations(c.stations));
    el.appendChild(b);
  }
}

// Kartenkacheln rund um die Strecke vorladen
function tileXY(lat, lng, z) {
  const n = 2 ** z, x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))) / Math.PI) / 2 * n);
  return [x, y];
}
$("#btnTiles").addEventListener("click", async () => {
  if (!plan.s || !plan.e) return toast("Zuerst Start und Richtung setzen.");
  const end = conePoint(plan.len), pad = 0.0006 + plan.len / 111000 * 0.3;
  const minLat = Math.min(plan.s[0], end[0]) - pad, maxLat = Math.max(plan.s[0], end[0]) + pad;
  const minLng = Math.min(plan.s[1], end[1]) - pad, maxLng = Math.max(plan.s[1], end[1]) + pad;
  const urls = [];
  for (let z = 15; z <= 19; z++) {
    const [x1, y1] = tileXY(maxLat, minLng, z), [x2, y2] = tileXY(minLat, maxLng, z);
    for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
  }
  if (urls.length > 400) return toast("Strecke zu lang zum Speichern der Karte.");
  const cache = await caches.open("zs-data"); let ok = 0;
  toast(`Speichere ${urls.length} Kartenteile …`, 60000);
  for (const u of urls) {
    try { if (!(await cache.match(u))) { const r = await fetch(u, { mode: "cors" }); if (r.ok) await cache.put(u, r); } ok++; } catch {}
  }
  toast(ok === urls.length ? "Karte ist offline gespeichert ✓" : `Nur ${ok} von ${urls.length} Kartenteilen gespeichert. Internet prüfen.`);
});
$("#btnPrint").addEventListener("click", () => go("print"));

// Plan-QR
function planCode() {
  const f = p => p.map(v => v.toFixed(6)).join(",");
  return `ZSP:${plan.len};${f(plan.s)};${f(plan.e)}`;
}
function qrSvg(text, cell = 6) {
  const q = qrcode(0, "M"); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
}
$("#btnPlanQR").addEventListener("click", () => {
  if (!plan.s || !plan.e) return toast("Zuerst Start und Richtung setzen.");
  $("#planQRsvg").innerHTML = qrSvg(planCode());
  $("#planqr").classList.add("on");
});
$("#btnPlanQRClose").addEventListener("click", () => $("#planqr").classList.remove("on"));

// ---------- Druck ----------
function renderPrint() {
  const el = $("#printCards"); el.innerHTML = "";
  for (const c of cones(plan.len)) {
    const ids = c.stations.map(s => s.id).join(",");
    const d = document.createElement("div"); d.className = "pcard";
    d.innerHTML = `<div class="pn">Hütchen ${c.n}</div><div class="pm">bei ${fmtDist(c.pos)}</div>
      ${qrSvg(`ZS:${plan.len}:${ids}`)}
      <div class="pt">${c.stations.map(s => s.gap ? "· Zwischenhütchen" : `· ${s.title}`).join("<br>")}</div>`;
    el.appendChild(d);
  }
}

// ---------- Laufen ----------
let walkMap, walkLayer;
function initWalk() {
  renderConeList($("#walkList"), true);
  const has = plan.s && plan.e;
  $("#walkMap").style.display = has ? "" : "none";
  $("#walkNoPlan").style.display = has ? "none" : "";
  if (!has) return;
  if (!walkMap) { walkMap = makeMap("walkMap"); walkLayer = L.layerGroup().addTo(walkMap); }
  setTimeout(() => { walkMap.invalidateSize(); drawPlan(walkMap, walkLayer, true); }, 50);
}

// ---------- Stationsansicht ----------
let cur = { list: [], i: 0 };
function numParts(s) {
  if (s.years === 0) return ["Heute", ""];
  if (s.years >= 1e9) return [(s.years / 1e9).toLocaleString("de-CH", { maximumFractionDigits: 2 }), "Milliarden Jahre her"];
  if (s.years >= 1e6) return [Math.round(s.years / 1e6).toLocaleString("de-CH"), "Millionen Jahre her"];
  return [Math.round(s.years / 1e3).toLocaleString("de-CH"), "Tausend Jahre her"];
}
function openStations(list) {
  cur = { list, i: 0 }; renderStation(); $("#station").classList.add("on");
}
function renderStation() {
  const s = cur.list[cur.i];
  seen.add(String(s.id)); save("zs-seen", [...seen]);
  const [n, u] = numParts(s);
  const pct = (1 - s.years / UNIVERSE_AGE) * 100;
  const pos = positionM(s, plan.len), rest = plan.len - roundHalf(pos);
  const visual = s.gap ? `<div class="gapbg"></div>` : `<img class="photo" src="${imgUrl(s.img)}" alt="${s.title}">`;
  const credit = s.gap ? "" : `<div class="credit">Bild: ${s.credit} · ${s.license} · Wikimedia Commons</div>`;
  const many = cur.list.length > 1;
  $("#stInner").innerHTML = `${visual}<div class="shade"></div>
    <div class="num">${n}<small>${u}</small></div>
    <button class="closebtn" id="stClose">✕</button>
    ${many ? `<div class="pager"><button id="stPrev">‹</button><div class="dots">${cur.i + 1}/${cur.list.length}</div><button id="stNext">›</button></div>` : ""}
    <div class="panel">
      <h1>${s.title}</h1><p>${s.text}</p>
      <div class="band"><div class="track"><div class="marker" style="left:${pct}%"></div></div>
        <div class="ends"><span>Urknall</span><span>Heute</span></div></div>
      <div class="meta"><span>Du bist bei <b>${fmtDist(pos)}</b></span><span>${rest > 0 ? `noch ${fmtDist(rest)} bis heute` : "Ziel erreicht"}</span></div>
      ${credit}
    </div>`;
  $("#stClose").onclick = closeStation;
  if (many) {
    $("#stPrev").onclick = () => { cur.i = (cur.i - 1 + cur.list.length) % cur.list.length; renderStation(); };
    $("#stNext").onclick = () => { cur.i = (cur.i + 1) % cur.list.length; renderStation(); };
  }
}
function closeStation() { $("#station").classList.remove("on"); if ($("#walk").classList.contains("on")) renderConeList($("#walkList"), true); }
let sx = null;
$("#station").addEventListener("touchstart", e => sx = e.touches[0].clientX, { passive: true });
$("#station").addEventListener("touchend", e => {
  if (sx === null || cur.list.length < 2) return;
  const dx = e.changedTouches[0].clientX - sx; sx = null;
  if (Math.abs(dx) > 60) { cur.i = (cur.i + (dx < 0 ? 1 : -1) + cur.list.length) % cur.list.length; renderStation(); }
});

// ---------- Scanner ----------
let stream = null, scanning = false;
const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
$("#btnScan").addEventListener("click", startScan);
$("#btnScanClose").addEventListener("click", stopScan);
async function startScan() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  } catch {
    return toast("Kamera nicht verfügbar. Bitte das Hütchen in der Liste antippen.", 4000);
  }
  const v = $("#video"); v.srcObject = stream; await v.play();
  $("#scanner").classList.add("on"); scanning = true; requestAnimationFrame(tick);
}
function stopScan() {
  scanning = false; $("#scanner").classList.remove("on");
  if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
}
function tick() {
  if (!scanning) return;
  const v = $("#video");
  if (v.readyState === v.HAVE_ENOUGH_DATA) {
    const w = 640, h = Math.round(v.videoHeight / v.videoWidth * w) || 480;
    canvas.width = w; canvas.height = h; ctx.drawImage(v, 0, 0, w, h);
    const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
    if (code && handleCode(code.data)) return;
  }
  requestAnimationFrame(tick);
}
function handleCode(txt) {
  let m = txt.match(/^ZS:(\d+(?:\.\d+)?):([\w,]+)$/);
  if (m) {
    const ids = m[2].split(",");
    const list = ids.map(id => STATIONS.find(s => String(s.id) === id)).filter(Boolean);
    if (!list.length) return false;
    if (+m[1] !== plan.len) { plan.len = +m[1]; save("zs-plan", plan); }
    stopScan(); if (navigator.vibrate) navigator.vibrate(80); openStations(list); return true;
  }
  m = txt.match(/^ZSP:(\d+(?:\.\d+)?);(-?[\d.]+),(-?[\d.]+);(-?[\d.]+),(-?[\d.]+)$/);
  if (m) {
    plan = { len: +m[1], s: [+m[2], +m[3]], e: [+m[4], +m[5]] }; save("zs-plan", plan);
    stopScan(); toast("Plan übernommen ✓");
    initWalk(); return true;
  }
  return false;
}

// ---------- Offline ----------
const IMG_URLS = STATIONS.filter(s => !s.gap).map(s => imgUrl(s.img));
async function checkOffline() {
  const el = $("#offStatus");
  if (!("caches" in window) || !("serviceWorker" in navigator)) { el.innerHTML = '<span class="warn">Offline nicht möglich in diesem Browser.</span>'; return; }
  let n = 0; for (const u of IMG_URLS) if (await caches.match(u)) n++;
  const shell = !!(await caches.match("./app.js"));
  el.innerHTML = (n === IMG_URLS.length && shell)
    ? `<span class="ok">✓ Offline bereit: App und alle ${n} Bilder gespeichert</span>`
    : `<span class="warn">Bilder offline: ${n} von ${IMG_URLS.length}${shell ? "" : " · App noch nicht gespeichert"}</span>`;
}
$("#btnCacheAll").addEventListener("click", async () => {
  const cache = await caches.open("zs-data"); let fail = 0;
  toast("Lade Bilder …", 60000);
  for (const u of IMG_URLS) {
    if (await cache.match(u)) continue;
    try {
      let r; try { r = await fetch(u, { mode: "cors" }); } catch { r = await fetch(u, { mode: "no-cors" }); }
      if (r.ok || r.type === "opaque") await cache.put(u, r); else fail++;
    } catch { fail++; }
  }
  toast(fail ? `${fail} Bilder konnten nicht geladen werden. Internet prüfen.` : "Alles offline gespeichert ✓");
  checkOffline();
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then(() => setTimeout(checkOffline, 1500));
checkOffline();
