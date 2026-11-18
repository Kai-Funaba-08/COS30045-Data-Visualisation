/* Table button for Q2-Q5, like the one on Q1.
   Adds a "Table" button to each chart card. Pressing it hides the chart and shows
   the same numbers as an HTML table (easier to read exact values, and screen-reader friendly).
   Pressing it again, or any other button in the card, brings the chart back.
   Load on q2.html-q5.html after the page's own chart script. */
 
(function () {
  const fmt = d3.format(",");
  const pct = d3.format("+.1%");
  const share = d3.format(".1%");
  const num = v => `<td class="num">${v}</td>`;
 
  // One entry per chart card: which card, and how to build its table from the CSV
  const TABLES = {
    q2: [
      { card: 0, csv: "data/sex_annual.csv", caption: "Hospitalisations of females and males, 2011–2021",
        build(rows) {
          const get = (yr, s) => rows.find(d => +d.year === yr && d.sex === s);
          const years = [...new Set(rows.map(d => +d.year))].sort();
          const head = ["Year", "Females", "Males", "Females % change", "Males % change"];
          const body = years.map((yr, i) => {
            const f = +get(yr, "Female").hospitalisations, m = +get(yr, "Male").hospitalisations;
            const pf = i ? +get(yr - 1, "Female").hospitalisations : null, pm = i ? +get(yr - 1, "Male").hospitalisations : null;
            return `<td>${yr}</td>${num(fmt(f))}${num(fmt(m))}${num(i ? pct(f / pf - 1) : "–")}${num(i ? pct(m / pm - 1) : "–")}`;
          });
          return { head, body };
        } },
      { card: 1, csv: "data/age_annual.csv", caption: "Hospitalisations by age group, 2011 and 2021",
        build(rows) {
          const ORDER = ["0-7", "8-16", "17-25", "26-39", "40-64", "65-74", "75+"];
          const get = (yr, g) => +rows.find(d => +d.year === yr && d.age_group === g).hospitalisations;
          const head = ["Age group", "2011", "2021", "Change"];
          const body = ORDER.map(g => `<td>${g}</td>${num(fmt(get(2011, g)))}${num(fmt(get(2021, g)))}${num(pct(get(2021, g) / get(2011, g) - 1))}`);
          return { head, body };
        } }
    ],
    q3: [
      { card: 0, csv: "data/state_annual.csv", caption: "Hospitalisations per 100,000 people by state and territory († data break)",
        build(rows) {
          const STATES = ["NSW", "Vic", "Qld", "WA", "SA", "Tas", "ACT", "NT"];
          const BREAK = { NSW: "NSW†", Vic: "Vic†" };
          const years = [...new Set(rows.map(d => +d.year))].sort();
          const head = ["Year", ...STATES.map(s => BREAK[s] || s)];
          const body = years.map(yr => `<td>${yr}</td>` + STATES.map(s => {
            const r = rows.find(d => +d.year === yr && d.state === s);
            return num(r ? (+r.rate_per_100k).toFixed(1) : "–");
          }).join(""));
          return { head, body };
        } }
    ],
    q4: [
      { card: 0, csv: "data/road_user_annual.csv", caption: "Hospitalisations by road user, 2011–2021 (largest in 2021 first)",
        build(rows) {
          const years = [...new Set(rows.map(d => +d.year))].sort();
          const first = years[0], last = years[years.length - 1];
          const get = (yr, u) => { const r = rows.find(d => +d.year === yr && d.road_user === u); return r ? +r.hospitalisations : 0; };
          const users = [...new Set(rows.map(d => d.road_user))].sort((a, b) => get(last, b) - get(last, a));
          const head = ["Road user", ...years.map(String), `Change ${first}–${last}`];
          const body = users.map(u => `<td>${u}</td>` + years.map(yr => num(fmt(get(yr, u)))).join("") +
            num(pct(get(last, u) / get(first, u) - 1)));
          return { head, body };
        } }
    ],
    q5: [
      { card: 0, csv: "data/first_nations_remoteness.csv", caption: "Where people lived: hospitalisations by remoteness area, 2021",
        build(rows) {
          const AREAS = ["Major Cities", "Regional", "Remote"];
          const GROUPS = ["First Nations people", "Non-Indigenous"];
          const get = (g, a) => { const r = rows.find(d => d.group === g && d.remoteness === a && +d.year === 2021); return r ? +r.hospitalisations : 0; };
          const total = g => d3.sum(AREAS, a => get(g, a));
          const head = ["Remoteness area", "First Nations people", "Share", "Non-Indigenous", "Share"];
          const body = AREAS.map(a => `<td>${a}</td>` + GROUPS.map(g => num(fmt(get(g, a))) + num(share(get(g, a) / total(g)))).join(""));
          body.push(`<td><strong>Total</strong></td>` + GROUPS.map(g => num(`<strong>${fmt(total(g))}</strong>`) + num("100%")).join(""));
          return { head, body };
        } }
    ]
  };
 
  const page = document.querySelector("section.story");
  if (!page || !TABLES[page.id]) return;
  const cards = page.querySelectorAll(".chart-card");
  // these stay visible in table view; everything else in the card is the chart
  const KEEP = ".controls, .chart-title, .chart-desc, .source, .table-view";
 
  TABLES[page.id].forEach((spec, n) => {
    const card = cards[spec.card];
    if (!card) return;
 
    // a .controls row to hold the button (some cards don't have one yet)
    let controls = card.querySelector(".controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "controls";
      card.prepend(controls);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg seg-table";
    btn.textContent = "Table";
    btn.setAttribute("aria-pressed", "false");
    controls.appendChild(btn);
 
    const tableEl = document.createElement("div");
    tableEl.className = "table-view";
    tableEl.id = `${page.id}-table-${n + 1}`;
    tableEl.hidden = true;
    btn.setAttribute("aria-controls", tableEl.id);
    const src = card.querySelector(".source");
    src ? card.insertBefore(tableEl, src) : card.appendChild(tableEl);
 
    let hiddenByUs = [];
    let built = false;
 
    function showTable(on) {
      btn.setAttribute("aria-pressed", String(on));
      if (on) {
        hiddenByUs = [...card.children].filter(el => !el.matches(KEEP) && !el.hidden);
        hiddenByUs.forEach(el => { el.hidden = true; });
        tableEl.hidden = false;
        // other buttons in the card no longer look "on" while the table is showing
        controls.querySelectorAll(".seg:not(.seg-table)").forEach(b => b.classList.add("seg-dim"));
        if (!built) {
          built = true;
          tableEl.innerHTML = '<p class="chart-note">Loading…</p>';
          d3.csv(spec.csv).then(rows => {
            const { head, body } = spec.build(rows);
            tableEl.innerHTML = `<table><caption class="chart-note" style="text-align:left">${spec.caption}</caption>
              <thead><tr>${head.map((h, i) => `<th scope="col"${i ? ' class="num"' : ""}>${h}</th>`).join("")}</tr></thead>
              <tbody>${body.map(r => `<tr>${r}</tr>`).join("")}</tbody></table>`;
          }).catch(() => { tableEl.innerHTML = '<p class="chart-note">Could not load the data.</p>'; });
        }
      } else {
        hiddenByUs.forEach(el => { el.hidden = false; });
        hiddenByUs = [];
        tableEl.hidden = true;
        controls.querySelectorAll(".seg-dim").forEach(b => b.classList.remove("seg-dim"));
        window.dispatchEvent(new Event("resize")); // redraw the chart at the right size
      }
    }
 
    btn.addEventListener("click", () => showTable(btn.getAttribute("aria-pressed") !== "true"));
    // pressing Count / % change etc. goes back to the chart
    controls.querySelectorAll(".seg:not(.seg-table)").forEach(b =>
      b.addEventListener("click", () => { if (btn.getAttribute("aria-pressed") === "true") showTable(false); }));
    // moving the Q3 year slider also goes back to the map
    controls.querySelectorAll("input").forEach(i =>
      i.addEventListener("input", () => { if (btn.getAttribute("aria-pressed") === "true") showTable(false); }));
  });
})();
 