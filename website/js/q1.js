/* Q1: national hospitalisations, annual 2011–2021 and monthly 2019–2021.
   Data: data/national_annual.csv and data/national_monthly.csv (Nicole's KNIME exports).
   To update the data, replace those CSVs; column names must stay the same. */

(function () {
  const fmt = d3.format(",");
  const pct = d3.format("+.1%");
  const monthFmt = d3.timeFormat("%B %Y");
  const tooltip = d3.select("#tooltip");
  const chartEl = document.getElementById("q1-chart");
  const tableEl = document.getElementById("q1-table");
  const summaryEl = document.getElementById("q1-summary");
  const titleEl = document.getElementById("q1-chart-title");

  let annual = [];
  let monthly = [];
  let view = "annual";
  let lastChartView = "annual";

  Promise.all([
    d3.csv("data/national_annual.csv", d => ({ year: +d.year, value: +d.hospitalisations })),
    d3.csv("data/national_monthly.csv", d => ({
      year: +d.year,
      month: +d.month_number,
      date: new Date(+d.year, +d.month_number - 1, 1),
      value: +d.hospitalisations
    }))
  ]).then(([a, m]) => {
    annual = a.sort((x, y) => x.year - y.year);
    monthly = m.sort((x, y) => x.date - y.date);
    render();
  }).catch(err => {
    chartEl.innerHTML = '<p class="chart-note">Could not load the data. Open this page through a local web server (see README), not by double-clicking the file.</p>';
    console.error(err);
  });

  // view buttons
  document.querySelectorAll("#q1 .seg").forEach(btn => {
    btn.addEventListener("click", () => {
      view = btn.dataset.view;
      if (view !== "table") lastChartView = view;
      document.querySelectorAll("#q1 .seg").forEach(b =>
        b.setAttribute("aria-pressed", String(b === btn)));
      render();
    });
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });

  function render() {
    if (!annual.length) return;
    hideTip();
    if (view === "table") {
      chartEl.hidden = true;
      tableEl.hidden = false;
      renderTable(lastChartView);
      return;
    }
    chartEl.hidden = false;
    tableEl.hidden = true;
    if (view === "annual") renderAnnual(); else renderMonthly();
  }

  function frame() {
    const width = Math.max(300, chartEl.clientWidth);
    const height = width < 500 ? 300 : 360;
    const margin = { top: 28, right: 16, bottom: 32, left: 56 };
    chartEl.innerHTML = "";
    const svg = d3.select(chartEl).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("aria-hidden", "true");
    return { svg, width, height, margin, iw: width - margin.left - margin.right, ih: height - margin.top - margin.bottom };
  }

  function yAxis(g, y, iw) {
    g.append("g").attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""));
    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")).tickSizeOuter(0))
      .call(s => s.select(".domain").remove());
  }

  /* ---------- Annual ---------- */
  function renderAnnual() {
    titleEl.textContent = "Hospitalisations per year, Australia, 2011–2021";
    const { svg, width, margin, iw, ih } = frame();
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(annual, d => d.year)).range([0, iw]);
    const y = d3.scaleLinear().domain([30000, 42000]).range([ih, 0]);

    // 2020 band
    const bw = x(2020.5) - x(2019.5);
    g.append("rect").attr("class", "band")
      .attr("x", x(2019.5)).attr("y", 0).attr("width", bw).attr("height", ih);
    g.append("text").attr("class", "band-label")
      .attr("x", x(2020)).attr("y", -10).attr("text-anchor", "middle").text("2020");

    yAxis(g, y, iw);
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(width < 500 ? 6 : 11).tickFormat(d3.format("d")).tickSizeOuter(0));

    const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
    g.append("path").datum(annual).attr("class", "line").attr("d", line);
    g.selectAll(".dot").data(annual).join("circle")
      .attr("class", "dot").attr("cx", d => x(d.year)).attr("cy", d => y(d.value)).attr("r", 4);

    // annotations: start, 2019 peak, 2020 dip, end
    const byYear = new Map(annual.map(d => [d.year, d]));
    const d20 = byYear.get(2020), d19 = byYear.get(2019);
    if (d20 && d19) {
      const ax = x(2020), ay = y(d20.value);
      const tx = width < 500 ? ax - 8 : ax - 14;
      g.append("line").attr("class", "annot-line")
        .attr("x1", ax).attr("y1", ay + 7).attr("x2", ax).attr("y2", ay + 28);
      const t = g.append("text").attr("class", "annot-text").attr("text-anchor", "end")
        .attr("x", tx).attr("y", ay + 44);
      t.append("tspan").attr("class", "strong").text(`${fmt(d20.value)} (${pct(d20.value / d19.value - 1)})`);
      t.append("tspan").attr("x", tx).attr("dy", "1.3em").text("Coincides with COVID-19");
      t.append("tspan").attr("x", tx).attr("dy", "1.3em").text("restrictions");
    }
    const first = annual[0];
    g.append("text").attr("class", "annot-text")
      .attr("x", x(first.year) + 6).attr("y", y(first.value) + 20)
      .text(fmt(first.value));

    hoverLayer(g, iw, ih, annual,
      d => x(d.year), d => y(d.value),
      mx => nearest(annual, x.invert(mx), d => d.year),
      d => {
        const prev = byYear.get(d.year - 1);
        return `<div class="tt-label">${d.year}</div>
          <div class="tt-value">${fmt(d.value)} hospitalisations</div>
          ${prev ? `<div class="tt-label">${pct(d.value / prev.value - 1)} on ${d.year - 1}</div>` : ""}`;
      });

    const a0 = annual[0], a19 = byYear.get(2019), aN = annual[annual.length - 1];
    summaryEl.textContent = `Line chart. Hospitalisations rose from ${fmt(a0.value)} in ${a0.year} to ${fmt(a19.value)} in 2019, fell to ${fmt(d20.value)} in 2020, and were ${fmt(aN.value)} in ${aN.year}. The y-axis starts at 30,000.`;
  }

  /* ---------- Monthly ---------- */
  function renderMonthly() {
    titleEl.textContent = "Hospitalisations per month, Australia, 2019–2021";
    const data = monthly.filter(d => d.year >= 2019 && d.year <= 2021);
    const { svg, width, margin, iw, ih } = frame();
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime().domain([new Date(2019, 0, 1), new Date(2021, 11, 1)]).range([0, iw]);
    const y = d3.scaleLinear().domain([1500, 4000]).range([ih, 0]);

    // 2020 band (whole year)
    g.append("rect").attr("class", "band")
      .attr("x", x(new Date(2019, 11, 16))).attr("y", 0)
      .attr("width", x(new Date(2020, 11, 16)) - x(new Date(2019, 11, 16))).attr("height", ih);
    g.append("text").attr("class", "band-label")
      .attr("x", x(new Date(2020, 6, 1))).attr("y", -10).attr("text-anchor", "middle").text("2020");

    yAxis(g, y, iw);
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(d3.timeMonth.every(width < 500 ? 6 : 3))
        .tickFormat(d => d.getMonth() === 0 ? d3.timeFormat("%Y")(d) : d3.timeFormat("%b")(d))
        .tickSizeOuter(0));

    const line = d3.line().x(d => x(d.date)).y(d => y(d.value));
    g.append("path").datum(data).attr("class", "line").attr("d", line);

    const key = d => `${d.year}-${d.month}`;
    const lookup = new Map(monthly.map(d => [key(d), d]));

    const apr20 = lookup.get("2020-4"), apr19 = lookup.get("2019-4");
    if (apr20 && apr19) {
      const ax = x(apr20.date), ay = y(apr20.value);
      g.append("circle").attr("class", "dot").attr("cx", ax).attr("cy", ay).attr("r", 4);
      const tx = ax + 12;
      const t = g.append("text").attr("class", "annot-text").attr("x", tx).attr("y", ay - 4);
      t.append("tspan").attr("class", "strong").text(`April 2020: ${fmt(apr20.value)}`);
      t.append("tspan").attr("x", tx).attr("dy", "1.3em").text(`${pct(apr20.value / apr19.value - 1)} on April 2019.`);
      t.append("tspan").attr("x", tx).attr("dy", "1.3em").text("Coincides with the first");
      t.append("tspan").attr("x", tx).attr("dy", "1.3em").text("COVID-19 restrictions.");
    }

    hoverLayer(g, iw, ih, data,
      d => x(d.date), d => y(d.value),
      mx => nearest(data, x.invert(mx), d => d.date),
      d => {
        const prev = lookup.get(`${d.year - 1}-${d.month}`);
        return `<div class="tt-label">${monthFmt(d.date)}</div>
          <div class="tt-value">${fmt(d.value)} hospitalisations</div>
          ${prev ? `<div class="tt-label">${pct(d.value / prev.value - 1)} on ${d3.timeFormat("%b")(d.date)} ${d.year - 1}</div>` : ""}`;
      });

    summaryEl.textContent = `Line chart of monthly hospitalisations from January 2019 to December 2021. The lowest month is April 2020 with ${apr20 ? fmt(apr20.value) : "n/a"}. The y-axis starts at 1,500.`;
  }

  /* ---------- Shared hover layer: crosshair + tooltip ---------- */
  function hoverLayer(g, iw, ih, data, fx, fy, pick, html) {
    const cross = g.append("line").attr("class", "crosshair").attr("y1", 0).attr("y2", ih).style("display", "none");
    const dot = g.append("circle").attr("class", "hover-dot").attr("r", 5).style("display", "none");
    const overlay = g.append("rect").attr("width", iw).attr("height", ih)
      .attr("fill", "transparent").style("cursor", "crosshair");

    function show(event, d) {
      const px = fx(d), py = fy(d);
      cross.attr("x1", px).attr("x2", px).style("display", null);
      dot.attr("cx", px).attr("cy", py).style("display", null);
      tooltip.html(html(d)).attr("hidden", null);
      const node = tooltip.node();
      const svgRect = g.node().ownerSVGElement.getBoundingClientRect();
      const scale = svgRect.width / g.node().ownerSVGElement.viewBox.baseVal.width;
      const tr = g.node().transform.baseVal.consolidate().matrix;
      let left = svgRect.left + (tr.e + px) * scale + 14;
      let top = svgRect.top + (tr.f + py) * scale - node.offsetHeight - 10;
      if (left + node.offsetWidth > window.innerWidth - 8) left -= node.offsetWidth + 28;
      if (top < 8) top += node.offsetHeight + 30;
      tooltip.style("left", `${left}px`).style("top", `${top}px`);
    }

    overlay
      .on("pointermove", event => show(event, pick(d3.pointer(event)[0])))
      .on("pointerleave", () => { cross.style("display", "none"); dot.style("display", "none"); hideTip(); });
  }

  function hideTip() { tooltip.attr("hidden", true); }

  function nearest(data, target, acc) {
    const i = d3.bisector(acc).center(data, target);
    return data[Math.max(0, Math.min(data.length - 1, i))];
  }

  /* ---------- Table view ---------- */
  function renderTable(which) {
    if (which === "monthly") {
      titleEl.textContent = "Table: hospitalisations per month, 2019–2021";
      const rows = monthly.filter(d => d.year >= 2019 && d.year <= 2021);
      tableEl.innerHTML = `<table><caption class="chart-note" style="text-align:left">Monthly hospitalisations, Australia</caption>
        <thead><tr><th scope="col">Month</th><th scope="col" class="num">Hospitalisations</th></tr></thead>
        <tbody>${rows.map(d => `<tr><td>${monthFmt(d.date)}</td><td class="num">${fmt(d.value)}</td></tr>`).join("")}</tbody></table>`;
    } else {
      titleEl.textContent = "Table: hospitalisations per year, 2011–2021";
      tableEl.innerHTML = `<table><caption class="chart-note" style="text-align:left">Annual hospitalisations, Australia</caption>
        <thead><tr><th scope="col">Year</th><th scope="col" class="num">Hospitalisations</th><th scope="col" class="num">Change on previous year</th></tr></thead>
        <tbody>${annual.map((d, i) => `<tr><td>${d.year}</td><td class="num">${fmt(d.value)}</td><td class="num">${i ? pct(d.value / annual[i - 1].value - 1) : "–"}</td></tr>`).join("")}</tbody></table>`;
    }
    summaryEl.textContent = "Table view of the data in the chart.";
  }
})();
