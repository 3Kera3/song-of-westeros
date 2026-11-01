// Song of Westeros - scripts du site.
// Le contenu se modifie dans contenu/, donnees/ et config.js : pas besoin de toucher a ce fichier.
(function () {
  const cfg = window.SOW;
  const page = document.body.dataset.page;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const fmt = (n) => (n === "" || n == null ? "-" : Number(n).toLocaleString("fr-FR"));

  // ---------- En-tete et pied de page communs ----------
  function layout() {
    const here = location.pathname.split("/").pop() || "index.html";
    const links = cfg.menu.map((m) => `<a href="${m.lien}"${m.lien === here ? ' class="active"' : ""}>${esc(m.titre)}</a>`).join("");
    document.head.insertAdjacentHTML("beforeend", `<link rel="icon" type="image/png" href="images/favicon.png">`);
    document.body.insertAdjacentHTML("afterbegin", `
      <header class="topbar"><div class="wrap">
        <a class="brand" href="index.html"><img class="brand-logo" src="images/logo.png" alt="">${esc(cfg.nom)}</a>
        <button class="menu-btn" aria-expanded="false" aria-controls="nav">Menu</button>
        <nav class="nav" id="nav">${links}<a class="btn-discord" href="${cfg.discord}" target="_blank" rel="noopener">Discord</a></nav>
      </div></header>`);
    document.body.insertAdjacentHTML("beforeend", `
      <footer class="footer"><div class="wrap">
        <span>${esc(cfg.nom)} &middot; ${esc(cfg.accroche)}</span>
        <span>Projet communautaire non officiel, inspiré de l'univers de G. R. R. Martin.</span>
      </div></footer>`);
    const btn = $(".menu-btn"), nav = $("#nav");
    btn.addEventListener("click", () => btn.setAttribute("aria-expanded", nav.classList.toggle("open")));
    document.querySelectorAll("[data-discord]").forEach((a) => (a.href = cfg.discord));
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = rows.shift().map((h) => h.trim());
    return rows.filter((r) => r.some((v) => v.trim())).map((r) => {
      const o = {};
      head.forEach((h, i) => { if (h) o[h] = (r[i] ?? "").trim(); });
      return o;
    });
  }
  const loadCSV = (url) => fetch(url, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(parseCSV);

  // ---------- Mini Markdown pour le reglement ----------
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const kind = (s) => (/^[✕✗×]/.test(s) ? "no" : /^[✔✓]/.test(s) ? "ok" : /^⚠/.test(s) ? "warn" : "");
  const strip = (s) => s.replace(/^[✕✗×✔✓⚠]️?\s*/, "");
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function renderRules(md) {
    md = md.replace(/<!--[\s\S]*?-->/g, "");
    const sections = [];
    let sec = null, rule = null, list = null, para = [];
    const target = () => (rule || sec || (sec = { title: "", rules: [], body: [] })).body;
    const flushPara = () => { if (para.length) { target().push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
    const flushList = () => { if (list) { target().push(`<ul>${list.join("")}</ul>`); list = null; } };
    let rows = null;
    const flushTable = () => {
      if (!rows) return;
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const [head, ...body] = rows.filter((r) => !/^\|[\s:|-]+\|?$/.test(r)).map(cells);
      target().push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      rows = null;
    };
    const flush = () => { flushPara(); flushList(); flushTable(); };

    for (const raw of md.split(/\r?\n/)) {
      const line = raw.trim();
      let m;
      if (!line) { flush(); continue; }
      if ((m = line.match(/^#\s+(.+)/))) { flush(); rule = null; sec = { title: m[1], rules: [], body: [] }; sections.push(sec); continue; }
      if ((m = line.match(/^##\s+(.+)/))) { flush(); if (!sec) { sec = { title: "", rules: [], body: [] }; sections.push(sec); } rule = { title: m[1], body: [] }; sec.rules.push(rule); continue; }
      if (line.startsWith("|")) { flushPara(); flushList(); (rows ||= []).push(line); continue; }
      if ((m = line.match(/^[-*]\s+(.+)/))) { flushPara(); (list ||= []).push(`<li class="${kind(m[1])}">${inline(strip(m[1]))}</li>`); continue; }
      if ((m = line.match(/^>\s?(.*)/))) { flush(); target().push(`<p class="note ${kind(m[1])}">${inline(strip(m[1]))}</p>`); continue; }
      flushList(); flushTable(); para.push(line);
    }
    flush();

    $("#toc").innerHTML = "<p>Sommaire</p>" + sections.map((s) => `<a href="#${slug(s.title)}">${esc(s.title)}</a>`).join("");
    $("#rules").innerHTML = sections.map((s) => `
      <section class="rule-section" id="${slug(s.title)}">
        <h2>${esc(s.title)}</h2>${s.body.join("")}
        ${s.rules.map((r) => `<article class="rule" id="${slug(r.title)}"><h3>${esc(r.title)}</h3>${r.body.join("")}</article>`).join("")}
      </section>`).join("");

    // Recherche dans le reglement
    const input = $("#rule-search");
    input.addEventListener("input", () => {
      const q = norm(input.value.trim());
      let shown = 0;
      document.querySelectorAll(".rule-section").forEach((s) => {
        let any = false;
        s.querySelectorAll(".rule").forEach((r) => {
          const ok = !q || norm(r.textContent).includes(q) || norm(s.querySelector("h2").textContent).includes(q);
          r.hidden = !ok; any ||= ok; if (ok) shown++;
        });
        s.hidden = !any;
      });
      $("#rules-empty").hidden = shown > 0;
    });

    // Surlignage du sommaire au defilement
    const links = [...document.querySelectorAll("#toc a")];
    const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
    }), { rootMargin: "-20% 0px -70% 0px" });
    document.querySelectorAll(".rule-section").forEach((s) => obs.observe(s));
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  // ---------- Texte suivi (lore) ----------
  function renderProse(md) {
    md = md.replace(/<!--[\s\S]*?-->/g, "");
    $("#prose").innerHTML = md.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
      let m;
      if ((m = b.match(/^##?\s+(.+)/))) return `<h2>${inline(m[1])}</h2>`;
      if (b.startsWith(">")) return `<blockquote>${inline(b.replace(/^>\s?/gm, "").replace(/\n/g, " "))}</blockquote>`;
      return `<p>${inline(b.replace(/\n/g, " "))}</p>`;
    }).join("");
  }

  // ---------- Carte interactive de Westeros et Essos (Leaflet + GeoJSON) ----------
  async function cartes() {
    const geo = (n) => fetch(`donnees/carte/${n}.geojson`).then((r) => r.json());
    const [continents, islands, political, landscape, lakes, rivers, roads, wall, locations, regionsGeo, noms, lieux, maisons, regions] = await Promise.all([
      ...["continents", "islands", "political", "landscape", "lakes", "rivers", "roads", "wall", "locations", "regions"].map(geo),
      loadCSV("donnees/carte-noms.csv"), loadCSV("donnees/lieux.csv"), loadCSV("donnees/armees.csv"), loadCSV("donnees/regions.csv"),
    ]);
    const fr = Object.fromEntries(noms.map((r) => [r["Original"], r["Français"]]));
    const tr = (s) => fr[s] || s;
    const info = Object.fromEntries(lieux.filter((l) => !l["Lat"]).map((l) => [l["Lieu"], l]));
    const armee = (m) => maisons.find((r) => r["Maison"] === "Maison " + m);
    const levee = Object.fromEntries(regions.map((r) => [r["Région"], r["Levée totale possible"]]));
    const TYPES = { City: "Cité", Town: "Ville", Castle: "Château", Ruin: "Ruine", Other: "Lieu" };
    const COLORS = { "Le Nord": "#8fa3b0", "Le Conflans": "#5a6fb0", "Les Îles de Fer": "#7d8a8f", "Principauté de Dorne": "#d08a3a", "Les Terres de l'Orage": "#c9b24a", "Le Val d'Arryn": "#6aa6c9", "Les Terres de l'Ouest": "#b84a3e", "Les Terres de la Couronne": "#a83256", "Le Bief": "#7aa65a", "Le Nouveau Don": "#5c5f66", "Le Don de Brandon": "#5c5f66", "Au-delà du Mur": "#c9d6dc" };

    const map = L.map("map", { zoomSnap: 0.5, minZoom: 3, maxZoom: 9, zoomControl: false });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.setPrefix(false).addAttribution('Données : cadaei, theMountainGoat, Tear (<a href="donnees/carte/LICENCE.txt">CC BY-NC-SA 3.0</a>) · Univers © G. R. R. Martin');
    map.setMaxBounds([[-50, -15], [60, 105]]);

    // Fond : terres
    L.geoJSON(continents, { style: { color: "#5b513f", weight: 1, fillColor: "#2b2925", fillOpacity: 1 }, interactive: false }).addTo(map);
    L.geoJSON(islands, { style: { color: "#5b513f", weight: 0.8, fillColor: "#2b2925", fillOpacity: 1 }, interactive: false }).addTo(map);

    const layers = {};
    const anchor = L.divIcon({ className: "lbl-anchor", iconSize: [0, 0] });
    const label = (cls) => ({ permanent: true, direction: "center", className: "lbl " + cls, interactive: false });

    // Royaumes
    layers.royaumes = L.geoJSON(political, {
      style: (f) => ({ color: "#c9a45c", weight: 1, dashArray: "3 4", opacity: 0.55, fillColor: COLORS[tr(f.properties.name || f.properties.ClaimedBy)] || "#888", fillOpacity: 0.16 }),
      onEachFeature: (f, l) => {
        const nom = tr(f.properties.name || f.properties.ClaimedBy);
        const suz = f.properties.ClaimedBy;
        const tot = levee[nom];
        const qui = suz === "Night's Watch" || suz === "Wildlings" ? tr(suz) : "Maison " + suz;
        l.bindPopup(`<strong>${esc(nom)}</strong><em>${esc(qui)}</em>${tot ? `<p>Levée totale possible : <b>${fmt(tot)}</b> hommes<br><a href="armees.html">Voir les effectifs</a></p>` : ""}`);
        l.on("mouseover", () => l.setStyle({ fillOpacity: 0.3 })).on("mouseout", () => layers.royaumes.resetStyle(l));
      },
    });
    layers.nomsRoyaumes = L.layerGroup(political.features.filter((f) => f.properties.name).map((f) =>
      L.marker(L.geoJSON(f).getBounds().getCenter(), { icon: anchor, interactive: false }).bindTooltip(esc(tr(f.properties.name)), label("lbl-kingdom"))));

    // Paysages, eau, routes, Mur
    const tip = (f, l) => f.properties.name && l.bindTooltip(esc(tr(f.properties.name)), { sticky: true, className: "tip" });
    layers.paysages = L.geoJSON(landscape, { interactive: false, style: (f) => ({ stroke: false, fillOpacity: 0.55, fillColor: { forest: "#2c3a26", mountain: "#4a3f33", swamp: "#2f3a33", stepp: "#3b3826" }[f.properties.type] || "#333" }) });
    layers.eau = L.layerGroup([
      L.geoJSON(rivers, { style: (f) => ({ color: "#3c6178", weight: f.properties.size >= 3 ? 2 : 1.2, opacity: 0.9 }), onEachFeature: tip }),
      L.geoJSON(lakes, { style: { color: "#3c6178", weight: 1, fillColor: "#15222c", fillOpacity: 1 }, onEachFeature: tip }),
    ]);
    layers.routes = L.geoJSON(roads, { style: (f) => ({ color: "#b08d52", weight: f.properties.size >= 2 ? 2.2 : 1.4, dashArray: f.properties.size >= 2 ? null : "4 4", opacity: 0.85 }), onEachFeature: tip });
    layers.mur = L.geoJSON(wall, { style: { color: "#e8f1f5", weight: 4, opacity: 0.9 }, onEachFeature: (f, l) => l.bindTooltip("Le Mur", { sticky: true, className: "tip" }) });

    // Noms des mers et regions
    layers.nomsRegions = L.layerGroup(regionsGeo.features.filter((f) => f.properties.name && f.geometry).map((f) => {
      const cls = (f.properties.type === "water" ? "lbl-sea" : "lbl-land") + " s" + Math.min(f.properties.size || 2, 5);
      return L.marker(L.geoJSON(f).getBounds().getCenter(), { icon: anchor, interactive: false }).bindTooltip(esc(tr(f.properties.name)), label(cls));
    }));

    // Lieux
    const all = [];
    const popup = (nom, vo, type, m, desc) => {
      const a = m && armee(m);
      return `<strong>${esc(nom)}</strong><em>${esc(type)}${vo && vo !== nom ? " · " + esc(vo) : ""}</em>`
        + (m ? `<p>${m === "Garde de Nuit" ? "" : "Maison "}${esc(m)}</p>` : "") + (desc ? `<p>${esc(desc)}</p>` : "")
        + (a ? `<p class="pop-army">Levées : <b>${fmt(a["Levées"])}</b>${a["Chevaliers"] ? ` · Chevaliers : <b>${fmt(a["Chevaliers"])}</b>` : ""}${a["Flotte"] ? ` · Navires : <b>${fmt(a["Flotte"])}</b>` : ""}<br><a href="armees.html">Voir les effectifs</a></p>` : "");
    };
    const RAYON = { City: 6, Town: 4.5, Castle: 4, Ruin: 3.5, Other: 2.5 };
    const FOND = { City: "#e2bd6d", Town: "#d9c9a3", Castle: "#b9b2a4", Ruin: "#7d776c", Other: "#8d877b" };
    const place = (latlng, nom, vo, t, m, desc, group) => {
      const mk = L.circleMarker(latlng, { radius: RAYON[t], weight: 1.5, color: "#17130b", fillColor: m && t === "Castle" ? "#c9a45c" : FOND[t], fillOpacity: 1 })
        .bindPopup(popup(nom, vo, TYPES[t], m, desc))
        .bindTooltip(esc(nom), { permanent: true, direction: "right", offset: [6, 0], className: "lbl lbl-" + t.toLowerCase() + (m ? " lbl-seat" : ""), interactive: false });
      group.addLayer(mk);
      all.push({ nom, vo, mk, t });
    };
    layers.lieux = L.layerGroup();
    layers.lieuxMineurs = L.layerGroup();
    locations.features.forEach((f) => {
      const p = f.properties; if (!p.name) return;
      const [lng, lat] = f.geometry.coordinates;
      const i = info[p.name] || info[tr(p.name)];
      place([lat, lng], tr(p.name), p.name, p.type, i && i["Maison"], i && i["Description"], p.type === "Other" ? layers.lieuxMineurs : layers.lieux);
    });
    lieux.filter((l) => l["Lat"] && l["Lng"]).forEach((l) => place([+l["Lat"], +l["Lng"]], l["Lieu"], "", "Castle", l["Maison"], l["Description"], layers.lieux));

    // Ordre d'affichage
    ["paysages", "royaumes", "eau", "routes", "mur", "nomsRegions", "nomsRoyaumes", "lieux"].forEach((k) => layers[k].addTo(map));

    // Panneau des calques
    const CALQUES = [["royaumes", "Royaumes"], ["nomsRoyaumes", "Noms des royaumes"], ["lieux", "Cités, villes et châteaux"], ["lieuxMineurs", "Lieux mineurs (auberges, villages)"], ["routes", "Routes"], ["eau", "Rivières et lacs"], ["paysages", "Forêts et montagnes"], ["nomsRegions", "Mers et régions"], ["mur", "Le Mur"]];
    $("#layers").innerHTML = CALQUES.map(([k, t]) => `<label><input type="checkbox" data-k="${k}"${map.hasLayer(layers[k]) ? " checked" : ""}> ${t}</label>`).join("");
    $("#layers").addEventListener("change", (e) => { const l = layers[e.target.dataset.k]; if (e.target.checked) l.addTo(map); else map.removeLayer(l); });

    // Etiquettes selon le zoom
    const zoomClass = () => {
      const z = map.getZoom(), c = $("#map").classList;
      c.toggle("z-far", z < 4); c.toggle("z-seas", z >= 4); c.toggle("z-towns", z >= 4.5);
      c.toggle("z-castles", z >= 5); c.toggle("z-small", z >= 5.5); c.toggle("z-other", z >= 6.5);
    };
    map.on("zoomend", zoomClass);

    // Recherche
    const search = $("#place-search"), results = $("#place-results");
    search.addEventListener("input", () => {
      const q = norm(search.value.trim());
      if (q.length < 2) { results.innerHTML = ""; return; }
      const hits = all.filter((a) => norm(a.nom).includes(q) || norm(a.vo).includes(q)).slice(0, 8);
      results.innerHTML = hits.length
        ? hits.map((a) => `<button type="button" data-i="${all.indexOf(a)}">${esc(a.nom)}<span>${TYPES[a.t]}${a.vo && a.vo !== a.nom ? " · " + esc(a.vo) : ""}</span></button>`).join("")
        : `<p class="empty">Aucun lieu trouvé.</p>`;
    });
    results.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const a = all[+b.dataset.i];
      const group = a.t === "Other" ? layers.lieuxMineurs : layers.lieux;
      if (!map.hasLayer(group)) { group.addTo(map); $(`#layers input[data-k="${a.t === "Other" ? "lieuxMineurs" : "lieux"}"]`).checked = true; }
      map.flyTo(a.mk.getLatLng(), 6.5, { duration: 1 });
      map.once("moveend", () => a.mk.openPopup());
      results.innerHTML = ""; search.value = a.nom;
    });

    // Vues rapides
    const VUES = { westeros: [[-12, 2], [38, 28]], essos: [[-37, 28], [22, 92]], monde: [[-40, 0], [45, 95]] };
    $("#views").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) map.flyToBounds(VUES[b.dataset.v], { duration: 1 }); });

    // Plein ecran
    const shell = $("#map-shell");
    $("#map-full").addEventListener("click", () => (document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen && shell.requestFullscreen()));
    document.addEventListener("fullscreenchange", () => setTimeout(() => map.invalidateSize(), 100));

    // Panneau repliable
    $("#panel-toggle").addEventListener("click", () => $("#map-panel").classList.toggle("collapsed"));

    // Mode staff : cliquer sur la carte donne la ligne a coller dans donnees/lieux.csv
    let picking = false;
    $("#map-pick").addEventListener("click", () => { picking = !picking; $("#map-pick").classList.toggle("active", picking); shell.classList.toggle("picking", picking); });
    map.on("click", (e) => {
      if (!picking) return;
      const line = `Nom du lieu,Maison,Description,${e.latlng.lat.toFixed(2)},${e.latlng.lng.toFixed(2)}`;
      if (navigator.clipboard) navigator.clipboard.writeText(line).catch(() => {});
      L.popup().setLatLng(e.latlng).setContent(`<strong>Ligne copiée</strong><p>À coller à la fin de donnees/lieux.csv :</p><code>${esc(line)}</code>`).openOn(map);
    });

    map.fitBounds(VUES[location.hash === "#essos" ? "essos" : location.hash === "#monde" ? "monde" : "westeros"]);
    zoomClass();
  }

  // ---------- Tableau triable generique ----------
  function table(el, cols, rows) {
    let key = null, dir = 1;
    const draw = () => {
      const data = key ? [...rows].sort((a, b) => {
        const col = cols.find((c) => c.key === key);
        const x = a[key], y = b[key];
        return (col.num ? (Number(x) || 0) - (Number(y) || 0) : String(x).localeCompare(String(y), "fr")) * dir;
      }) : rows;
      el.innerHTML = `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th class="${c.num ? "num" : ""}" data-k="${c.key}">${esc(c.label)}${key === c.key ? (dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
        <tbody>${data.map((r) => `<tr>${cols.map((c) => `<td class="${c.num ? "num" : ""}">${c.render ? c.render(r[c.key], r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      el.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
        dir = key === th.dataset.k ? -dir : 1; key = th.dataset.k; draw();
      }));
    };
    draw();
  }

  // ---------- Page Armees ----------
  async function armees() {
    const [maisons, regions] = await Promise.all([loadCSV("donnees/armees.csv"), loadCSV("donnees/regions.csv")]);
    const sum = (arr, k) => arr.reduce((t, r) => t + (Number(r[k]) || 0), 0);
    $("#army-stats").innerHTML = [
      ["Régions", regions.length],
      ["Maisons", maisons.length],
      ["Levée totale", sum(regions, "Levée totale possible")],
      ["Chevaliers", sum(maisons, "Chevaliers")],
      ["Navires", sum(maisons, "Flotte")],
    ].map(([l, v]) => `<div class="stat"><span>${l}</span><strong>${fmt(v)}</strong></div>`).join("");

    const select = $("#army-region"), input = $("#army-search");
    select.innerHTML = `<option value="">Toutes les régions</option>` + regions.map((r) => `<option>${esc(r["Région"])}</option>`).join("");
    const cols = ["Levées", "Infanterie", "Cavalerie", "Chevaliers", "Vassaux", "Flotte"];
    const draw = () => {
      const q = norm(input.value.trim());
      const out = $("#army-list"); out.innerHTML = "";
      regions.filter((r) => !select.value || r["Région"] === select.value).forEach((reg) => {
        const list = maisons.filter((m) => m["Région"] === reg["Région"] && (!q || norm(m["Maison"]).includes(q)));
        if (!list.length) return;
        const box = document.createElement("section");
        box.className = "region";
        box.innerHTML = `<div class="region-head"><h2>${esc(reg["Région"])}</h2><span class="total">Levée totale possible : <strong>${fmt(reg["Levée totale possible"])}</strong> hommes</span></div><div></div>`;
        out.append(box);
        table(box.lastElementChild, [{ key: "Maison", label: "Maison" }, ...cols.map((c) => ({ key: c, label: c === "Flotte" ? "Navires" : c, num: true, render: fmt }))], list);
      });
      if (!out.children.length) out.innerHTML = `<p class="empty">Aucune maison ne correspond.</p>`;
    };
    select.addEventListener("change", draw);
    input.addEventListener("input", draw);
    draw();
  }

  // ---------- Page Noms (lecture en direct du Google Sheet) ----------
  async function noms() {
    const status = $("#names-status");
    const live = `https://docs.google.com/spreadsheets/d/${cfg.sheet.id}/gviz/tq?tqx=out:csv&gid=${cfg.sheet.ongletNoms}`;
    let rows;
    try {
      rows = await loadCSV(live);
      if (!rows.length || !("Prénom" in rows[0])) throw new Error("format");
      status.textContent = "Données lues en direct depuis le Google Sheet.";
    } catch {
      rows = await loadCSV("donnees/noms.csv");
      status.textContent = "Google Sheet indisponible : copie locale affichée.";
    }
    const fields = ["Genre", "Rang", "Région"];
    const uniq = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    fields.forEach((f) => {
      $(`#f-${slug(f)}`).innerHTML = `<option value="">${f} : tous</option>` + uniq(f).map((v) => `<option>${esc(v)}</option>`).join("");
    });
    const input = $("#names-search");
    const draw = () => {
      const q = norm(input.value.trim());
      const list = rows.filter((r) => (!q || norm(r["Prénom"] + " " + r["Nom"]).includes(q)) && fields.every((f) => { const v = $(`#f-${slug(f)}`).value; return !v || r[f] === v; }));
      $("#names-count").textContent = `${list.length.toLocaleString("fr-FR")} résultat${list.length > 1 ? "s" : ""}`;
      table($("#names-table"), [
        { key: "Prénom", label: "Prénom" }, { key: "Nom", label: "Nom" },
        { key: "Genre", label: "Genre" }, { key: "Rang", label: "Rang", render: (v) => `<span class="tag">${esc(v)}</span>` },
        { key: "Région", label: "Région" },
      ], list);
    };
    input.addEventListener("input", draw);
    document.querySelectorAll(".names-filter").forEach((s) => s.addEventListener("change", draw));
    draw();
  }

  layout();
  const fail = (sel) => (e) => { console.error(e); const el = $(sel); if (el) el.innerHTML = `<p class="empty">Impossible de charger les données (${esc(e.message)}).</p>`; };
  const md = (url) => fetch(url, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); });
  if (page === "doc") md(document.body.dataset.src).then(renderRules).catch(fail("#rules"));
  if (page === "lore") md("contenu/lore.md").then(renderProse).catch(fail("#prose"));
  if (page === "cartes") cartes().catch(fail("#map"));
  if (page === "armees") armees().catch(fail("#army-list"));
  if (page === "noms") noms().catch(fail("#names-table"));
})();
