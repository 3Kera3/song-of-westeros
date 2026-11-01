// Song of Westeros - carte du monde interactive.
// Fond : mod "A Game of Thrones" (CK3). Seuls les lieux, personnages, peuples et cultes des livres sont affiches
// (verifies sur A Wiki of Ice and Fire). Noms VF : La Garde de Nuit.
(function () {
  const NZ = 5;                 // zoom ou 1 pixel de la carte source = 1 pixel ecran
  const W = 9216, H = 6144;     // taille de la carte source
  const HOLD = {
    castle_holding: "Château", city_holding: "Cité", church_holding: "Temple", monastery_holding: "Monastère",
    tribal_holding: "Campement", pirate_den_holding: "Repaire de pirates", ruin_holding: "Ruines",
  };
  const MODES = [["royaumes", "Royaumes"], ["cultures", "Peuples"], ["religions", "Religions"], ["papier", "Carte seule"]];
  const FIELD = { cultures: "cu", religions: "fa" };
  // Zoom a partir duquel chaque rang de lieu apparait (1 : capitales et grandes cites, 2 : sieges, 3 : autres)
  const RANK_Z = { 1: 2.9, 2: 4, 3: 5 };
  // Placement des noms des grandes regions, ajuste a la main (pixels de la carte source, angle en degres)
  const LABEL_FIX = {
    e_the_reach: { l: [1010, 3640], a: -20 },
    e_the_stormlands: { l: [1830, 3430], a: 0, w: 620 },
    e_the_crownlands: { l: [1830, 3075], a: -12, w: 560 },
    e_the_riverlands: { l: [1330, 2830], a: 0 },
    e_the_westerlands: { l: [880, 3020], a: 35 },
  };

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const fmt = (n) => (n === "" || n == null ? "-" : Number(n).toLocaleString("fr-FR"));
  const json = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
  const text = (u) => fetch(u, { cache: "no-cache" }).then((r) => (r.ok ? r.text() : ""));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function parseCSV(t) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.trim());
    return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
  }

  async function init() {
    const [T, gRegions, gCultures, gReligions, routes, tradTxt, armTxt, repTxt] = await Promise.all([
      json("donnees/monde/titres.json"), json("donnees/monde/regions.json"), json("donnees/monde/cultures.json"),
      json("donnees/monde/religions.json"), json("donnees/monde/routes.json"),
      text("donnees/monde/traductions.csv"), text("donnees/armees.csv"), text("donnees/monde/reperes.csv"),
    ]);
    const FR = Object.fromEntries(parseCSV(tradTxt).map((r) => [r["Original"], r["Français"]]));
    const armees = parseCSV(armTxt), reperes = parseCSV(repTxt);
    const nom = (k) => (T[k] ? FR[T[k].vo || T[k].n] || T[k].n : k);
    const armee = (house) => {
      if (!house) return null;
      const h = norm("Maison " + house);
      return armees.find((r) => norm(r["Maison"]) === h || norm(r["Maison"]).startsWith(h + " "));
    };
    const places = Object.entries(T).filter(([, t]) => t.t === "b").map(([k, t]) => ({ k, t }));
    const placesOf = {};
    places.forEach((p) => (placesOf[p.t.r] ||= []).push(p.k));

    // ---------- Carte et fond ----------
    const map = L.map("map", { crs: L.CRS.Simple, minZoom: 1.5, maxZoom: 7, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 120, zoomControl: false, preferCanvas: true });
    const P = (x, y) => map.unproject([x, y], NZ);
    const world = L.latLngBounds(P(0, 0), P(W, H));
    map.setMaxBounds(L.latLngBounds(P(-1600, -400), P(W + 400, H + 400)));
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.setPrefix(false).addAttribution("Fond de carte : mod <em>A Game of Thrones</em> (CK3) · Lieux et noms VF : A Wiki of Ice and Fire, La Garde de Nuit · Univers © G. R. R. Martin");
    L.tileLayer("monde/tuiles/{z}/{x}_{y}.webp", { tileSize: 256, minZoom: 0, maxZoom: 7, minNativeZoom: 0, maxNativeZoom: NZ, noWrap: true, bounds: world, keepBuffer: 3 }).addTo(map);
    const toLL = (g) => g.map((poly) => poly.map((ring) => ring.map(([x, y]) => P(x, y))));

    // ---------- Zones des peuples et des cultes (sous les regions) ----------
    const areaPane = map.createPane("areas"); areaPane.style.zIndex = 405; areaPane.style.pointerEvents = "none";
    const areaRenderer = L.canvas({ pane: "areas", padding: 0.4 });
    const areas = { cultures: [], religions: [] };
    const cats = {};
    Object.entries({ cultures: gCultures, religions: gReligions }).forEach(([m, feats]) => {
      const count = {};
      places.forEach(({ t }) => { const v = t[FIELD[m]]; if (v) count[v] = (count[v] || 0) + 1; });
      const order = feats.map((f) => f.id).sort((a, b) => (count[b] || 0) - (count[a] || 0));
      cats[m] = new Map(order.map((v, i) => [v, { n: count[v] || 0, color: `hsl(${Math.round((i * 137.508) % 360)}, ${i % 2 ? 42 : 55}%, ${i % 3 === 0 ? 50 : i % 3 === 1 ? 60 : 42}%)` }]));
      feats.forEach((f) => {
        const lay = L.polygon(toLL(f.g), { renderer: areaRenderer, interactive: false, stroke: false, fill: false });
        lay.gid = f.id; areas[m].push(lay); lay.addTo(map);
      });
    });

    // ---------- Regions ----------
    const regionPane = map.createPane("regions"); regionPane.style.zIndex = 410;
    const renderer = L.canvas({ pane: "regions", padding: 0.4, tolerance: 1 });
    const feats = {}, regionLayers = [];
    let mode = "royaumes", hovered = null, selected = null, picking = false, legendHi = null, legendPin = null;
    gRegions.forEach((f) => {
      const lay = L.polygon(toLL(f.g), { renderer, smoothFactor: 0.6 });
      lay.fid = f.id; lay.f = f;
      lay.on("mouseover", (e) => { hovered = lay; lay.setStyle(styleFor(lay)); card(e.originalEvent, f.id); })
        .on("mouseout", () => { hovered = null; lay.setStyle(styleFor(lay)); card(null); })
        .on("mousemove", (e) => moveCard(e.originalEvent))
        .on("click", (e) => { if (picking) return; L.DomEvent.stopPropagation(e); const h = pickPlace(e.containerPoint); select(h || f.id, false); });
      lay.addTo(map);
      feats[f.id] = lay; regionLayers.push(lay);
    });

    function styleFor(lay) {
      const z = map.getZoom();
      const s = { stroke: true, color: "#2b1d10", weight: z >= 5 ? 2.6 : 2, opacity: 0.7, lineJoin: "round", fill: false, fillOpacity: 0 };
      if (mode === "royaumes") { s.fill = true; s.fillColor = T[lay.fid]?.c || "#888"; s.fillOpacity = clamp(0.46 - (z - 2.5) * 0.11, 0.08, 0.46); }
      if (lay === hovered) {
        s.fill = true; s.opacity = 0.95;
        if (mode === "royaumes") s.fillOpacity += 0.18; else { s.fillColor = "#fff3cf"; s.fillOpacity = 0.14; }
      }
      if (lay === selected) { s.color = "#f3d27a"; s.weight = 3.2; s.opacity = 1; }
      return s;
    }
    function areaStyle(lay, m) {
      if (mode !== m) return { fill: false, stroke: false };
      const z = map.getZoom(), focus = legendHi || legendPin;
      let op = clamp(0.55 - (z - 3) * 0.08, 0.25, 0.55);
      if (focus) op = lay.gid === focus ? 0.75 : 0.05;
      return { fill: true, fillColor: cats[m].get(lay.gid)?.color || "#999", fillOpacity: op, stroke: false };
    }
    function restyle() {
      regionLayers.forEach((l) => l.setStyle(styleFor(l)));
      Object.keys(areas).forEach((m) => areas[m].forEach((l) => l.setStyle(areaStyle(l, m))));
      if (selected) selected.bringToFront();
    }

    $("#map-modes").innerHTML = MODES.map(([k, l]) => `<button type="button" data-m="${k}"${k === mode ? ' class="active"' : ""}>${l}</button>`).join("");
    $("#map-modes").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setMode(b.dataset.m); });
    function setMode(m) {
      mode = m; legendHi = legendPin = null;
      document.querySelectorAll("#map-modes button").forEach((x) => x.classList.toggle("active", x.dataset.m === m));
      legend(); restyle();
    }

    // ---------- Legende (peuples, religions) ----------
    function legend() {
      const el = $("#legend");
      if (!FIELD[mode]) { el.hidden = true; el.innerHTML = ""; return; }
      el.hidden = false;
      el.innerHTML = `<p class="panel-title">Légende · ${mode === "cultures" ? "peuples" : "religions"}</p><div class="legend-list">` +
        [...cats[mode]].map(([v, c]) => `<button type="button" data-v="${esc(v)}"${legendPin === v ? ' class="pinned"' : ""}><i style="background:${c.color}"></i><span>${esc(v)}</span><b>${c.n || ""}</b></button>`).join("") + "</div>";
    }
    const restyleAreas = () => (areas[mode] || []).forEach((l) => l.setStyle(areaStyle(l, mode)));
    $("#legend").addEventListener("mouseover", (e) => { const b = e.target.closest("button[data-v]"); if (b && b.dataset.v !== legendHi) { legendHi = b.dataset.v; restyleAreas(); } });
    $("#legend").addEventListener("mouseleave", () => { if (legendHi) { legendHi = null; restyleAreas(); } });
    $("#legend").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      legendPin = legendPin === b.dataset.v ? null : b.dataset.v;
      document.querySelectorAll("#legend button").forEach((x) => x.classList.toggle("pinned", x.dataset.v === legendPin));
      restyleAreas();
    });

    // ---------- Routes (grandes routes des livres) ----------
    const roadPane = map.createPane("roads"); roadPane.style.zIndex = 420; roadPane.style.pointerEvents = "none";
    const roadRenderer = L.canvas({ pane: "roads", padding: 0.4 });
    const roadLayer = L.layerGroup();
    routes.forEach((r) => r.lines.forEach((ln) => L.polyline(ln.map(([x, y]) => P(x, y)), { renderer: roadRenderer, color: "#7c2a17", weight: 2.2, opacity: 0.75, lineCap: "round", interactive: false }).addTo(roadLayer)));
    roadLayer.addTo(map);
    const restyleRoads = () => { const z = map.getZoom(); roadLayer.eachLayer((l) => l.setStyle({ weight: z >= 5 ? 3 : z >= 4 ? 2.4 : 1.6 })); };

    // ---------- Noms et lieux : canvas, sans chevauchement ----------
    const regionItems = gRegions.map((f) => {
      let name = nom(f.id);
      if (name.length > 12) name = name.replace(/^(Les |Le |La |L')/, "");
      const fix = LABEL_FIX[f.id] || {}, [lx, ly] = fix.l || f.l;
      return { k: f.id, name, ll: P(lx, ly), w: fix.w || f.w, h: f.h, a: ((fix.a ?? f.a) * Math.PI) / 180, area: f.ar, essos: f.id.startsWith("k_") };
    }).sort((a, b) => b.area - a.area);
    const placeItems = places.map(({ k, t }) => ({ k, t, name: nom(k), ll: P(t.xy[0], t.xy[1]) }))
      .sort((a, b) => a.t.rk - b.t.rk || (b.t.hold === "city_holding") - (a.t.hold === "city_holding"));

    let showNames = true, showPlaces = true, hits = [];
    const LabelLayer = L.Layer.extend({
      onAdd(m) {
        this._c = L.DomUtil.create("canvas", "map-labels");
        m.getPane("labelsPane").appendChild(this._c);
        m.on("moveend resize", this._draw, this);
        m.on("zoomstart", () => this._c.classList.add("fading"));
        this._draw();
      },
      _draw() {
        const c = this._c, m = this._map, size = m.getSize(), pad = 0.25, dpr = window.devicePixelRatio || 1;
        const w = size.x * (1 + 2 * pad), h = size.y * (1 + 2 * pad);
        const tl = m.containerPointToLayerPoint([-size.x * pad, -size.y * pad]);
        c.width = w * dpr; c.height = h * dpr; c.style.width = w + "px"; c.style.height = h + "px";
        L.DomUtil.setPosition(c, tl);
        const ctx = c.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
        const z = m.getZoom(), s = Math.pow(2, z - NZ), boxes = [];
        hits = [];
        const rect = (cx, cy, hw, hh, a = 0) => {
          const co = Math.cos(a), si = Math.sin(a);
          return { pts: [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co]), axes: [[co, si], [-si, co]] };
        };
        const proj = (r, ax) => { let mn = Infinity, mx = -Infinity; r.pts.forEach(([x, y]) => { const v = x * ax[0] + y * ax[1]; if (v < mn) mn = v; if (v > mx) mx = v; }); return [mn, mx]; };
        const hit = (a, b) => [...a.axes, ...b.axes].every((ax) => { const p = proj(a, ax), q = proj(b, ax); return p[0] < q[1] && q[0] < p[1]; });
        const free = (r) => !boxes.some((o) => hit(r, o));
        const toCanvas = (ll) => { const p = m.latLngToLayerPoint(ll); return [p.x - tl.x, p.y - tl.y]; };

        // Lieux des livres, par ordre d'importance
        const drawPlaces = (keep) => {
          if (!showPlaces) return;
          for (const x of placeItems) {
            if (z < RANK_Z[x.t.rk] || !keep(x.t.rk)) continue;
            const [px, py] = toCanvas(x.ll);
            if (px < 0 || py < 0 || px > w || py > h) continue;
            const big = x.t.rk === 1;
            const r = big ? 6 : x.t.rk === 2 ? 4.5 : 3.5;
            const gb = rect(px, py, r + 1, r + 1);
            if (!free(gb)) continue;
            boxes.push(gb); glyph(ctx, x.t.hold, px, py, r, big);
            hits.push({ k: x.k, x: px, y: py });
            if (!showNames) continue;
            const fsz = big ? clamp(11 + (z - 3) * 1.5, 11, 16) : x.t.rk === 2 ? 12 : 11;
            ctx.font = big ? `700 ${fsz.toFixed(1)}px Cinzel, serif` : `600 ${fsz}px Inter, sans-serif`;
            const tw = ctx.measureText(x.name).width;
            const lb = rect(px + r + 4 + tw / 2, py, tw / 2 + 2, fsz / 2 + 1);
            if (!free(lb)) continue;
            boxes.push(lb);
            ctx.textAlign = "left";
            halo(ctx, x.name, px + r + 4, py, big ? 3.5 : 3, big ? "#24170c" : "#2b1d10");
            ctx.textAlign = "center";
          }
        };
        drawPlaces((rk) => rk === 1); // capitales et grandes cites d'abord
        // 1. Noms des regions (de loin), en fondu quand on s'approche
        const regionAlpha = clamp((4.3 - z) / 0.8, 0, 1);
        if (showNames && regionAlpha > 0) {
          ctx.globalAlpha = regionAlpha;
          for (const it of regionItems) {
            const label = it.name.toUpperCase(), sp = 0.16, cw = 0.8 + sp;
            const options = [[label]];
            const spaces = [...label.matchAll(/ /g)].map((x) => x.index);
            if (spaces.length) {
              const mid = spaces.reduce((b, i) => (Math.abs(i - label.length / 2) < Math.abs(b - label.length / 2) ? i : b), spaces[0]);
              options.push([label.slice(0, mid), label.slice(mid + 1)]);
            }
            let lines = options[0], fs = 0;
            options.forEach((ls) => {
              const f = Math.min((it.h * s * 0.55) / (ls.length === 1 ? 1 : 1.9), (it.w * s * 0.95) / (Math.max(...ls.map((l) => l.length)) * cw));
              if (f > fs * 1.08) { fs = f; lines = ls; }
            });
            fs = clamp(fs, 9.5, it.essos ? 20 : 26);
            const [px, py] = toCanvas(it.ll);
            if (px < -200 || py < -100 || px > w + 200 || py > h + 100) continue;
            const ang = clamp(it.a, -0.45, 0.45);
            let box = null, sz = fs;
            for (const k of [1, 0.82, 0.66, 0.52]) {
              sz = fs * k; if (sz < 8) break;
              ctx.font = `700 ${sz.toFixed(1)}px Cinzel, serif`;
              if ("letterSpacing" in ctx) ctx.letterSpacing = (sp * sz).toFixed(1) + "px";
              const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)), th = sz * (lines.length === 1 ? 1 : 2.1);
              const b = rect(px, py, tw / 2 + 4, th / 2 + 2, ang);
              if (free(b)) { box = b; break; }
            }
            if (!box) continue;
            boxes.push(box);
            ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
            lines.forEach((l, i) => halo(ctx, l, 0, (i - (lines.length - 1) / 2) * sz * 1.1, Math.max(2.5, sz * 0.22), "#24170c", 0.75));
            ctx.restore();
          }
          ctx.globalAlpha = 1;
          if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
        }

        drawPlaces((rk) => rk > 1);
        c.classList.remove("fading");
      },
    });
    function halo(ctx, s, x, y, lw, color, alpha = 0.88) {
      ctx.lineWidth = lw; ctx.strokeStyle = `rgba(239, 228, 200, ${alpha})`; ctx.strokeText(s, x, y);
      ctx.fillStyle = color; ctx.fillText(s, x, y);
    }
    function glyph(ctx, hold, x, y, r, major) {
      ctx.save(); ctx.translate(x, y);
      ctx.lineWidth = major ? 2 : 1.5; ctx.strokeStyle = "rgba(239, 228, 200, .95)";
      ctx.beginPath();
      if (hold === "city_holding") {
        ctx.moveTo(-r, r); ctx.lineTo(-r, -r / 4); ctx.lineTo(0, -r * 1.1); ctx.lineTo(r, -r / 4); ctx.lineTo(r, r); ctx.closePath(); ctx.fillStyle = "#6e3b1c";
      } else if (hold === "church_holding" || hold === "monastery_holding") {
        for (let i = 0; i < 14; i++) { const a = (i * Math.PI) / 7 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r * 1.05; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fillStyle = "#2f4a78";
      } else if (hold === "ruin_holding") {
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fillStyle = "#7a7166";
      } else if (hold === "castle_holding") {
        ctx.moveTo(-r, r); ctx.lineTo(-r, -r); ctx.lineTo(-r / 2, -r); ctx.lineTo(-r / 2, -r / 2); ctx.lineTo(r / 2, -r / 2); ctx.lineTo(r / 2, -r); ctx.lineTo(r, -r); ctx.lineTo(r, r); ctx.closePath(); ctx.fillStyle = "#3b2a1a";
      } else {
        ctx.moveTo(0, -r); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); ctx.fillStyle = "#5b4a2c";
      }
      ctx.stroke(); ctx.fill();
      if (major) { ctx.beginPath(); ctx.arc(0, 0, r + 3.5, 0, Math.PI * 2); ctx.strokeStyle = "rgba(59, 42, 26, .7)"; ctx.lineWidth = 1.2; ctx.stroke(); }
      ctx.restore();
    }
    map.createPane("labelsPane").style.zIndex = 450;
    map.getPane("labelsPane").style.pointerEvents = "none";
    const labels = new LabelLayer().addTo(map);
    if (document.fonts) document.fonts.ready.then(() => labels._draw());

    function pickPlace(cp) {
      if (!showPlaces) return null;
      const size = map.getSize(), px = cp.x + size.x * 0.25, py = cp.y + size.y * 0.25;
      let best = null, bd = 12 * 12;
      hits.forEach((h) => { const d = (h.x - px) ** 2 + (h.y - py) ** 2; if (d < bd) { bd = d; best = h.k; } });
      return best;
    }

    // ---------- Fiche de survol ----------
    const hc = $("#hovercard");
    function card(ev, k) {
      if (!ev || !k) { hc.hidden = true; return; }
      const t = T[k];
      const sub = t.t === "b" ? `${HOLD[t.hold] || "Lieu"} · ${esc(nom(t.r))}` : `Région${t.hh ? " · Maison " + esc(t.hh) : ""}`;
      hc.innerHTML = `<strong>${esc(nom(k))}</strong><span>${sub}</span>`;
      hc.hidden = false; moveCard(ev);
    }
    function moveCard(ev) {
      if (!ev || hc.hidden) return;
      const r = $("#map-shell").getBoundingClientRect();
      hc.style.transform = `translate(${ev.clientX - r.left + 16}px, ${ev.clientY - r.top + 14}px)`;
    }
    map.on("mousemove", (e) => {
      const h = pickPlace(e.containerPoint);
      $("#map").classList.toggle("on-hold", !!h);
      if (h) card(e.originalEvent, h); else if (hovered) card(e.originalEvent, hovered.fid); else card(null);
    });
    map.on("click", (e) => { if (picking) return; const h = pickPlace(e.containerPoint); if (h) select(h, false); });

    // ---------- Selection et fiche ----------
    let selMarker = null;
    function select(k, fly = true) {
      const t = T[k]; if (!t) return;
      const prev = selected; selected = feats[k] || null;
      if (prev) prev.setStyle(styleFor(prev));
      if (selMarker) { map.removeLayer(selMarker); selMarker = null; }
      if (selected) {
        selected.setStyle(styleFor(selected)); selected.bringToFront();
        if (fly) map.flyToBounds(selected.getBounds(), { padding: [80, 80], maxZoom: 4, duration: 0.8 });
      } else if (t.xy) {
        selMarker = L.circleMarker(P(t.xy[0], t.xy[1]), { radius: 12, color: "#f3d27a", weight: 2.5, fill: false, interactive: false }).addTo(map);
        if (fly) map.flyTo(P(t.xy[0], t.xy[1]), Math.max(map.getZoom(), RANK_Z[t.rk] + 0.75), { duration: 0.8 });
      }
      panel(k);
      history.replaceState(null, "", location.pathname + location.search + "#" + k);
    }

    function panel(k) {
      const t = T[k], a = armee(t.hh), isPlace = t.t === "b";
      const list = isPlace ? [] : (placesOf[k] || []).slice().sort((x, y) => T[x].rk - T[y].rk || nom(x).localeCompare(nom(y), "fr"));
      const dot = (x) => (T[x].hold === "city_holding" ? "#6e3b1c" : T[x].hold === "church_holding" ? "#2f4a78" : "#3b2a1a");
      $("#info").innerHTML = `
        <div class="info-head" style="--c:${isPlace ? T[t.r]?.c || "#c9a45c" : t.c}">
          <p class="info-tier">${isPlace ? HOLD[t.hold] || "Lieu" : "Région"}</p>
          <h2>${esc(nom(k))}</h2>
          ${t.vo && t.vo !== nom(k) ? `<p class="info-vo">VO : ${esc(t.vo)}</p>` : ""}
        </div>
        ${isPlace ? `<nav class="crumbs"><button type="button" data-k="${t.r}">${esc(nom(t.r))}</button></nav>` : ""}
        <dl class="info-list">
          ${t.h ? `<dt>${isPlace ? "Seigneur" : "Suzerain"}</dt><dd>${esc(t.h)}${t.hh ? `<span>Maison ${esc(t.hh)}</span>` : ""}</dd>` : ""}
          ${t.cu ? `<dt>Peuple</dt><dd>${esc(t.cu)}</dd>` : ""}
          ${t.fa ? `<dt>Religion</dt><dd>${esc(t.fa)}</dd>` : ""}
        </dl>
        ${a ? `<div class="info-army"><p>Forces de la maison ${esc(t.hh)}</p><div><span>Levées<b>${fmt(a["Levées"])}</b></span><span>Chevaliers<b>${fmt(a["Chevaliers"])}</b></span><span>Navires<b>${fmt(a["Flotte"])}</b></span></div><a href="armees.html">Voir les effectifs</a></div>` : ""}
        ${list.length ? `<p class="info-sub">Lieux · ${list.length}</p><div class="info-kids">${list.map((x) => `<button type="button" data-k="${x}"><i style="background:${dot(x)}"></i>${esc(nom(x))}</button>`).join("")}</div>` : ""}
        <p class="info-date">${t.h ? "Seigneur en 183 AC · " : ""}Lieux et personnages issus des livres</p>`;
      $("#info-panel").hidden = false;
    }
    $("#info").addEventListener("click", (e) => { const b = e.target.closest("button[data-k]"); if (b) select(b.dataset.k); });
    $("#info-close").addEventListener("click", () => {
      $("#info-panel").hidden = true;
      const prev = selected; selected = null; if (prev) prev.setStyle(styleFor(prev));
      if (selMarker) { map.removeLayer(selMarker); selMarker = null; }
      history.replaceState(null, "", location.pathname + location.search);
    });

    // ---------- Recherche ----------
    const index = Object.keys(T).map((k) => ({ k, s: norm([nom(k), T[k].vo, T[k].hh].filter(Boolean).join(" ")), r: T[k].t === "e" ? 0 : T[k].rk }));
    const search = $("#place-search"), results = $("#place-results");
    search.addEventListener("input", () => {
      const q = norm(search.value.trim());
      if (q.length < 2) { results.innerHTML = ""; return; }
      const found = index.filter((x) => x.s.includes(q)).sort((a, b) => (b.s.startsWith(q) - a.s.startsWith(q)) || a.r - b.r).slice(0, 8);
      results.innerHTML = found.length ? found.map(({ k }) => {
        const t = T[k];
        return `<button type="button" data-k="${k}">${esc(nom(k))}<span>${t.t === "b" ? `${HOLD[t.hold] || "Lieu"} · ${esc(nom(t.r))}` : "Région"}</span></button>`;
      }).join("") : `<p class="empty">Aucun résultat.</p>`;
    });
    results.addEventListener("click", (e) => { const b = e.target.closest("button[data-k]"); if (!b) return; select(b.dataset.k); results.innerHTML = ""; search.value = ""; search.blur(); });

    // ---------- Calques, vues, plein ecran, reperes ----------
    $("#layers").addEventListener("change", (e) => {
      const k = e.target.dataset.k, on = e.target.checked;
      if (k === "routes") { if (on) roadLayer.addTo(map); else map.removeLayer(roadLayer); }
      if (k === "noms") showNames = on;
      if (k === "baronnies") showPlaces = on;
      if (k === "frontieres") regionPane.style.opacity = on ? "" : "0";
      labels._draw();
    });
    const VUES = { westeros: [[480, 250], [2450, 4350]], essos: [[2300, 1900], [4300, 4400]], monde: [[0, 0], [W, H]] };
    const vb = (v) => L.latLngBounds(VUES[v].map(([x, y]) => P(x, y)));
    $("#views").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) map.flyToBounds(vb(b.dataset.v), { duration: 1 }); });
    const shell = $("#map-shell");
    $("#map-full").addEventListener("click", () => (document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen && shell.requestFullscreen()));
    document.addEventListener("fullscreenchange", () => setTimeout(() => map.invalidateSize(), 100));
    $("#panel-toggle").addEventListener("click", () => $("#map-panel").classList.toggle("collapsed"));

    const repLayer = L.layerGroup().addTo(map);
    reperes.filter((r) => r["X"] && r["Y"]).forEach((r) => {
      L.marker(P(+r["X"], +r["Y"]), { icon: L.divIcon({ className: "rep", html: "<i></i>", iconSize: [18, 18], iconAnchor: [9, 18] }) })
        .bindPopup(`<strong>${esc(r["Nom"])}</strong>${r["Description"] ? `<p>${esc(r["Description"])}</p>` : ""}`).addTo(repLayer);
    });
    $("#map-pick").addEventListener("click", () => { picking = !picking; $("#map-pick").classList.toggle("active", picking); shell.classList.toggle("picking", picking); });
    map.on("click", (e) => {
      if (!picking) return;
      const p = map.project(e.latlng, NZ);
      const line = `Nom du repère,Description,${Math.round(p.x)},${Math.round(p.y)}`;
      if (navigator.clipboard) navigator.clipboard.writeText(line).catch(() => {});
      L.popup().setLatLng(e.latlng).setContent(`<strong>Ligne copiée</strong><p>À coller dans donnees/monde/reperes.csv :</p><code>${esc(line)}</code>`).openOn(map);
    });

    // ---------- Demarrage ----------
    map.on("zoomend", () => { restyle(); restyleRoads(); });
    map.fitBounds(vb("westeros"), { paddingTopLeft: [window.innerWidth > 760 ? 320 : 0, 0] });
    const startMode = new URLSearchParams(location.search).get("mode"); // lien direct : cartes.html?mode=religions
    if (MODES.some(([k]) => k === startMode)) setMode(startMode); else restyle();
    restyleRoads(); labels._draw();
    $("#mm-hint").textContent = "Cliquez sur une région ou sur un lieu";
    const start = decodeURIComponent(location.hash.slice(1));
    if (T[start]) select(start);
  }

  init().catch((e) => {
    console.error(e);
    const m = document.getElementById("map");
    if (m) m.innerHTML = `<p class="empty" style="padding:24px">Impossible de charger la carte (${esc(e.message)}).</p>`;
  });
})();
