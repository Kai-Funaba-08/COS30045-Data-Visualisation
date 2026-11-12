/* Q4: Which road users drove the change from 2011 to 2021?
   Count tab: one line chart, a line per road user (all years at once, nothing to select).
   % change tab: heatmap, one row per road user, one column per year.
   Data: data/road_user_annual.csv (year, road_user, hospitalisations) */

(function () {
  const { fmt, pct, css, frame, showTip, hideTip, onResize, segmented, loadError } = Viz;
  const heatEl = document.getElementById("q4-heat");
  const legendEl = document.getElementById("q4-legend");
  const summaryEl = document.getElementById("q4-summary");

  // Shorter names for small screens
  const SHORT = {
    "Heavy transport unknown position": "Heavy veh. (unknown)",
    "Heavy transport passenger": "Heavy veh. passenger",
    "Heavy transport driver": "Heavy veh. driver",
    "Pick-up truck or van occupant": "Pick-up or van",
    "Car unknown position": "Car (unknown)"
  };

  // "+0%" instead of "-0%" for tiny changes
  const pct0 = v => d3.format("+.0%")(Math.round(v * 100) / 100 || 0);
  const HIGHLIGHT_YEAR = 2020;   // shaded in every panel
  let rows = [], order = [], years = [], byUser = new Map();
  let mode = "count"; // "count" | "change"

  d3.csv("data/road_user_annual.csv", d => ({
    year: +d.year, user: d.road_user, value: +d.hospitalisations
  })).then(data => {
    years = [...new Set(data.map(d => d.year))].sort();
    const first = years[0], last = years[years.length - 1];
    const base = new Map(data.filter(d => d.year === first).map(d => [d.user, d.value]));
    data.forEach(d => { d.change = d.value / base.get(d.user) - 1; d.diff = d.value - base.get(d.user); });
    // biggest road users first (by 2021 count)
    order = data.filter(d => d.year === last).sort((a, b) => b.value - a.value).map(d => d.user);
    byUser = d3.group(data, d => d.user);
    byUser.forEach(list => list.sort((a, b) => a.year - b.year));
    rows = data;
    render();
  }).catch(err => { loadError(heatEl); console.error(err); });

  segmented("#q4 .seg[data-value]", v => { mode = v; render(); });
  onResize(render);

  function render() {
    if (!rows.length) return;
    hideTip();
    if (mode === "count") renderMultiLine(); else renderHeatmap();
  }

  /* ---------- Count: line charts, one line per road user ---------- */
  // Two charts on top of each other, both always visible (nothing to select):
  // the 5 biggest groups, then the 7 smaller groups on their own scale so their lines aren't squashed.
  const TOP = 5;
  function renderMultiLine() {
    const top = order.slice(0, TOP), rest = order.slice(TOP);

    summaryEl.textContent =
      "Car drivers, motorcyclists and pedal cyclists are the three biggest groups. " +
      "Pedal cyclists rose the most (+51% since 2011) and were the only large group to go up in 2020 (+14%), " +
      "while car drivers (−9%) and pedestrians (−22%) fell. Among the smaller groups, pick-up and van occupants rose 38%, " +
      "while bus occupants fell 32% in 2020. The 2020 changes coincide with COVID-19 restrictions.";

    legendEl.innerHTML = `<div class="legend-row">
        <span><span class="swatch ru-band-sw"></span>${HIGHLIGHT_YEAR} (COVID-19 restrictions)</span>
        <span>Hover for exact numbers</span>
      </div>`;

    heatEl.innerHTML = `
      <p class="ru-sub">Largest groups</p><div class="ru-chart"></div>
      <p class="ru-sub">Smaller groups <span class="ru-sub-note">(under 1,000 a year, note the smaller scale)</span></p><div class="ru-chart"></div>`;
    const [bigEl, smallEl] = heatEl.querySelectorAll(".ru-chart");
    drawLines(bigEl, top, 1, w => (w < 500 ? 320 : 380));
    drawLines(smallEl, rest, TOP + 1, w => (w < 500 ? 300 : 340));
  }

  // users: road users to draw; c0: first colour number (--ru-c0, --ru-c0+1 ...)
  function drawLines(el, users, c0, height) {
    const first = years[0], last = years[years.length - 1];
    const narrow = heatEl.clientWidth < 560;
    const colour = u => css(`--ru-${users.indexOf(u) + c0}`);
    const label = u => SHORT[u] || u;   // short names so long labels fit beside the chart
    const series = users.map(u => byUser.get(u));

    const { svg, g, iw, ih, margin } = frame(el, {
      height,
      margin: { top: 20, right: narrow ? 136 : 176, bottom: 32, left: 52 }
    });
    const x = d3.scaleLinear().domain([first, last]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, d3.max(series.flat(), d => d.value) * 1.05]).nice().range([ih, 0]);

    // 2020 band
    const step = x(first + 1) - x(first);
    g.append("rect").attr("class", "band")
      .attr("x", x(HIGHLIGHT_YEAR) - step / 2).attr("width", step).attr("y", 0).attr("height", ih);
    g.append("text").attr("class", "band-label").attr("x", x(HIGHLIGHT_YEAR)).attr("y", -6)
      .attr("text-anchor", "middle").text(HIGHLIGHT_YEAR);

    g.append("g").attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""));
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).tickValues(narrow ? [first, 2016, last] : years).tickFormat(d3.format("d")).tickSizeOuter(0));
    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")))
      .call(s => s.select(".domain").remove());

    const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
    g.append("g").selectAll("path").data(users).join("path")
      .attr("class", "line ru-major").style("stroke", colour).attr("d", u => line(byUser.get(u)));
    g.append("g").selectAll("circle").data(users).join("circle")
      .attr("class", "dot").attr("r", 3.5).style("fill", colour)
      .attr("cx", x(last)).attr("cy", u => y(byUser.get(u).at(-1).value));

    // labels at the end of each line ("Name  2021 count"), nudged apart so they don't overlap
    const gap = narrow ? 28 : 17;   // on phones the count goes on a second line
    const labels = users.map(u => ({ u, v: byUser.get(u).at(-1).value }));
    labels.forEach(l => { l.y = y(l.v); });
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + gap);
    const bottom = narrow ? ih - 14 : ih - 2;                       // if pushed below the chart, slide the stack back up
    for (let i = labels.length - 1; i >= 0; i--) {
      const limit = i === labels.length - 1 ? bottom : labels[i + 1].y - gap;
      labels[i].y = Math.min(labels[i].y, limit);
    }
    const lab = g.append("g").selectAll("text").data(labels).join("text")
      .attr("class", "series-label").attr("x", iw + 10).attr("y", d => narrow ? d.y - 6 : d.y).attr("dy", "0.35em");
    lab.append("tspan").style("fill", d => colour(d.u)).text(d => label(d.u));
    lab.append("tspan").attr("class", "muted")
      .attr("x", narrow ? iw + 10 : null).attr("dy", narrow ? "1.15em" : null)
      .text(d => narrow ? fmt(d.v) : `  ${fmt(d.v)}`);

    // hover: crosshair on the nearest year, tooltip lists the road users in this chart
    const hover = g.append("g").style("display", "none");
    hover.append("line").attr("class", "crosshair").attr("y1", 0).attr("y2", ih);
    const hdots = hover.selectAll("circle").data(users).join("circle").attr("class", "hover-dot").attr("r", 4.5).style("fill", colour);
    svg.append("rect").attr("class", "ru-hit")
      .attr("x", margin.left).attr("y", margin.top).attr("width", iw).attr("height", ih)
      .on("pointermove", event => {
        const [mx] = d3.pointer(event, g.node());
        const yr = Math.max(first, Math.min(last, Math.round(x.invert(mx))));
        const at = u => byUser.get(u).find(r => r.year === yr);
        hover.style("display", null);
        hover.select("line").attr("x1", x(yr)).attr("x2", x(yr));
        hdots.attr("cx", x(yr)).attr("cy", u => y(at(u).value));
        const rowsHtml = [...users].sort((a, b) => at(b).value - at(a).value).map(u => {
          const d = at(u);
          return `<tr><td><span class="swatch" style="background:${colour(u)}"></span>${SHORT[u] || u}</td>
            <td class="num">${fmt(d.value)}</td>${yr > first ? `<td class="num tt-label">${pct0(d.change)}</td>` : ""}</tr>`;
        }).join("");
        showTip(event, `<div class="tt-label">${yr}${yr > first ? ` · change since ${first}` : ""}</div>
          <table class="tt-table">${rowsHtml}</table>`);
      })
      .on("pointerleave", () => { hover.style("display", "none"); hideTip(); });
  }

  /* ---------- % change: heatmap (unchanged) ---------- */
  function renderHeatmap() {
    const narrow = heatEl.clientWidth < 560;
    const cellH = narrow ? 28 : 34;
    const ih = order.length * cellH;
    const { g, iw } = frame(heatEl, {
      height: () => ih + 40,
      margin: { left: narrow ? 128 : 220, right: 8, top: 8, bottom: 32 }
    });
    const x = d3.scaleBand().domain(years).range([0, iw]).paddingInner(0.06);
    const y = d3.scaleBand().domain(order).range([0, ih]).paddingInner(0.08);

    const val = d => d.change;
    const m = d3.max(rows, d => Math.abs(d.change));
    const color = d3.scaleDiverging().domain([-m, 0, m])
      .interpolator(d3.piecewise(d3.interpolateRgb, [css("--div-neg"), css("--div-mid"), css("--div-pos")]));
    const ticks = [-m, 0, m], legendFmt = v => v === 0 ? "0%" : pct0(v);
    const dark = d => Math.abs(d.change) > m * 0.55;          // strong colours get white text

    summaryEl.textContent = "Pedal cyclists grew the most of the large groups (+51% from 2011 to 2021), while pedestrians and car passengers fell. Small groups such as bus occupants swing a lot because their counts are low.";

    g.append("g").selectAll("rect").data(rows).join("rect")
      .attr("class", "cell")
      .attr("x", d => x(d.year)).attr("y", d => y(d.user))
      .attr("width", x.bandwidth()).attr("height", y.bandwidth())
      .attr("rx", 3)
      .attr("fill", d => color(val(d)))
      .on("pointermove", (event, d) => showTip(event,
        `<div class="tt-label">${d.user}, ${d.year}</div>
         <div class="tt-value">${fmt(d.value)} hospitalisations</div>
         ${d.year > years[0] ? `<div class="tt-label">${pct(d.change)} (${d3.format("+,")(d.diff)}) since ${years[0]}</div>` : ""}`))
      .on("pointerleave", hideTip);

    // value in each cell when there is room
    if (x.bandwidth() >= 38) {
      g.append("g").selectAll("text").data(rows.filter(d => d.year > years[0])).join("text")
        .attr("class", "cell-label")
        .attr("x", d => x(d.year) + x.bandwidth() / 2)
        .attr("y", d => y(d.user) + y.bandwidth() / 2)
        .attr("dy", "0.35em").attr("text-anchor", "middle")
        .attr("fill", d => dark(d) ? "#ffffff" : "#0b0b0b")
        .text(d => pct0(d.change));
    }

    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).tickValues(narrow ? years.filter((yr, i) => i % 2 === 0) : years).tickSizeOuter(0))
      .call(s => s.select(".domain").remove());
    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).tickSize(0).tickPadding(8).tickFormat(u => narrow ? (SHORT[u] || u) : u))
      .call(s => s.select(".domain").remove());

    // colour legend
    const w = Math.min(260, heatEl.clientWidth - 32);
    legendEl.innerHTML = "";
    const ls = d3.select(legendEl).append("svg").attr("viewBox", `0 0 ${w + 20} 40`)
      .attr("width", w + 20).attr("height", 40).attr("aria-hidden", "true");
    const grad = ls.append("defs").append("linearGradient").attr("id", "q4-grad");
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(lo + t * (hi - lo))));
    ls.append("rect").attr("x", 10).attr("y", 4).attr("width", w).attr("height", 10).attr("rx", 2).attr("fill", "url(#q4-grad)");
    const lx = d3.scaleLinear().domain([lo, hi]).range([10, 10 + w]);
    ls.selectAll("text").data(ticks).join("text").attr("class", "legend-text")
      .attr("x", d => lx(d)).attr("y", 30)
      .attr("text-anchor", (d, i) => i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle")
      .text(legendFmt);
  }
})();
