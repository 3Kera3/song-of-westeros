(() => {
  const toggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("main-nav");
  if (toggle && nav) toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  const input = document.getElementById("site-search");
  const results = document.getElementById("search-results");
  if (!input || !results) return;
  const index = window.WIKI_SEARCH_INDEX || [];
  function search() {
    const q = input.value.trim().toLocaleLowerCase("fr");
    results.innerHTML = "";
    if (!q) return;
    const matches = index.filter(item =>
      (item.title + " " + item.category + " " + item.description).toLocaleLowerCase("fr").includes(q)
    );
    if (!matches.length) {
      results.innerHTML = '<p class="placeholder">Aucun résultat. Essayez un autre terme.</p>';
      return;
    }
    matches.forEach(item => {
      const a = document.createElement("a");
      a.className = "result-card";
      a.href = item.url;
      const small = document.createElement("small"); small.textContent = item.category;
      const strong = document.createElement("strong"); strong.textContent = item.title;
      const p = document.createElement("p"); p.textContent = item.description;
      a.append(small, strong, p); results.append(a);
    });
  }
  input.addEventListener("input", search);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const first = results.querySelector("a");
      if (first) window.location.href = first.href;
    }
  });
})();
