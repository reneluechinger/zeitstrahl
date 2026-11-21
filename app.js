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
// Im letzten Meter bekommt jede Station ein eigenes Hütchen mit genauer Angabe
function isEndZone(pos, len) { const rest = len - pos; return rest > 0 && rest < 1; }
function fmtSmall(m) {
  if (m >= 1) return fmtNum(m, 2) + " m";
  if (m >= 0.01) return fmtNum(Math.round(m * 100), 0) + " cm";
  return fmtNum(Math.max(m * 1000, 0.1), m * 1000 < 1 ? 1 : 0) + " mm";
}
function cones(len) {
  const map = new Map();
  for (const st of STATIONS) {
    const exact = positionM(st, len);
    const end = isEndZone(exact, len);
    const key = end ? "x" + st.id : roundHalf(exact);
    if (!map.has(key)) map.set(key, { pos: end ? exact : roundHalf(exact), exact: end, stations: [] });
    map.get(key).stations.push(st);
  }
  return [...map.values()].sort((a, b) => a.pos - b.pos).map((c, i) => ({ n: i + 1, ...c }));
}
function coneDist(c) {
  return c.exact ? `${fmtSmall(plan.len - c.pos)} vor dem Ziel` : fmtDist(c.pos);
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
    mk.bindTooltip(`Hütchen ${c.n} · ${coneDist(c)}<br>${coneLabel(c)}`);
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
  }
  setTimeout(() => { planMap.invalidateSize(); refreshPlan(); }, 50);
}
function refreshPlan() {
  drawPlan(planMap, planLayer, false);
  $("#planHint").innerHTML = !plan.s ? "Tippe auf die Karte: zuerst den <b>Start</b>, dann die <b>Richtung</b>."
    : !plan.e ? "Jetzt in die <b>Richtung</b> tippen, in die gelaufen wird." : "Strecke steht. Erneut tippen setzt einen neuen Start.";
  renderConeList($("#coneList"), false);
}
$("#len").addEventListener("change", () => {
  const raw = String($("#len").value).replace(",", ".");
  const v = Math.max(5, Math.min(5000, parseFloat(raw) || plan.len || 50));
  $("#len").value = v; plan.len = v; save("zs-plan", plan); if (planMap) refreshPlan();
});
$("#btnReset").addEventListener("click", () => { plan.s = plan.e = null; save("zs-plan", plan); refreshPlan(); });

