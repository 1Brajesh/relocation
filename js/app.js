/* Relocation Research — data-driven city tabs.
   To add a city: create data/<id>.json (same shape as bucaramanga.json)
   and add an entry to data/cities.json with status "ready". */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const app = $("#app");
  const tabsEl = $("#cityTabs");
  const cache = {};
  let cities = [];

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtCOP = (n) => "COP " + Math.round(n).toLocaleString("en-US");
  const fmtUSD = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const yearNum = (y) => { const m = String(y || "").match(/(19|20)\d{2}/); return m ? +m[0] : null; };

  const TYPE = {
    house: { label: "House", cls: "accent" },
    lowrise: { label: "Low-rise ≤2 floors", cls: "accent" },
    tower: { label: "Tower", cls: "info" },
    unknown: { label: "Height unknown", cls: "" }
  };
  const FURN = {
    yes: { label: "Furnished", cls: "ok" },
    no: { label: "Unfurnished", cls: "" },
    unconfirmed: { label: "Furnished: unconfirmed", cls: "warn" }
  };
  const YEAR = {
    verified: { label: "2010+ verified", cls: "ok" },
    estimated: { label: "Year estimated", cls: "warn" },
    unverified: { label: "Year unverified", cls: "bad" },
    na: { label: "n/a (house)", cls: "" }
  };

  /* Does a listing fit Brajesh's criteria?  "yes" | "likely" | null */
  function criteriaFit(l) {
    if (l.bedrooms !== 2 || l.bedroomsUncertain) return null;
    if (l.furnished !== "yes") return null;
    if ((l.type === "house" || l.type === "lowrise") && !l.typeUncertain) return "yes";
    if (l.type === "tower") {
      const y = yearNum(l.yearBuilt);
      if (l.yearStatus === "verified" && y >= 2010) return "yes";
      if (l.yearStatus === "estimated" && y >= 2010) return "likely";
    }
    return null;
  }

  /* ---------- theme ---------- */
  $("#themeToggle").addEventListener("click", () => {
    const root = document.documentElement;
    const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = isDark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  });

  /* ---------- tabs / routing ---------- */
  function renderTabs(activeId) {
    tabsEl.innerHTML = cities.map((c) => `
      <button class="tab" role="tab" type="button" id="tab-${esc(c.id)}" data-id="${esc(c.id)}"
        aria-selected="${c.id === activeId}" aria-controls="app">
        <span aria-hidden="true">${esc(c.flag || "")}</span>
        <span>${esc(c.name)}</span>
        ${c.status !== "ready" ? '<span class="soon">soon</span>' : ""}
      </button>`).join("");
  }
  tabsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (b) location.hash = b.dataset.id;
  });
  tabsEl.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const btns = [...tabsEl.querySelectorAll(".tab")];
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    const next = btns[(i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length];
    next.focus(); next.click();
  });

  async function route() {
    const id = decodeURIComponent(location.hash.slice(1)) || cities[0].id;
    const city = cities.find((c) => c.id === id) || cities[0];
    renderTabs(city.id);
    if (city.status !== "ready") return renderComingSoon(city);
    app.innerHTML = '<div class="loading">Loading…</div>';
    try {
      if (!cache[city.id]) cache[city.id] = await (await fetch(city.data, { cache: "no-cache" })).json();
      renderCity(cache[city.id]);
    } catch (err) {
      app.innerHTML = `<div class="card empty">Couldn't load <code>${esc(city.data)}</code>. If you opened the file directly, serve it over HTTP (e.g. <code>python3 -m http.server</code>).</div>`;
    }
  }
  window.addEventListener("hashchange", route);

  function renderComingSoon(city) {
    document.title = "Relocation Research · " + city.name;
    app.innerHTML = `
      <div class="card soon-card">
        <div class="big" aria-hidden="true">🗺️</div>
        <h2>${esc(city.name)} — coming soon</h2>
        <p class="muted">More low-cost cities will be added here as research is done. No data yet — nothing on this tab is a placeholder estimate.</p>
        <p class="muted small">To add one: create <code>data/&lt;city&gt;.json</code> and list it in <code>data/cities.json</code>.</p>
      </div>`;
  }

  /* ---------- city page ---------- */
  function renderCity(d) {
    document.title = `Relocation Research · ${d.name}, ${d.country}`;
    const fx = d.fx.copPerUsd;
    const prices = d.listings.map((l) => l.price).filter((p) => p != null);
    const maxPrice = Math.ceil(Math.max(...prices) / 100000) * 100000;
    const furnishedCount = d.listings.filter((l) => l.furnished === "yes").length;
    const fitCount = d.listings.filter((l) => criteriaFit(l)).length;

    app.innerHTML = `
      <section class="hero">
        <div class="card hero-main">
          <span class="badge accent">${esc(d.flag || "")} ${esc(d.country)}</span>
          <h2 style="margin-top:10px">${esc(d.name)}</h2>
          <p class="loc">${esc(d.region)}</p>
          <p style="margin:0">${esc(d.tagline)}</p>
          <div class="meta-row">
            <span class="badge info">📅 Researched ${esc(d.researchedLabel)}</span>
            <span class="badge">💱 FX ${esc(d.fx.label)}</span>
            <span class="badge warn">Labels show what's unverified</span>
          </div>
          <div class="stat-grid">
            <div class="stat"><div class="label">Listings tracked</div><div class="value">${d.listings.length}</div></div>
            <div class="stat"><div class="label">Furnished</div><div class="value">${furnishedCount}</div></div>
            <div class="stat"><div class="label">Fit my criteria*</div><div class="value">${fitCount}</div></div>
            <div class="stat"><div class="label">Price range</div><div class="value">${fmtUSD(Math.min(...prices) / fx)}–${fmtUSD(Math.max(...prices) / fx)}</div></div>
          </div>
          <p class="muted small" style="margin:10px 0 0">* "Fit" includes towers whose 2010+ year is only estimated.</p>
        </div>
        <aside class="card criteria" aria-label="My criteria">
          <h3><span aria-hidden="true">🎯</span> My criteria</h3>
          <ul>${d.criteria.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        </aside>
      </section>

      <section class="block" id="listings" aria-labelledby="h-listings">
        <div class="section-head">
          <h2 id="h-listings"><span class="emoji" aria-hidden="true">🏠</span>Rental listings</h2>
          <span class="muted small">COP / month · USD at ${fx.toLocaleString("en-US")} COP/USD</span>
        </div>
        <form class="card filters" id="filters" onsubmit="return false">
          <div class="field search">
            <label for="f-q">Search</label>
            <input type="search" id="f-q" placeholder="e.g. pool, elevator, Reserva, Cra 39…">
          </div>
          <div class="field price">
            <label for="f-max">Max price (rent)</label>
            <div class="range-row">
              <input type="range" id="f-max" min="1500000" max="${maxPrice}" step="100000" value="${maxPrice}">
              <span class="range-val" id="f-max-val"></span>
            </div>
          </div>
          <div class="field">
            <label for="f-area">Neighborhood / area</label>
            <select id="f-area"><option value="">All areas</option>${d.areas.map((a) => `<option value="${esc(a.id)}">${esc(a.label)}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label for="f-type">Building type</label>
            <select id="f-type"><option value="">All types</option>${Object.entries(TYPE).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label for="f-furn">Furnished</label>
            <select id="f-furn"><option value="">Any</option><option value="yes">Yes</option><option value="no">No</option><option value="unconfirmed">Unconfirmed</option></select>
          </div>
          <div class="field">
            <label for="f-year">Year built status</label>
            <select id="f-year"><option value="">Any</option><option value="verified">2010+ verified</option><option value="estimated">Estimated</option><option value="unverified">Unverified</option><option value="na">n/a (houses)</option></select>
          </div>
          <div class="field">
            <label for="f-beds">Bedrooms</label>
            <select id="f-beds"><option value="">Any</option><option value="2">2</option><option value="3">3+</option></select>
          </div>
          <div class="field">
            <label for="f-sort">Sort by</label>
            <select id="f-sort">
              <option value="price-asc">Price: low → high</option>
              <option value="price-desc">Price: high → low</option>
              <option value="total-asc">Rent + admin: low → high</option>
              <option value="id">Listing #</option>
            </select>
          </div>
          <div class="field" style="justify-content:flex-end">
            <label class="check"><input type="checkbox" id="f-noprice" checked> Include "price not shown"</label>
            <label class="check"><input type="checkbox" id="f-fit"> Only fits my criteria</label>
          </div>
          <div class="field" style="justify-content:flex-end">
            <button type="button" class="btn" id="f-reset">Reset filters</button>
          </div>
        </form>
        <div class="results-meta">
          <span id="count" class="muted small" aria-live="polite"></span>
          <span class="muted small">Price filter applies to rent only; listings without a price are kept unless unchecked.</span>
        </div>
        <div class="grid" id="grid"></div>
      </section>

      <section class="block" aria-labelledby="h-towers">
        <div class="section-head"><h2 id="h-towers"><span class="emoji" aria-hidden="true">🏢</span>Known tower years — no furnished listing found</h2></div>
        <div class="card table-wrap">
          <table>
            <thead><tr><th>Building</th><th>Area</th><th>Year</th><th>Note</th></tr></thead>
            <tbody>${d.knownTowers.map((t) => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.area)}</td><td>${esc(t.year)}</td><td class="muted">${esc(t.note)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
      </section>

      ${d.sections.map((s) => renderSection(s, d)).join("")}
    `;

    setupFilters(d);
  }

  function renderSection(s, d) {
    const body = s.blocks.map((b) => {
      switch (b.type) {
        case "timeline":
          return `<div class="card"><ol class="timeline">${b.items.map((i) => `
            <li><div class="when">${esc(i.date)}<br><span class="badge warn">${esc(i.badge)}</span></div><div>${esc(i.text)}</div></li>`).join("")}</ol></div>`;
        case "callout":
          return `<div class="callout ${esc(b.tone)}">${b.html}</div>`;
        case "cards":
          return `<div class="info-grid">${b.items.map((c) => `<div class="card"><h3>${esc(c.title)}</h3><div>${c.html}</div></div>`).join("")}</div>`;
        case "checklist":
          return `<div class="card" style="margin-top:16px"><h3>${esc(b.title)}</h3><ul class="checklist">${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`;
        case "list":
          return `<div class="card unverified-card"><ul class="plain-list">${b.items.map((i) => `<li>${i}</li>`).join("")}</ul></div>`;
        case "stats":
          return `<div class="stat-grid" style="margin-top:0">
            <div class="stat card"><div class="label">Couple, monthly (incl. rent)</div><div class="value">${esc(d.costOfLiving.couple)}</div></div>
            <div class="stat card"><div class="label">Utilities</div><div class="value">${esc(d.costOfLiving.utilities)}</div></div></div>`;
        case "ranges":
          return `<div class="card table-wrap" style="margin-top:16px"><h3 style="margin-bottom:6px">Typical 2BR rent ranges</h3><table>
            <thead><tr><th>Area</th><th>Rent / month</th><th></th><th>≈ USD</th></tr></thead>
            <tbody>${d.rentRanges.map((r) => `<tr><td><b>${esc(r.area)}</b></td><td>${esc(r.range)}</td><td class="muted">${esc(r.extra)}</td><td>${usdRange(r.range, d.fx.copPerUsd)}</td></tr>`).join("")}</tbody></table></div>`;
        default: return "";
      }
    }).join("");
    const sources = s.sources ? `<details class="sources card" open><summary>Sources (${s.sources.length})</summary><ul>${s.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a></li>`).join("")}</ul></details>` : "";
    return `<section class="block" id="${esc(s.id)}" aria-labelledby="h-${esc(s.id)}">
      <div class="section-head"><h2 id="h-${esc(s.id)}"><span class="emoji" aria-hidden="true">${esc(s.icon)}</span>${esc(s.title)}</h2></div>
      ${body}${sources}</section>`;
  }

  function usdRange(str, fx) {
    const m = str.match(/([\d.]+)\s*[–-]\s*([\d.]+)M/);
    return m ? `${fmtUSD((+m[1] * 1e6) / fx)}–${fmtUSD((+m[2] * 1e6) / fx)}` : "";
  }

  /* ---------- listings ---------- */
  function listingCard(l, d) {
    const fx = d.fx.copPerUsd;
    const area = d.areas.find((a) => a.id === l.area);
    const fit = criteriaFit(l);
    const t = TYPE[l.type], f = FURN[l.furnished], y = YEAR[l.yearStatus];
    const priceHtml = l.price != null
      ? `<span class="cop">${l.priceApprox ? "~" : ""}${fmtCOP(l.price)}</span><span class="usd">≈ ${fmtUSD(l.price / fx)}/mo</span>`
      : `<span class="na">Price not shown</span>`;
    const adminStr = l.admin.amount ? `${l.admin.label} <span class="muted">(≈ ${fmtUSD(l.admin.amount / fx)})</span>` : esc(l.admin.label);
    const total = l.price != null && l.admin.amount ? `<div class="wide"><dt>Rent + admin</dt><dd>${fmtCOP(l.price + l.admin.amount)} <span class="muted">(≈ ${fmtUSD((l.price + l.admin.amount) / fx)})</span></dd></div>` : "";
    const beds = l.bedrooms != null ? `${l.bedrooms} BR${l.bedroomsUncertain ? " (unverified)" : ""}` : "BR n/a";
    const baths = l.bathrooms != null ? ` / ${l.bathrooms} BA` : "";
    const yearTxt = l.yearBuilt ? esc(l.yearBuilt) : (l.yearStatus === "na" ? "—" : "Unknown");

    return `<article class="card listing${fit ? " match" : ""}">
      <div class="listing-top">
        <div>
          <h3>${esc(l.title)}</h3>
          <div class="area">📍 ${esc(area ? area.label : l.area)}${l.estrato ? ` · estrato ${l.estrato}` : ""}</div>
        </div>
        <span class="num">#${l.id}</span>
      </div>
      <div class="price">${priceHtml}</div>
      <div class="badges">
        ${fit === "yes" ? '<span class="badge ok">✓ Fits my criteria</span>' : ""}
        ${fit === "likely" ? '<span class="badge ok">≈ Likely fit (year est.)</span>' : ""}
        <span class="badge ${t.cls}">${esc(t.label)}${l.typeUncertain ? "?" : ""}</span>
        <span class="badge ${f.cls}">${esc(f.label)}</span>
        <span class="badge ${y.cls}">${esc(y.label)}</span>
        ${(l.flags || []).map((x) => `<span class="badge warn">${esc(x)}</span>`).join("")}
      </div>
      <dl class="specs">
        <div><dt>Bedrooms / baths</dt><dd>${beds}${baths}</dd></div>
        <div><dt>Size</dt><dd>${l.sizeM2 ? l.sizeM2 + " m²" : "Not stated"}</dd></div>
        <div><dt>Admin fee</dt><dd>${adminStr}</dd></div>
        <div><dt>Year built</dt><dd>${yearTxt}</dd></div>
        ${total}
        <div class="wide"><dt>Floors / type</dt><dd>${esc(l.typeLabel)}</dd></div>
        ${l.yearNote ? `<div class="wide"><dt>Year verification</dt><dd class="muted">${esc(l.yearNote)}</dd></div>` : ""}
      </dl>
      ${l.features && l.features.length ? `<div class="features">${l.features.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
      <p class="notes">${esc(l.notes)}</p>
      <div class="links">${l.links.map((k) => `<a class="link-btn" href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.label)} ↗</a>`).join("")}</div>
    </article>`;
  }

  function setupFilters(d) {
    const ids = ["q", "max", "area", "type", "furn", "year", "beds", "sort", "noprice", "fit"];
    const el = Object.fromEntries(ids.map((k) => [k, $("#f-" + k)]));
    const grid = $("#grid"), count = $("#count"), maxVal = $("#f-max-val");
    const fx = d.fx.copPerUsd;
    const searchText = (l) => [l.title, l.notes, l.typeLabel, l.address, (l.features || []).join(" "), (l.flags || []).join(" "),
      (d.areas.find((a) => a.id === l.area) || {}).label].join(" ").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    function apply() {
      const q = el.q.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const max = +el.max.value;
      maxVal.textContent = `${fmtCOP(max)} · ${fmtUSD(max / fx)}`;
      let rows = d.listings.filter((l) => {
        if (el.area.value && l.area !== el.area.value) return false;
        if (el.type.value && l.type !== el.type.value) return false;
        if (el.furn.value && l.furnished !== el.furn.value) return false;
        if (el.year.value && l.yearStatus !== el.year.value) return false;
        if (el.beds.value === "2" && l.bedrooms !== 2) return false;
        if (el.beds.value === "3" && !(l.bedrooms >= 3)) return false;
        if (l.price == null) { if (!el.noprice.checked) return false; }
        else if (l.price > max) return false;
        if (el.fit.checked && !criteriaFit(l)) return false;
        if (q && !q.split(/\s+/).every((w) => searchText(l).includes(w))) return false;
        return true;
      });
      const key = (l) => el.sort.value === "total-asc" ? (l.price == null ? null : l.price + (l.admin.amount || 0)) : l.price;
      rows.sort((a, b) => {
        if (el.sort.value === "id") return a.id - b.id;
        const ka = key(a), kb = key(b);
        if (ka == null && kb == null) return a.id - b.id;
        if (ka == null) return 1; if (kb == null) return -1; // no-price last
        return el.sort.value === "price-desc" ? kb - ka : ka - kb;
      });
      count.textContent = `Showing ${rows.length} of ${d.listings.length} listings`;
      grid.innerHTML = rows.length ? rows.map((l) => listingCard(l, d)).join("")
        : `<div class="card empty" style="grid-column:1/-1">No listings match these filters. <button class="btn" type="button" onclick="document.getElementById('f-reset').click()">Reset</button></div>`;
    }

    ids.forEach((k) => el[k].addEventListener(k === "q" || k === "max" ? "input" : "change", apply));
    $("#f-reset").addEventListener("click", () => {
      $("#filters").reset();
      el.max.value = el.max.max;
      apply();
    });
    apply();
  }

  /* ---------- boot ---------- */
  fetch("data/cities.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((j) => { cities = j.cities; route(); })
    .catch(() => { app.innerHTML = '<div class="card empty">Couldn\'t load <code>data/cities.json</code>. Serve this folder over HTTP (GitHub Pages or <code>python3 -m http.server</code>).</div>'; });
})();
