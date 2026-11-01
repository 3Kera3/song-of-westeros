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
  if (page === "armees") armees().catch(fail("#army-list"));
  if (page === "noms") noms().catch(fail("#names-table"));
})();
