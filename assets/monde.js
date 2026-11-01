// Song of Westeros - carte du monde interactive (style Crusader Kings III).
// Donnees : mod "A Game of Thrones" pour CK3 (carte, titres, seigneurs en 183 AC).
(function () {
  const NZ = 5;                 // zoom ou 1 pixel de la carte = 1 pixel ecran
  const W = 9216, H = 6144;     // taille de la carte source
  const TIERS = {
    e: { file: "regions", label: "Région", enfants: "Territoires" },
    k: { file: "territoires", label: "Territoire", enfants: "Duchés" },
    d: { file: "duches", label: "Duché", enfants: "Comtés" },
    c: { file: "comtes", label: "Comté", enfants: "Baronnies" },
    b: { label: "Baronnie" },
  };
  const ORDER = ["e", "k", "d", "c"];
  const HOLD = {
    castle_holding: ["Château", "♜"], city_holding: ["Cité", "⌂"], church_holding: ["Temple", "✦"],
    monastery_holding: ["Monastère", "✦"], tribal_holding: ["Camp tribal", "▲"], pirate_den_holding: ["Repaire de pirates", "☠"],
    ruin_holding: ["Ruines", "✕"],
  };

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const fmt = (n) => (n === "" || n == null ? "-" : Number(n).toLocaleString("fr-FR"));
  const json = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
  const csv = (u) => fetch(u, { cache: "no-cache" }).then((r) => r.text()).then(parseCSV);

  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.trim());
    return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
  }

  async function init() {
    const [T, ...rest] = await Promise.all([
      json("donnees/monde/titres.json"),
      ...ORDER.map((t) => json(`donnees/monde/${TIERS[t].file}.json`)),
      json("donnees/monde/routes.json"),
      csv("donnees/monde/traductions.csv"),
      csv("donnees/armees.csv").catch(() => []),
      csv("donnees/monde/reperes.csv").catch(() => []),
    ]);
    const geo = {}; ORDER.forEach((t, i) => (geo[t] = rest[i]));
    const [routes, trad, armees, reperes] = rest.slice(ORDER.length);
    const FR = Object.fromEntries(trad.map((r) => [r["Original"], r["Français"]]));
    const tr = (s) => FR[s] || s;
    const nom = (k) => tr(T[k]?.n || k);
    const armee = (house) => {
      if (!house) return null;
      const cands = [tr(house), house].map((h) => norm("Maison " + h));
      return armees.find((r) => cands.includes(norm(r["Maison"])) || cands.some((c) => norm(r["Maison"]).startsWith(c + " ")));
    };

    // ---------- Carte ----------
    const map = L.map("map", { crs: L.CRS.Simple, minZoom: 1.5, maxZoom: 7, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 110, zoomControl: false, attributionControl: true });
    const P = (x, y) => map.unproject([x, y], NZ);
    const all = L.latLngBounds(P(0, 0), P(W, H));
    map.setMaxBounds(all.pad(0.05));
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.setPrefix(false).addAttribution('Carte et données : mod <em>A Game of Thrones</em> pour Crusader Kings III · Univers © G. R. R. Martin');

    L.tileLayer("monde/tuiles/{z}/{x}_{y}.webp", { tileSize: 256, minZoom: 0, maxZoom: 7, minNativeZoom: 0, maxNativeZoom: NZ, noWrap: true, bounds: all, keepBuffer: 4 }).addTo(map);

    // Une couche "pane" par niveau, pour n'activer que le niveau utile au clic
    const panes = {}, groups = {}, feats = {};
    ORDER.forEach((t, i) => {
      panes[t] = map.createPane("tier-" + t); panes[t].style.zIndex = 410 + i * 5;
      groups[t] = L.featureGroup().addTo(map);
      const renderer = L.canvas({ pane: "tier-" + t, padding: 0.3, tolerance: 2 });
      geo[t].forEach((f) => {
        const latlngs = f.g.map((poly) => poly.map((ring) => ring.map(([x, y]) => P(x, y))));
        const lay = L.polygon(latlngs, { renderer, smoothFactor: 0.5 });
        lay.featureId = f.id; lay.tier = t; lay.info = f;
        lay.on("mouseover", () => hover(lay, true)).on("mouseout", () => hover(lay, false)).on("click", (e) => { L.DomEvent.stopPropagation(e); select(f.id, false); });
        lay.bindTooltip(() => esc(nom(f.id)), { sticky: true, className: "mtip", direction: "top", offset: [0, -8] });
        groups[t].addLayer(lay);
        feats[f.id] = lay;
      });
    });

    // ---------- Modes de carte ----------
    const MODES = [["e", "Royaumes"], ["k", "Territoires"], ["d", "Duchés"], ["c", "Comtés"], ["papier", "Carte papier"]];
    let mode = "e", active = "e", hovered = null;
    const col = (k) => T[k]?.c || "#8a8a8a";
    const activeTier = (z) => (z < 3 ? "e" : z < 3.75 ? "k" : z < 4.5 ? "d" : "c");
    const fillTier = () => (mode === "papier" ? null : mode);

    function styleFor(lay) {
      const t = lay.tier, z = map.getZoom(), ft = fillTier();
      const rank = ORDER.indexOf(t);
      const show = [true, z >= 2.75, z >= 3.5, z >= 4.25][rank];
      const s = { stroke: show, color: "#2a1d12", opacity: [0.85, 0.55, 0.45, 0.35][rank], weight: [2.4, 1.5, 1.1, 0.7][rank] * (z >= 5 ? 1.3 : 1), fill: false, fillOpacity: 0 };
      if (t === ft) { s.fill = true; s.fillColor = col(lay.featureId); s.fillOpacity = 0.42; }
      if (t === active) { s.fill = true; if (t !== ft) { s.fillColor = "#000"; s.fillOpacity = 0; } }
      if (lay === hovered) { s.fill = true; s.fillColor = t === ft ? col(lay.featureId) : "#f4e2b0"; s.fillOpacity = t === ft ? 0.65 : 0.22; }
      return s;
    }
    function restyle() { ORDER.forEach((t) => groups[t].eachLayer((l) => l.setStyle(styleFor(l)))); }
    function hover(lay, on) {
      if (lay.tier !== active) return;
      const prev = hovered; hovered = on ? lay : null;
      if (prev) prev.setStyle(styleFor(prev));
      if (hovered) hovered.setStyle(styleFor(hovered));
    }
    function updateActive() {
      active = activeTier(map.getZoom());
      ORDER.forEach((t) => (panes[t].style.pointerEvents = t === active ? "auto" : "none"));
      $("#mm-hint").textContent = "Clic : " + TIERS[active].label.toLowerCase();
    }
    $("#map-modes").innerHTML = MODES.map(([k, l]) => `<button type="button" data-m="${k}"${k === mode ? ' class="active"' : ""}>${l}</button>`).join("");
    $("#map-modes").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      mode = b.dataset.m;
      document.querySelectorAll("#map-modes button").forEach((x) => x.classList.toggle("active", x === b));
      restyle();
    });

    // ---------- Noms peints (taille selon la place disponible, comme dans CK3) ----------
    const labels = [];
    const labelPane = map.createPane("labels"); labelPane.style.zIndex = 600; labelPane.style.pointerEvents = "none";
    ORDER.forEach((t) => geo[t].forEach((f) => {
      const text = nom(f.id);
      const icon = L.divIcon({ className: "ml ml-" + t, html: `<span style="transform:translate(-50%,-50%) rotate(${f.a}deg)">${esc(text)}</span>`, iconSize: [0, 0] });
      const m = L.marker(P(f.l[0], f.l[1]), { icon, interactive: false, pane: "labels", keyboard: false });
      labels.push({ m, t, f, len: Math.max(text.length, 3) });
    }));
    const labelLayer = L.layerGroup(labels.map((l) => l.m)).addTo(map);
    const WIN = { e: [0, 3.25], k: [2.75, 4], d: [3.5, 4.75], c: [4.25, 9] };
    const MAXFS = { e: 44, k: 30, d: 22, c: 17 };
    const CHARW = { e: 0.92, k: 0.85, d: 0.62, c: 0.58 };
    function updateLabels() {
      const z = map.getZoom(), s = Math.pow(2, z - NZ);
      labels.forEach((l) => {
        const el = l.m.getElement(); if (!el) return;
        const [z0, z1] = WIN[l.t];
        let fs = Math.min(l.f.h * s * 0.42, (l.f.w * s * 0.86) / (l.len * CHARW[l.t]));
        fs = Math.min(fs, MAXFS[l.t]);
        const ok = z >= z0 && z < z1 && fs >= (l.t === "c" ? 9.5 : 10.5);
        el.style.display = ok ? "" : "none";
        if (ok) el.firstChild.style.fontSize = fs.toFixed(1) + "px";
      });
    }

    // ---------- Routes ----------
    const roadPane = map.createPane("roads"); roadPane.style.zIndex = 450; roadPane.style.pointerEvents = "none";
    const roadLayer = L.layerGroup();
    routes.forEach((r) => r.lines.forEach((ln) => {
      const major = r.type !== "secondaire";
      L.polyline(ln.map(([x, y]) => P(x, y)), { pane: "roads", color: major ? "#8a2f1c" : "#5a4330", weight: major ? 2.6 : 1.3, opacity: major ? 0.85 : 0.7, dashArray: major ? null : "4 5", lineCap: "round", interactive: false, className: major ? "road-major" : "road-minor" }).addTo(roadLayer);
    }));
    roadLayer.addTo(map);

    // ---------- Baronnies (affichees de pres, seulement dans la zone visible) ----------
    const baronnies = Object.entries(T).filter(([, t]) => t.t === "b" && t.hold && HOLD[t.hold]).map(([k, t]) => ({ k, t, ll: P(t.xy[0], t.xy[1]) }));
    const holdLayer = L.layerGroup().addTo(map);
    let showHold = true;
    function updateHoldings() {
      holdLayer.clearLayers();
      const z = map.getZoom();
      if (!showHold || z < 5) return;
      const b = map.getBounds().pad(0.1);
      baronnies.filter((x) => b.contains(x.ll)).slice(0, 600).forEach((x) => {
        const [lbl, glyph] = HOLD[x.t.hold];
        const icon = L.divIcon({ className: "hold hold-" + x.t.hold, html: `<i>${glyph}</i>${z >= 5.75 ? `<span>${esc(nom(x.k))}</span>` : ""}`, iconSize: [0, 0] });
        L.marker(x.ll, { icon, keyboard: false, title: nom(x.k) + " (" + lbl + ")" }).on("click", () => select(x.k, false)).addTo(holdLayer);
      });
    }

    // ---------- Reperes du serveur ----------
    const repLayer = L.layerGroup().addTo(map);
    reperes.filter((r) => r["X"] && r["Y"]).forEach((r) => {
      L.marker(P(+r["X"], +r["Y"]), { icon: L.divIcon({ className: "rep", html: "<i></i>", iconSize: [18, 18] }) })
        .bindPopup(`<strong>${esc(r["Nom"])}</strong>${r["Description"] ? `<p>${esc(r["Description"])}</p>` : ""}`).addTo(repLayer);
    });

    // ---------- Selection et panneau d'information ----------
    const selPane = map.createPane("sel"); selPane.style.zIndex = 460; selPane.style.pointerEvents = "none";
    let selLayer = null;
    const chain = (k) => { const out = []; let p = T[k]?.p; while (p && T[p]) { if (TIERS[T[p].t]) out.unshift(p); p = T[p].p; } return out; };
    const children = (k) => Object.keys(T).filter((x) => T[x].p === k && (T[x].t !== "b" || T[x].hold));

    function select(k, fly = true) {
      const t = T[k]; if (!t) return;
      if (selLayer) map.removeLayer(selLayer);
      const lay = feats[k];
      if (lay) {
        selLayer = L.polygon(lay.getLatLngs(), { pane: "sel", color: "#f3d27a", weight: 3, fill: false, interactive: false }).addTo(map);
        if (fly) map.flyToBounds(lay.getBounds(), { padding: [60, 60], maxZoom: { e: 3.25, k: 3.75, d: 4.5, c: 5.25 }[t.t], duration: 0.9 });
      } else if (t.xy) {
        selLayer = L.circleMarker(P(t.xy[0], t.xy[1]), { pane: "sel", radius: 9, color: "#f3d27a", weight: 3, fill: false }).addTo(map);
        if (fly) map.flyTo(P(t.xy[0], t.xy[1]), 6, { duration: 0.9 });
      }
      panel(k);
      history.replaceState(null, "", "#" + k);
    }

    function panel(k) {
      const t = T[k];
      const tier = TIERS[t.t];
      const hold = t.hold && HOLD[t.hold];
      const crumbs = chain(k).map((p) => `<button type="button" data-k="${p}">${esc(nom(p))}</button>`).join("<span>›</span>");
      const a = armee(t.hh);
      const kids = children(k).sort((x, y) => nom(x).localeCompare(nom(y), "fr"));
      $("#info").innerHTML = `
        <div class="info-head" style="--c:${t.c || T[t.p]?.c || "#c9a45c"}">
          <p class="info-tier">${hold ? hold[0] : tier.label}</p>
          <h2>${esc(nom(k))}</h2>
          ${nom(k) !== t.n ? `<p class="info-vo">${esc(t.n)}</p>` : ""}
        </div>
        ${crumbs ? `<nav class="crumbs">${crumbs}</nav>` : ""}
        <dl class="info-list">
          ${t.h ? `<dt>${t.t === "e" ? "Suzerain" : "Seigneur"} en 183 AC</dt><dd>${esc(t.h)}${t.hh ? `<br><span>Maison ${esc(tr(t.hh))}</span>` : ""}</dd>` : ""}
          ${t.cu ? `<dt>Culture</dt><dd>${esc(tr(t.cu))}</dd>` : ""}
          ${t.fa ? `<dt>Foi</dt><dd>${esc(tr(t.fa))}</dd>` : ""}
        </dl>
        ${a ? `<div class="info-army"><p>Forces de la maison ${esc(tr(t.hh))}</p><div><span>Levées<b>${fmt(a["Levées"])}</b></span><span>Chevaliers<b>${fmt(a["Chevaliers"])}</b></span><span>Navires<b>${fmt(a["Flotte"])}</b></span></div><a href="armees.html">Voir les effectifs</a></div>` : ""}
        ${kids.length ? `<p class="info-sub">${tier.enfants || ""} (${kids.length})</p><div class="info-kids">${kids.map((x) => `<button type="button" data-k="${x}">${T[x].hold && HOLD[T[x].hold] ? `<i>${HOLD[T[x].hold][1]}</i>` : `<i class="sw" style="background:${T[x].c || "#888"}"></i>`}${esc(nom(x))}</button>`).join("")}</div>` : ""}`;
      $("#info-panel").hidden = false;
    }
    $("#info").addEventListener("click", (e) => { const b = e.target.closest("button[data-k]"); if (b) select(b.dataset.k); });
    $("#info-close").addEventListener("click", () => { $("#info-panel").hidden = true; if (selLayer) map.removeLayer(selLayer); selLayer = null; history.replaceState(null, "", location.pathname); });

    // ---------- Recherche ----------
    const index = Object.keys(T).filter((k) => feats[k] || (T[k].t === "b" && T[k].hold)).map((k) => ({ k, s: norm(nom(k) + " " + T[k].n + " " + (T[k].hh || "")) }));
    const search = $("#place-search"), results = $("#place-results");
    search.addEventListener("input", () => {
      const q = norm(search.value.trim());
      if (q.length < 2) { results.innerHTML = ""; return; }
      const rank = { e: 0, k: 1, d: 2, c: 3, b: 4 };
      const hits = index.filter((x) => x.s.includes(q)).sort((a, b) => rank[T[a.k].t] - rank[T[b.k].t]).slice(0, 10);
      results.innerHTML = hits.length ? hits.map(({ k }) => `<button type="button" data-k="${k}">${esc(nom(k))}<span>${T[k].hold && HOLD[T[k].hold] ? HOLD[T[k].hold][0] : TIERS[T[k].t].label}${T[k].p && T[T[k].p] ? " · " + esc(nom(chain(k).slice(-1)[0] || T[k].p)) : ""}</span></button>`).join("") : `<p class="empty">Aucun résultat.</p>`;
    });
    results.addEventListener("click", (e) => { const b = e.target.closest("button[data-k]"); if (!b) return; select(b.dataset.k); results.innerHTML = ""; search.value = ""; });

    // ---------- Calques, plein ecran, reperes ----------
    $("#layers").addEventListener("change", (e) => {
      const k = e.target.dataset.k, on = e.target.checked;
      if (k === "routes") on ? roadLayer.addTo(map) : map.removeLayer(roadLayer);
      if (k === "noms") on ? labelLayer.addTo(map) : map.removeLayer(labelLayer);
      if (k === "baronnies") { showHold = on; updateHoldings(); }
      if (k === "frontieres") ORDER.forEach((t) => (panes[t].style.display = on ? "" : "none"));
      if (on && k === "noms") updateLabels();
    });
    const shell = $("#map-shell");
    $("#map-full").addEventListener("click", () => (document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen && shell.requestFullscreen()));
    document.addEventListener("fullscreenchange", () => setTimeout(() => map.invalidateSize(), 100));
    $("#panel-toggle").addEventListener("click", () => $("#map-panel").classList.toggle("collapsed"));
    let picking = false;
    $("#map-pick").addEventListener("click", () => { picking = !picking; $("#map-pick").classList.toggle("active", picking); shell.classList.toggle("picking", picking); });
    map.on("click", (e) => {
      if (!picking) return;
      const p = map.project(e.latlng, NZ);
      const line = `Nom du repère,Description,${Math.round(p.x)},${Math.round(p.y)}`;
      if (navigator.clipboard) navigator.clipboard.writeText(line).catch(() => {});
      L.popup().setLatLng(e.latlng).setContent(`<strong>Ligne copiée</strong><p>À coller dans donnees/monde/reperes.csv :</p><code>${esc(line)}</code>`).openOn(map);
    });
    const VUES = { westeros: [[480, 250], [2450, 4350]], essos: [[2350, 1700], [9216, 6144]], monde: [[0, 0], [W, H]] };
    $("#views").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) map.flyToBounds(L.latLngBounds(VUES[b.dataset.v].map(([x, y]) => P(x, y))), { duration: 1 }); });

    // ---------- Mise a jour au zoom ----------
    map.on("zoomend", () => { updateActive(); restyle(); updateLabels(); updateHoldings(); });
    map.on("moveend", updateHoldings);

    map.fitBounds(L.latLngBounds(VUES.westeros.map(([x, y]) => P(x, y))));
    updateActive(); restyle(); updateLabels(); updateHoldings();
    const start = decodeURIComponent(location.hash.slice(1));
    if (T[start]) select(start);
  }

  init().catch((e) => { console.error(e); const m = document.getElementById("map"); if (m) m.innerHTML = `<p class="empty" style="padding:24px">Impossible de charger la carte (${esc(e.message)}).</p>`; });
})();