function renderConeList(el, tappable) {
  el.innerHTML = "";
  for (const c of cones(plan.len)) {
    const gap = c.stations.every(s => s.gap);
    const done = c.stations.every(s => seen.has(String(s.id)));
    const b = document.createElement(tappable ? "button" : "div");
    b.className = "cone" + (gap ? " gap" : "");
    b.innerHTML = `<span class="n">${c.n}</span><span class="m">${coneDist(c)}</span><span class="t">${coneLabel(c)}</span>${tappable && done ? '<span class="seen">✓</span>' : ""}`;
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
function tileUrls() {
  const end = conePoint(plan.len), pad = 0.0006 + plan.len / 111000 * 0.3;
  const minLat = Math.min(plan.s[0], end[0]) - pad, maxLat = Math.max(plan.s[0], end[0]) + pad;
  const minLng = Math.min(plan.s[1], end[1]) - pad, maxLng = Math.max(plan.s[1], end[1]) + pad;
  // bei langen Strecken die feinsten Zoomstufen weglassen
  for (let zmax = 19; zmax >= 15; zmax--) {
    const urls = [];
    for (let z = 14; z <= zmax; z++) {
      const [x1, y1] = tileXY(maxLat, minLng, z), [x2, y2] = tileXY(minLat, maxLng, z);
      for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
    }
    if (urls.length <= 300 || zmax === 15) return urls;
  }
}
async function prefetchTiles(quiet) {
  if (!plan.s || !plan.e) { if (!quiet) toast("Zuerst Start und Richtung setzen."); return; }
  if (!navigator.onLine) { if (!quiet) toast("Dafür braucht es Internet (WLAN)."); return; }
  const urls = tileUrls(), cache = await caches.open("zs-data"); let ok = 0;
  toast(`Speichere Karte (${urls.length} Teile) …`, 120000);
  for (const u of urls) {
    try { if (await cache.match(u)) ok++; else { const r = await fetch(u, { mode: "cors" }); if (r.ok) { await cache.put(u, r); ok++; } } } catch {}
  }
  toast(ok === urls.length ? "Karte ist offline gespeichert ✓" : `Nur ${ok} von ${urls.length} Kartenteilen gespeichert. Internet prüfen.`);
}
$("#btnTiles").addEventListener("click", () => prefetchTiles(false));
$("#btnWalkTiles").addEventListener("click", () => prefetchTiles(false));
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
  const el = $("#printCards"); el.innerHTML = ""; let sheet;
  cones(plan.len).forEach((c, k) => {
    if (k % 4 === 0) { sheet = document.createElement("div"); sheet.className = "sheet"; el.appendChild(sheet); }
    const ids = c.stations.map(s => s.id).join(",");
    const d = document.createElement("div"); d.className = "pcard";
    d.innerHTML = `<div class="pn">Hütchen ${c.n}</div><div class="pm">${c.exact ? coneDist(c) : "bei " + fmtDist(c.pos)}</div>
      ${qrSvg(`ZS:${plan.len}:${ids}`)}
      <div class="pt">${c.stations.map(s => s.gap ? "· Zwischenhütchen" : `· ${s.title}`).join("<br>")}</div>`;
    sheet.appendChild(d);
  });
}

// ---------- Laufen ----------
let walkMap, walkLayer;
function initWalk() {
  renderConeList($("#walkList"), true);
  const has = plan.s && plan.e;
  $("#walkMap").style.display = has ? "" : "none";
  $("#walkTilesRow").style.display = has ? "" : "none";
  $("#walkList").style.display = has ? "" : "none";
  document.querySelector("#walk .sub").style.display = has ? "" : "none";
  $("#walkNoPlan").style.display = has ? "none" : "";
  if (!has) return;
  if (!walkMap) { walkMap = makeMap("walkMap"); walkLayer = L.layerGroup().addTo(walkMap); }
  setTimeout(() => { walkMap.invalidateSize(); drawPlan(walkMap, walkLayer, true); }, 50);
}

// ---------- Stationsansicht ----------
let cur = { list: [], i: 0 };
function numParts(s) {
  if (s.years === 0) return ["Heute", ""];
  if (s.years >= 1e9) return [fmtNum(s.years / 1e9, s.years >= 1e10 ? 1 : 2), "Milliarden Jahre her"];
  if (s.years >= 1e6) return [fmtNum(Math.round(s.years / 1e6), 0), "Millionen Jahre her"];
  return [fmtNum(Math.round(s.years / 1e3), 0), "Tausend Jahre her"];
}
function openStations(list) {
  cur = { list, i: 0 }; renderStation(); $("#station").classList.add("on");
}
function renderStation() {
  const s = cur.list[cur.i];
  seen.add(String(s.id)); save("zs-seen", [...seen]);
  const [n, u] = numParts(s);
  const pct = (1 - s.years / UNIVERSE_AGE) * 100;
  const pos = positionM(s, plan.len), end = isEndZone(pos, plan.len), rest = plan.len - (end ? pos : roundHalf(pos));
  const visual = s.gap ? `<div class="gapbg"></div>` : `<img class="photo" src="${imgUrl(s.img)}" alt="${s.title}">`;
  const credit = s.gap ? "" : `<div class="credit">Bild: ${s.credit} · ${s.license} · <a href="${commonsPage(s.img)}" target="_blank" rel="noopener">Wikimedia Commons</a></div>`;
  const many = cur.list.length > 1;
  $("#stInner").innerHTML = `${visual}<div class="shade"></div>
    <div class="num">${n}<small>${u}</small></div>
    <button class="closebtn" id="stClose">✕</button>
    ${many ? `<div class="pager"><button id="stPrev">‹</button><div class="dots">${cur.i + 1}/${cur.list.length}</div><button id="stNext">›</button></div>` : ""}
    <div class="panel">
      <h1>${s.title}</h1><p>${s.text}</p>
      <div class="band"><div class="track"><div class="marker" style="left:${pct}%"></div></div>
        <div class="ends"><span>Urknall</span><span>Heute</span></div></div>
      <div class="meta">${end
        ? `<span>Nur noch <b>${fmtSmall(rest)}</b> bis heute!</span><span>bei ${fmtNum(pos, pos > plan.len - 0.01 ? 3 : 2)} m</span>`
        : `<span>Du bist bei <b>${fmtDist(pos)}</b></span><span>${rest > 0 ? `noch ${fmtDist(rest)} bis heute` : "Ziel erreicht"}</span>`}</div>
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
  $("#scanner").classList.add("on");
  const v = $("#video"); v.srcObject = stream;
  try { await v.play(); } catch { stopScan(); return toast("Kamera konnte nicht starten. Bitte das Hütchen in der Liste antippen.", 4000); }
  scanning = true; requestAnimationFrame(tick);
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
    seen = new Set(); save("zs-seen", []);
    stopScan(); toast("Plan übernommen ✓");
    initWalk(); setTimeout(() => prefetchTiles(true), 1200); return true;
  }
  return false;
}

// ---------- Offline ----------
const IMG_URLS = STATIONS.filter(s => !s.gap).map(s => imgUrl(s.img));
async function checkOffline() {
  const el = $("#offStatus");
  if (!("caches" in window) || !("serviceWorker" in navigator)) { el.innerHTML = '<span class="warn">Offline nicht möglich in diesem Browser.</span>'; return; }
  let n = 0; for (const u of IMG_URLS) if (await caches.match(u)) n++;
  const shell = !!(await caches.match("./app.js")) && !!(await caches.match("./vendor/fonts/inter-latin-400-normal.woff2"));
  el.innerHTML = (n === IMG_URLS.length && shell)
    ? `<span class="ok">✓ Offline bereit: App und alle ${n} Bilder gespeichert</span>`
    : `<span class="warn">Bilder offline: ${n} von ${IMG_URLS.length}${shell ? "" : " · App noch nicht gespeichert"}</span>`;
}
// Bild laden wie in der Stationsansicht: der Service Worker speichert es dabei.
// onload feuert nur, wenn wirklich ein Bild ankam (kein Fehler, keine 404).
function loadImg(u) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = u; });
}
$("#btnCacheAll").addEventListener("click", async () => {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
    toast("Einen Moment: die App wird eingerichtet. Bitte Seite neu laden und nochmals tippen.", 4000); return;
  }
  toast("Lade Bilder …", 120000);
  const results = await Promise.all(IMG_URLS.map(loadImg));
  const fail = results.filter(x => !x).length;
  await new Promise(r => setTimeout(r, 800));
  toast(fail ? `${fail} Bilder konnten nicht geladen werden. Internet prüfen.` : "Alle Bilder offline gespeichert ✓");
  checkOffline();
});
$("#btnResetSeen").addEventListener("click", () => { seen = new Set(); save("zs-seen", []); toast("Haken zurückgesetzt ✓"); });
// Hinweis, wenn die App in Safari statt vom Home-Bildschirm läuft (iPad)
(function () {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  if (ios && !standalone) $("#safariWarn").style.display = "block";
})();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then(() => setTimeout(checkOffline, 1500));
checkOffline();
