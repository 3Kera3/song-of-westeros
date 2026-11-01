// Song of Westeros - carte du monde interactive.
// Fond et donnees : mod "A Game of Thrones" pour Crusader Kings III. Noms VF : A Wiki of Ice and Fire / La Garde de Nuit.
(function () {
  const NZ = 5;                 // zoom ou 1 pixel de la carte source = 1 pixel ecran
  const W = 9216, H = 6144;     // taille de la carte source
  const ORDER = ["e", "k", "d", "c"];
  const TIER = {
    e: { file: "regions", label: "Région", enfants: "Territoires" },
    k: { file: "territoires", label: "Territoire", enfants: "Duchés" },
    d: { file: "duches", label: "Duché", enfants: "Comtés" },
    c: { file: "comtes", label: "Comté", enfants: "Châteaux et cités" },
    b: { label: "Baronnie" },
  };
  const HOLD = {
    castle_holding: "Château", city_holding: "Cité", church_holding: "Temple", monastery_holding: "Monastère",
    tribal_holding: "Camp tribal", pirate_den_holding: "Repaire de pirates", ruin_holding: "Ruines",
  };
  // Plages de zoom ou chaque niveau est lisible (noms et clic)
  const WIN = { e: [0, 3], k: [3, 3.75], d: [3.75, 4.55], c: [4.55, 5.6] }; // un seul niveau de noms a la fois
  const MODES = [["royaumes", "Royaumes"], ["maisons", "Maisons (183 AC)"], ["cultures", "Cultures"], ["religions", "Religions"], ["papier", "Carte seule"]];

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

  // Couleur douce et stable a partir d'un nom (maisons, cultures, religions)
  function hashColor(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h >>>= 0;
    return `hsl(${h % 360}, ${38 + (h >> 9) % 18}%, ${44 + (h >> 17) % 16}%)`;
  }

  async function init() {
    const [T, gE, gK, gD, gC, routes, tradTxt, modTxt, autoTxt, armTxt, repTxt] = await Promise.all([
      json("donnees/monde/titres.json"), json("donnees/monde/regions.json"), json("donnees/monde/territoires.json"),
      json("donnees/monde/duches.json"), json("donnees/monde/comtes.json"), json("donnees/monde/routes.json"),
      text("donnees/monde/traductions.csv"), text("donnees/monde/traductions-mod.csv"), text("donnees/monde/traductions-auto.csv"), text("donnees/armees.csv"), text("donnees/monde/reperes.csv"),
    ]);
    const geo = { e: gE, k: gK, d: gD, c: gC };
    const FR = Object.fromEntries([...parseCSV(autoTxt), ...parseCSV(modTxt), ...parseCSV(tradTxt)].map((r) => [r["Original"], r["Français"]])); // traductions.csv prioritaire
    const armees = parseCSV(armTxt), reperes = parseCSV(repTxt);
    const nom = (k) => (T[k] ? FR[T[k].vo || T[k].n] || T[k].n : k);
    const trd = (s) => (s ? FR[s] || s : s);
    const armee = (house) => {
      if (!house) return null;
      const h = norm("Maison " + house);
      return armees.find((r) => norm(r["Maison"]) === h || norm(r["Maison"]).startsWith(h + " "));
    };

    // ---------- Carte et fond ----------
    const map = L.map("map", { crs: L.CRS.Simple, minZoom: 1.5, maxZoom: 7, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 120, zoomControl: false, preferCanvas: true });
    const P = (x, y) => map.unproject([x, y], NZ);
    const world = L.latLngBounds(P(0, 0), P(W, H));
    map.setMaxBounds(L.latLngBounds(P(-1600, -400), P(W + 400, H + 400))); // marge pour degager les panneaux
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.setPrefix(false).addAttribution("Carte : mod <em>A Game of Thrones</em> (CK3) · Noms VF : A Wiki of Ice and Fire, La Garde de Nuit · Univers © G. R. R. Martin");
    L.tileLayer("monde/tuiles/{z}/{x}_{y}.webp", { tileSize: 256, minZoom: 0, maxZoom: 7, minNativeZoom: 0, maxNativeZoom: NZ, noWrap: true, bounds: world, keepBuffer: 3 }).addTo(map);

    // ---------- Territoires (un seul canvas pour tous les niveaux) ----------
    const politicalPane = map.createPane("political"); politicalPane.style.zIndex = 410;
    const renderer = L.canvas({ pane: "political", padding: 0.4, tolerance: 1 });
    const feats = {}, byTier = { e: [], k: [], d: [], c: [] };
    ORDER.forEach((t) => geo[t].forEach((f) => {
      const lay = L.polygon(f.g.map((poly) => poly.map((ring) => ring.map(([x, y]) => P(x, y)))), { renderer, interactive: false, smoothFactor: 0.6 });
      lay.fid = f.id; lay.tier = t; lay.f = f;
      lay.on("mouseover", (e) => { hovered = lay; lay.setStyle(styleFor(lay)); card(e.originalEvent, f.id); })
        .on("mouseout", () => { hovered = null; lay.setStyle(styleFor(lay)); card(null); })
        .on("mousemove", (e) => moveCard(e.originalEvent))
        .on("click", (e) => { if (picking) return; L.DomEvent.stopPropagation(e); const h = pickHolding(e.containerPoint); select(h || f.id, false); });
      lay.addTo(map);
      feats[f.id] = lay; byTier[t].push(lay);
    }));

    let mode = "royaumes", hovered = null, selected = null, picking = false;
    const colorFor = (k) => {
      const t = T[k];
      if (mode === "royaumes") return t.c || "#8a8a8a";
      if (mode === "maisons") return t.hh ? hashColor(t.hh) : "#9a9184";
      if (mode === "cultures") return t.cu ? hashColor(t.cu) : "#9a9184";
      if (mode === "religions") return t.fa ? hashColor("foi" + t.fa) : "#9a9184";
      return null;
    };
    const fillTier = () => (mode === "royaumes" ? "e" : mode === "papier" ? null : "c");
    const activeTier = (z) => (z < WIN.k[0] ? "e" : z < WIN.d[0] ? "k" : z < WIN.c[0] ? "d" : "c");

    function styleFor(lay) {
      const t = lay.tier, z = map.getZoom(), rank = ORDER.indexOf(t);
      const visible = z >= [0, 2.75, 3.6, 4.4][rank];
      const s = {
        stroke: visible, color: "#2b1d10", lineJoin: "round",
        weight: [2.2, 1.3, 0.9, 0.6][rank] * (z >= 5 ? 1.25 : 1),
        opacity: [0.75, 0.45, 0.35, 0.28][rank], fill: false, fillOpacity: 0,
      };
      if (t === fillTier()) {
        s.fill = true; s.fillColor = colorFor(lay.fid);
        s.fillOpacity = t === "e" ? clamp(0.46 - (z - 2.5) * 0.12, 0.1, 0.46) : clamp(0.55 - (z - 3.5) * 0.1, 0.22, 0.55);
      }
      if (lay === hovered) { s.fill = true; s.fillColor = "#fff3cf"; s.fillOpacity = 0.28; s.stroke = true; s.opacity = 0.9; }
      if (lay === selected) { s.stroke = true; s.color = "#f3d27a"; s.weight = 3; s.opacity = 1; }
      return s;
    }
    function restyle() {
      const z = map.getZoom(), act = activeTier(z);
      ORDER.forEach((t) => byTier[t].forEach((l) => {
        // les niveaux plus grossiers restent cliquables la ou il n'existe pas de niveau plus fin (Essos)
        l.options.interactive = ORDER.indexOf(t) <= ORDER.indexOf(act);
        l.setStyle(styleFor(l));
      }));
      if (selected) selected.bringToFront();
      $("#mm-hint").textContent = "Au clic : " + TIER[act].label.toLowerCase() + (z >= 5 ? ", château ou cité" : "");
    }

    $("#map-modes").innerHTML = MODES.map(([k, l]) => `<button type="button" data-m="${k}"${k === mode ? ' class="active"' : ""}>${l}</button>`).join("");
    $("#map-modes").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      mode = b.dataset.m;
      document.querySelectorAll("#map-modes button").forEach((x) => x.classList.toggle("active", x === b));
      restyle();
    });

    // ---------- Routes ----------
    const roadPane = map.createPane("roads"); roadPane.style.zIndex = 420; roadPane.style.pointerEvents = "none";
    const roadRenderer = L.canvas({ pane: "roads", padding: 0.4 });
    const roadLayer = L.layerGroup();
    routes.forEach((r) => r.lines.forEach((ln) => {
      const major = r.type !== "secondaire";
      L.polyline(ln.map(([x, y]) => P(x, y)), { renderer: roadRenderer, color: major ? "#7c2a17" : "#5d4632", weight: major ? 2.4 : 1.1, opacity: major ? 0.8 : 0.55, dashArray: major ? null : "3 5", lineCap: "round", interactive: false, major }).addTo(roadLayer);
    }));
    roadLayer.addTo(map);
    function restyleRoads() {
      const z = map.getZoom();
      roadLayer.eachLayer((l) => l.setStyle(l.options.major ? { weight: z >= 5 ? 3.2 : z >= 4 ? 2.4 : 1.6 } : { opacity: z < 3.5 ? 0 : 0.55, weight: z >= 5 ? 1.5 : 1.1 }));
    }

    // ---------- Noms et chateaux : dessines sur un canvas, sans chevauchement ----------
    const items = [];
    ORDER.forEach((t, rank) => geo[t].forEach((f) => {
      let name = nom(f.id);
      if ((t === "e" || t === "k") && name.length > 12) name = name.replace(/^(Les |Le |La |L')/, ""); // plus court sur la carte
      const win = t === "e" && f.id.startsWith("k_") ? [0, WIN.d[0]] : WIN[t]; // cites libres : region et territoire a la fois
      items.push({ kind: "label", t, rank, win, k: f.id, name, ll: P(f.l[0], f.l[1]), w: f.w, h: f.h, a: (f.a * Math.PI) / 180, area: f.ar });
    }));
    const holdings = Object.entries(T).filter(([, t]) => t.t === "b" && t.hold && HOLD[t.hold] && t.xy)
      .map(([k, t]) => ({ kind: "hold", k, name: nom(k), hold: t.hold, cap: !!t.cap, ll: P(t.xy[0], t.xy[1]) }));
    items.sort((a, b) => a.rank - b.rank || b.area - a.area);
    holdings.sort((a, b) => b.cap - a.cap || (a.hold === "city_holding" ? -1 : 1));

    const STYLE = {
      e: { font: "700", fam: "Cinzel", spacing: 0.18, upper: true, max: 36, min: 9.5, color: "#24170c" },
      k: { font: "600", fam: "Cinzel", spacing: 0.14, upper: true, max: 22, min: 10, color: "#33230f" },
      d: { font: "600", fam: "Cinzel", spacing: 0.05, upper: false, max: 19, min: 11, color: "#3a2814" },
      c: { font: "600", fam: "Inter", spacing: 0.02, upper: false, max: 14, min: 10.5, color: "#3a2a18" },
    };
    let showNames = true, showHold = true, hits = [];
    const LabelLayer = L.Layer.extend({
      onAdd(m) {
        this._c = L.DomUtil.create("canvas", "map-labels");
        m.getPane("labelsPane").appendChild(this._c);
        m.on("moveend resize", this._draw, this);
        m.on("zoomstart", this._hide, this);
        this._draw();
      },
      onRemove(m) { this._c.remove(); m.off("moveend resize", this._draw, this); m.off("zoomstart", this._hide, this); },
      _hide() { this._c.classList.add("fading"); },
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
        // Collision exacte entre rectangles inclines (axes separateurs)
        const rect = (cx, cy, hw, hh, a = 0) => {
          const c = Math.cos(a), s2 = Math.sin(a);
          const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [cx + x * c - y * s2, cy + x * s2 + y * c]);
          return { pts, axes: [[c, s2], [-s2, c]] };
        };
        const proj = (r, ax) => { let mn = Infinity, mx = -Infinity; r.pts.forEach(([x, y]) => { const v = x * ax[0] + y * ax[1]; if (v < mn) mn = v; if (v > mx) mx = v; }); return [mn, mx]; };
        const hit = (a, b) => [...a.axes, ...b.axes].every((ax) => { const p = proj(a, ax), q = proj(b, ax); return p[0] < q[1] && q[0] < p[1]; });
        const free = (r) => !boxes.some((o) => hit(r, o));
        const box4 = (b) => rect((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, (b[2] - b[0]) / 2, (b[3] - b[1]) / 2);
        const toCanvas = (ll) => { const p = m.latLngToLayerPoint(ll); return [p.x - tl.x, p.y - tl.y]; };

        // Chateaux et cites (dessines d'abord pour reserver leur place)
        if (showHold && z >= 5) {
          holdings.forEach((x) => {
            if (!x.cap && z < 6.25) return;
            const [px, py] = toCanvas(x.ll);
            if (px < 0 || py < 0 || px > w || py > h) return;
            const r = x.cap ? 4.5 : 3.5;
            const box = box4([px - r - 1, py - r - 1, px + r + 1, py + r + 1]);
            if (!free(box)) return;
            boxes.push(box); glyph(ctx, x.hold, px, py, r);
            hits.push({ k: x.k, x: px, y: py });
            const showLbl = x.cap ? z >= 5.5 : z >= 6.75;
            if (showLbl && showNames) {
              ctx.font = `600 ${x.cap ? 12 : 11}px Inter, sans-serif`;
              const tw = ctx.measureText(x.name).width;
              const lb = box4([px + r + 3, py - 7, px + r + 5 + tw, py + 7]);
              if (free(lb)) {
                boxes.push(lb);
                ctx.textAlign = "left";
                halo(ctx, x.name, px + r + 4, py, 3, "#2b1d10");
                ctx.textAlign = "center";
              }
            }
          });
        }
        if (!showNames) { c.classList.remove("fading"); return; }
        // Noms des territoires, du plus grand au plus petit niveau
        for (const it of items) {
          const [z0, z1] = it.win;
          if (z < z0 || z >= z1) continue;
          if (it.t === "c" && z >= 5.5 && showHold) continue; // de tres pres, les chateaux prennent le relais
          const st = STYLE[it.t];
          const label = st.upper ? it.name.toUpperCase() : it.name;
          const cw = st.upper ? 0.8 + st.spacing : 0.56 + st.spacing;
          // une ou deux lignes : on garde la disposition qui permet le texte le plus grand
          const options = [[label]];
          const sp = [...label.matchAll(/ /g)].map((m) => m.index);
          if (sp.length) {
            const mid = sp.reduce((b, i) => (Math.abs(i - label.length / 2) < Math.abs(b - label.length / 2) ? i : b), sp[0]);
            options.push([label.slice(0, mid), label.slice(mid + 1)]);
          }
          let lines = null, fs = 0;
          options.forEach((ls) => {
            const longest = Math.max(...ls.map((l) => l.length));
            const f = Math.min((it.h * s * 0.55) / (ls.length === 1 ? 1 : 1.9), (it.w * s * 0.95) / (longest * cw));
            if (f > fs * 1.08) { fs = f; lines = ls; }
          });
          if (fs < st.min) continue;
          fs = Math.min(fs, st.max);
          const [px, py] = toCanvas(it.ll);
          if (px < -200 || py < -100 || px > w + 200 || py > h + 100) continue;
          ctx.font = `${st.font} ${fs.toFixed(1)}px ${st.fam}, serif`;
          if ("letterSpacing" in ctx) ctx.letterSpacing = (st.spacing * fs).toFixed(1) + "px";
          const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)), th = fs * (lines.length === 1 ? 1 : 2.1);
          const box = rect(px, py, tw / 2 + 4, th / 2 + 2, it.a);
          if (!free(box)) continue;
          boxes.push(box);
          ctx.save(); ctx.translate(px, py); ctx.rotate(it.a);
          lines.forEach((l, i) => halo(ctx, l, 0, (i - (lines.length - 1) / 2) * fs * 1.1, Math.max(2.5, fs * 0.22), st.color, it.t === "e" ? 0.75 : 0.85));
          ctx.restore();
        }
        if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
        c.classList.remove("fading");
      },
    });
    function halo(ctx, s, x, y, lw, color, alpha = 0.85) {
      ctx.lineWidth = lw; ctx.strokeStyle = `rgba(239, 228, 200, ${alpha})`; ctx.strokeText(s, x, y);
      ctx.fillStyle = color; ctx.fillText(s, x, y);
    }
    function glyph(ctx, hold, x, y, r) {
      ctx.save(); ctx.translate(x, y);
      ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(239, 228, 200, .95)";
      ctx.beginPath();
      if (hold === "castle_holding") { // tour crenelee
        ctx.moveTo(-r, r); ctx.lineTo(-r, -r); ctx.lineTo(-r / 2, -r); ctx.lineTo(-r / 2, -r / 2); ctx.lineTo(r / 2, -r / 2); ctx.lineTo(r / 2, -r); ctx.lineTo(r, -r); ctx.lineTo(r, r); ctx.closePath();
        ctx.fillStyle = "#3b2a1a";
      } else if (hold === "city_holding") { // maison a pignon
        ctx.moveTo(-r, r); ctx.lineTo(-r, -r / 4); ctx.lineTo(0, -r * 1.1); ctx.lineTo(r, -r / 4); ctx.lineTo(r, r); ctx.closePath();
        ctx.fillStyle = "#6e4a2c";
      } else if (hold === "church_holding" || hold === "monastery_holding") { // etoile a sept branches simplifiee
        for (let i = 0; i < 14; i++) { const a = (i * Math.PI) / 7 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r * 1.05; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fillStyle = "#2f4a78";
      } else if (hold === "ruin_holding") {
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fillStyle = "#7a7166";
      } else { // camp, repaire
        ctx.moveTo(0, -r); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); ctx.fillStyle = "#5b4a2c";
      }
      ctx.stroke(); ctx.fill(); ctx.restore();
    }
    map.createPane("labelsPane").style.zIndex = 450;
    map.getPane("labelsPane").style.pointerEvents = "none";
    const labels = new LabelLayer().addTo(map);
    if (document.fonts) document.fonts.ready.then(() => labels._draw());

    function pickHolding(cp) {
      if (map.getZoom() < 5 || !showHold) return null;
      const size = map.getSize(), px = cp.x + size.x * 0.25, py = cp.y + size.y * 0.25;
      let best = null, bd = 11 * 11;
      hits.forEach((h) => { const d = (h.x - px) ** 2 + (h.y - py) ** 2; if (d < bd) { bd = d; best = h.k; } });
      return best;
    }

    // ---------- Fiche de survol ----------
    const hc = $("#hovercard");
    function card(ev, k) {
      if (!ev || !k) { hc.hidden = true; return; }
      const t = T[k];
      hc.innerHTML = `<strong>${esc(nom(k))}</strong><span>${t.t === "b" ? HOLD[t.hold] || "Baronnie" : TIER[t.t].label}${t.hh ? " · Maison " + esc(t.hh) : ""}</span>`;
      hc.hidden = false; moveCard(ev);
    }
    function moveCard(ev) {
      if (!ev || hc.hidden) return;
      const r = $("#map-shell").getBoundingClientRect();
      hc.style.transform = `translate(${ev.clientX - r.left + 16}px, ${ev.clientY - r.top + 14}px)`;
    }
    map.on("mousemove", (e) => {
      const h = pickHolding(e.containerPoint);
      $("#map").classList.toggle("on-hold", !!h);
      if (h) card(e.originalEvent, h); else if (!hovered) card(null);
    });
    map.on("click", (e) => { if (picking) return; const h = pickHolding(e.containerPoint); if (h) select(h, false); });

    // ---------- Selection et fiche d'information ----------
    const chain = (k) => { const out = []; let p = T[k]?.p; while (p && T[p]) { out.unshift(p); p = T[p].p; } return out; };
    const kidsOf = {};
    Object.entries(T).forEach(([k, t]) => { if (t.p && (t.t !== "b" || HOLD[t.hold])) (kidsOf[t.p] ||= []).push(k); });
    let selMarker = null;

    function select(k, fly = true) {
      const t = T[k]; if (!t) return;
      const prev = selected; selected = feats[k] || null;
      if (prev) prev.setStyle(styleFor(prev));
      if (selMarker) { map.removeLayer(selMarker); selMarker = null; }
      if (selected) {
        selected.setStyle(styleFor(selected)); selected.bringToFront();
        if (fly) map.flyToBounds(selected.getBounds(), { padding: [80, 80], maxZoom: { e: 3, k: 3.6, d: 4.4, c: 5.25 }[selected.tier], duration: 0.8 });
      } else if (t.xy) {
        selMarker = L.circleMarker(P(t.xy[0], t.xy[1]), { radius: 11, color: "#f3d27a", weight: 2.5, fill: false, interactive: false }).addTo(map);
        if (fly) map.flyTo(P(t.xy[0], t.xy[1]), 6, { duration: 0.8 });
      }
      panel(k);
      history.replaceState(null, "", "#" + k);
    }

    function panel(k) {
      const t = T[k], a = armee(t.hh);
      const tierLabel = t.t === "b" ? HOLD[t.hold] || "Baronnie" : TIER[t.t].label;
      const crumbs = chain(k).map((p) => `<button type="button" data-k="${p}">${esc(nom(p))}</button>`).join("<span>›</span>");
      const kids = (kidsOf[k] || []).slice().sort((x, y) => nom(x).localeCompare(nom(y), "fr"));
      const swatch = t.c || T[t.p]?.c || "#c9a45c";
      $("#info").innerHTML = `
        <div class="info-head" style="--c:${swatch}">
          <p class="info-tier">${tierLabel}</p>
          <h2>${esc(nom(k))}</h2>
          ${t.vo && t.vo !== nom(k) ? `<p class="info-vo">VO : ${esc(t.vo)}</p>` : ""}
        </div>
        ${crumbs ? `<nav class="crumbs">${crumbs}</nav>` : ""}
        <dl class="info-list">
          ${t.h ? `<dt>${t.t === "e" ? "Suzerain" : "Seigneur"}</dt><dd>${esc(t.h)}${t.hh ? `<span>Maison ${esc(t.hh)}</span>` : ""}</dd>` : ""}
          ${t.cu ? `<dt>Culture</dt><dd>${esc(trd(t.cu))}</dd>` : ""}
          ${t.fa ? `<dt>Religion</dt><dd>${esc(trd(t.fa))}</dd>` : ""}
        </dl>
        ${a ? `<div class="info-army"><p>Forces de la maison ${esc(t.hh)}</p><div><span>Levées<b>${fmt(a["Levées"])}</b></span><span>Chevaliers<b>${fmt(a["Chevaliers"])}</b></span><span>Navires<b>${fmt(a["Flotte"])}</b></span></div><a href="armees.html">Voir les effectifs</a></div>` : ""}
        ${kids.length ? `<p class="info-sub">${TIER[t.t]?.enfants || ""} · ${kids.length}</p><div class="info-kids">${kids.map((x) => `<button type="button" data-k="${x}"><i style="background:${T[x].c || colorFor(x) || "#8a7a60"}"></i>${esc(nom(x))}</button>`).join("")}</div>` : ""}
        <p class="info-date">Situation en 183 AC</p>`;
      $("#info-panel").hidden = false;
    }
    $("#info").addEventListener("click", (e) => { const b = e.target.closest("button[data-k]"); if (b) select(b.dataset.k); });
    $("#info-close").addEventListener("click", () => {
      $("#info-panel").hidden = true;
      const prev = selected; selected = null; if (prev) prev.setStyle(styleFor(prev));
      if (selMarker) { map.removeLayer(selMarker); selMarker = null; }
      history.replaceState(null, "", location.pathname);
    });

    // ---------- Recherche ----------
    const index = Object.keys(T).filter((k) => feats[k] || (T[k].t === "b" && HOLD[T[k].hold]))
      .map((k) => ({ k, s: norm([nom(k), T[k].vo, T[k].hh].filter(Boolean).join(" ")), r: { e: 0, k: 1, d: 2, c: 3, b: 4 }[T[k].t] }));
    const search = $("#place-search"), results = $("#place-results");
    search.addEventListener("input", () => {
      const q = norm(search.value.trim());
      if (q.length < 2) { results.innerHTML = ""; return; }
      const hitsQ = index.filter((x) => x.s.includes(q)).sort((a, b) => (b.s.startsWith(q) - a.s.startsWith(q)) || a.r - b.r).slice(0, 8);
      results.innerHTML = hitsQ.length ? hitsQ.map(({ k }) => {
        const t = T[k], par = chain(k).slice(-1)[0];
        return `<button type="button" data-k="${k}">${esc(nom(k))}<span>${t.t === "b" ? HOLD[t.hold] : TIER[t.t].label}${par ? " · " + esc(nom(par)) : ""}</span></button>`;
      }).join("") : `<p class="empty">Aucun résultat.</p>`;
    });
    results.addEventListener("click", (e) => { const b = e.target.closest("button[data-k]"); if (!b) return; select(b.dataset.k); results.innerHTML = ""; search.value = ""; search.blur(); });

    // ---------- Calques, vues, plein ecran, reperes ----------
    $("#layers").addEventListener("change", (e) => {
      const k = e.target.dataset.k, on = e.target.checked;
      if (k === "routes") { if (on) roadLayer.addTo(map); else map.removeLayer(roadLayer); }
      if (k === "noms") showNames = on;
      if (k === "baronnies") showHold = on;
      if (k === "frontieres") politicalPane.style.opacity = on ? "" : "0";
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

    // ---------- Zoom ----------
    map.on("zoomend", () => { restyle(); restyleRoads(); });
    map.fitBounds(vb("westeros"), { paddingTopLeft: [window.innerWidth > 760 ? 320 : 0, 0] });
    restyle(); restyleRoads(); labels._draw();
    const start = decodeURIComponent(location.hash.slice(1));
    if (T[start]) select(start);
  }

  init().catch((e) => {
    console.error(e);
    const m = document.getElementById("map");
    if (m) m.innerHTML = `<p class="empty" style="padding:24px">Impossible de charger la carte (${esc(e.message)}).</p>`;
  });
})();
