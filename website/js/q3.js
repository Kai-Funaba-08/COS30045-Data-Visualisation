/* Q3: How do states and territories compare once population is taken into account?
   Choropleth map of hospitalisations per 100,000 people, with a year slider,
   plus a ranked bar list so exact values are easy to compare.
   Data: data/state_annual.csv (year, state, hospitalisations, population, rate_per_100k)
         data/aus-states.json (state boundaries, Natural Earth, public domain) */

(function () {
  const { fmt, pct, css, showTip, hideTip, onResize, loadError } = Viz;
  const mapEl = document.getElementById("q3-map");
  const barsEl = document.getElementById("q3-bars");
  const legendEl = document.getElementById("q3-legend");
  const summaryEl = document.getElementById("q3-summary");
  const slider = document.getElementById("q3-year");
  const yearOut = document.getElementById("q3-year-out");

  const STATE_NAMES = { NSW: "New South Wales", Vic: "Victoria", Qld: "Queensland", WA: "Western Australia",
    SA: "South Australia", Tas: "Tasmania", ACT: "Australian Capital Territory", NT: "Northern Territory" };
  // Data breaks: years either side are not comparable for these states
  const BREAKS = {
    Vic: { to: 2012, note: "Victoria: counts from 2012 are not comparable with 2011" },
    NSW: { to: 2018, note: "NSW: a definition change between 2017 and 2018, so later years are not comparable with earlier ones" }
  };
  // Where to put each label (longitude, latitude); ACT is tiny, so its label sits out at sea with a leader line
  const LABEL_AT = { WA: [122, -26], NT: [133.5, -19.5], SA: [135.5, -30], Qld: [144.5, -22.5],
    NSW: [146.5, -32.5], Vic: [144, -37], Tas: [146.6, -42.1], ACT: [153.5, -36.2] };
  const ACT_POINT = [149.1, -35.4];

  let rows = [], geo = null, years = [];

  Promise.all([
    d3.csv("data/state_annual.csv", d => ({
      year: +d.year, state: d.state, count: +d.hospitalisations, pop: +d.population, rate: +d.rate_per_100k
    })),
    d3.json("data/aus-states.json")
  ]).then(([data, shapes]) => {
    rows = data; geo = shapes;
    years = [...new Set(rows.map(d => d.year))].sort();
    slider.min = years[0]; slider.max = years[years.length - 1]; slider.step = 1;
    slider.value = years[years.length - 1];
    slider.addEventListener("input", render);
    render();
  }).catch(err => { loadError(mapEl); console.error(err); });

  onResize(render);

  function render() {
    if (!rows.length) return;
    hideTip();
    const yr = +slider.value;
    yearOut.textContent = yr;
    const now = rows.filter(d => d.year === yr);
    const byState = new Map(now.map(d => [d.state, d]));
    const first = new Map(rows.filter(d => d.year === years[0]).map(d => [d.state, d]));

    // one colour scale for every year, so colours can be compared across years
    const [lo, hi] = d3.extent(rows, d => d.rate);
    const color = d3.scaleSequential().domain([lo, hi])
      .interpolator(d3.interpolateRgb(css("--seq-low"), css("--seq-high")));
    const lightMode = d3.hsl(css("--seq-high")).l < d3.hsl(css("--seq-low")).l;
    const ink = v => (((v - lo) / (hi - lo) > 0.5) === lightMode) ? "#ffffff" : "#0b0b0b";

    const tip = d => {
      const br = BREAKS[d.state];
      const prev = rows.find(r => r.state === d.state && r.year === yr - 1);
      return `<div class="tt-label">${STATE_NAMES[d.state]}, ${yr}</div>
        <div class="tt-value">${d.rate.toFixed(1)} per 100,000 people</div>
        <div class="tt-label">${fmt(d.count)} hospitalisations, population ${fmt(d.pop)}</div>
        ${prev ? `<div class="tt-label">${pct(d.rate / prev.rate - 1)} on ${yr - 1}</div>` : ""}
        ${br ? `<div class="tt-label">⚠ ${br.note}</div>` : ""}`;
    };

    /* ---------- map ---------- */
    const width = Math.max(280, mapEl.clientWidth);
    const height = Math.round(width * 0.9);
    mapEl.innerHTML = "";
    const svg = d3.select(mapEl).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("aria-hidden", "true");
    const projection = d3.geoConicEqualArea().parallels([-18, -36]).rotate([-133, 0])
      .fitExtent([[4, 4], [width - 36, height - 4]], geo);
    const path = d3.geoPath(projection);

    svg.append("g").selectAll("path").data(geo.features).join("path")
      .attr("class", d => `state-shape${BREAKS[d.properties.state] ? " has-break" : ""}`)
      .attr("d", path)
      .attr("fill", d => color(byState.get(d.properties.state).rate))
      .on("pointermove", (event, d) => showTip(event, tip(byState.get(d.properties.state))))
      .on("pointerleave", hideTip);

    // ACT leader line
    const a = projection(ACT_POINT), b = projection(LABEL_AT.ACT);
    svg.append("line").attr("class", "annot-line").attr("x1", a[0]).attr("y1", a[1]).attr("x2", b[0] - 16).attr("y2", b[1]);

    const small = width < 420;
    const lab = svg.append("g").selectAll("g").data(now).join("g")
      .attr("transform", d => `translate(${projection(LABEL_AT[d.state])})`)
      .attr("text-anchor", d => d.state === "ACT" ? "start" : "middle");
    const inside = d => d.state !== "ACT";
    lab.append("text").attr("class", "map-label").attr("x", d => d.state === "ACT" ? -12 : 0)
      .attr("fill", d => inside(d) ? ink(d.rate) : css("--text-primary"))
      .text(d => d.state + (BREAKS[d.state] ? "†" : ""));
    lab.append("text").attr("class", "map-value").attr("x", d => d.state === "ACT" ? -12 : 0).attr("dy", "1.15em")
      .attr("fill", d => inside(d) ? ink(d.rate) : css("--text-primary"))
      .style("font-size", small ? "11px" : null)
      .text(d => Math.round(d.rate));

    /* ---------- ranked bars ---------- */
    const sorted = now.slice().sort((p, q) => q.rate - p.rate);
    const bw = Math.max(220, barsEl.clientWidth), rowH = 30;
    const m = { top: 4, right: 40, bottom: 4, left: 44 };
    barsEl.innerHTML = "";
    const bs = d3.select(barsEl).append("svg").attr("viewBox", `0 0 ${bw} ${sorted.length * rowH + m.top + m.bottom}`).attr("aria-hidden", "true");
    const bg = bs.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const x = d3.scaleLinear().domain([0, hi]).range([0, bw - m.left - m.right]);
    const y = d3.scaleBand().domain(sorted.map(d => d.state)).range([0, sorted.length * rowH]).padding(0.25);
    bg.selectAll("rect").data(sorted).join("rect")
      .attr("y", d => y(d.state)).attr("height", y.bandwidth()).attr("width", d => x(d.rate)).attr("rx", 3)
      .attr("fill", d => color(d.rate))
      .on("pointermove", (event, d) => showTip(event, tip(d))).on("pointerleave", hideTip);
    bg.selectAll(".cat-label").data(sorted).join("text").attr("class", "cat-label")
      .attr("x", -8).attr("y", d => y(d.state) + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end")
      .text(d => d.state + (BREAKS[d.state] ? "†" : ""));
    bg.selectAll(".val-label").data(sorted).join("text").attr("class", "val-label")
      .attr("x", d => x(d.rate) + 6).attr("y", d => y(d.state) + y.bandwidth() / 2).attr("dy", "0.35em")
      .text(d => d.rate.toFixed(0));

    /* ---------- legend ---------- */
    const w = Math.min(260, mapEl.clientWidth - 32);
    legendEl.innerHTML = "";
    const ls = d3.select(legendEl).append("svg").attr("viewBox", `0 0 ${w + 20} 40`)
      .attr("width", w + 20).attr("height", 40).attr("aria-hidden", "true");
    const grad = ls.append("defs").append("linearGradient").attr("id", "q3-grad");
    d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(lo + t * (hi - lo))));
    ls.append("rect").attr("x", 10).attr("y", 4).attr("width", w).attr("height", 10).attr("rx", 2).attr("fill", "url(#q3-grad)");
    ls.selectAll("text").data([lo, hi]).join("text").attr("class", "legend-text")
      .attr("x", (d, i) => i === 0 ? 10 : 10 + w).attr("y", 30)
      .attr("text-anchor", (d, i) => i === 0 ? "start" : "end")
      .text((d, i) => `${Math.round(d)}${i ? " per 100,000" : ""}`);

    /* ---------- text summary (also read by screen readers) ---------- */
    const top = sorted[0], bottom = sorted[sorted.length - 1];
    summaryEl.textContent = `In ${yr}, ${STATE_NAMES[top.state]} had the highest rate (${top.rate.toFixed(1)} per 100,000) and ` +
      `${STATE_NAMES[bottom.state]} the lowest (${bottom.rate.toFixed(1)}). ` +
      sorted.map(d => `${d.state} ${d.rate.toFixed(1)}`).join(", ") + ".";
  }
})();
