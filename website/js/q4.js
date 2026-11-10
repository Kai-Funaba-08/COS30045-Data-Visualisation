/* Q4: Which road users drove the change from 2011 to 2021?
   Heatmap: one row per road user, one column per year.
   Colour = hospitalisation count, or % change from 2011.
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
  let rows = [], order = [], years = [];
  let mode = "count"; // "count" | "change"

  d3.csv("data/road_user_annual.csv", d => ({
    year: +d.year, user: d.road_user, value: +d.hospitalisations
  })).then(data => {
    years = [...new Set(data.map(d => d.year))].sort();
    const first = years[0], last = years[years.length - 1];
    const base = new Map(data.filter(d => d.year === first).map(d => [d.user, d.value]));
    data.forEach(d => { d.change = d.value / base.get(d.user) - 1; d.diff = d.value - base.get(d.user); });
    // biggest road users at the top (by 2021 count)
    order = data.filter(d => d.year === last).sort((a, b) => b.value - a.value).map(d => d.user);
    rows = data;
    render();
  }).catch(err => { loadError(heatEl); console.error(err); });

  segmented("#q4 .seg[data-value]", v => { mode = v; render(); });
  onResize(render);

  function render() {
    if (!rows.length) return;
    hideTip();
    const narrow = heatEl.clientWidth < 560;
    const cellH = narrow ? 28 : 34;
    const ih = order.length * cellH;
    const { g, iw } = frame(heatEl, {
      height: () => ih + 40,
      margin: { left: narrow ? 128 : 220, right: 8, top: 8, bottom: 32 }
    });
    const x = d3.scaleBand().domain(years).range([0, iw]).paddingInner(0.06);
    const y = d3.scaleBand().domain(order).range([0, ih]).paddingInner(0.08);

    let color, ticks, legendFmt, val, dark;
    if (mode === "change") {
      val = d => d.change;
      const m = d3.max(rows, d => Math.abs(d.change));
      color = d3.scaleDiverging().domain([-m, 0, m])
        .interpolator(d3.piecewise(d3.interpolateRgb, [css("--div-neg"), css("--div-mid"), css("--div-pos")]));
      ticks = [-m, 0, m]; legendFmt = v => v === 0 ? "0%" : pct0(v);
      dark = d => Math.abs(d.change) > m * 0.55;          // strong colours get white text
    } else {
      val = d => d.value;
      const max = d3.max(rows, d => d.value);
      color = d3.scaleSequential().domain([0, max])
        .interpolator(d3.interpolateRgb(css("--seq-low"), css("--seq-high")));
      ticks = [0, max]; legendFmt = d3.format(",");
      // light mode: high values are dark. Dark mode: the scale is reversed, so the rule flips.
      const lightMode = d3.hsl(css("--seq-high")).l < d3.hsl(css("--seq-low")).l;
      dark = d => (d.value / max > 0.5) === lightMode;
    }

    summaryEl.textContent = mode === "count"
      ? "Car drivers, motorcyclists and pedal cyclists have the most hospitalisations every year. Switch to “% change from 2011” to see which groups grew."
      : "Pedal cyclists grew the most of the large groups (+51% from 2011 to 2021), while pedestrians and car passengers fell. Small groups such as bus occupants swing a lot because their counts are low.";

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
      g.append("g").selectAll("text").data(rows.filter(d => mode === "count" || d.year > years[0])).join("text")
        .attr("class", "cell-label")
        .attr("x", d => x(d.year) + x.bandwidth() / 2)
        .attr("y", d => y(d.user) + y.bandwidth() / 2)
        .attr("dy", "0.35em").attr("text-anchor", "middle")
        .attr("fill", d => dark(d) ? "#ffffff" : "#0b0b0b")
        .text(d => mode === "count" ? d3.format(".2~s")(d.value) : pct0(d.change));
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
