/* Q4: How do state and territory trends differ, and what do raw counts hide?
   Small multiples: one line per state/territory, count or rate per 100,000.
   Data: data/state_annual.csv (year, state, hospitalisations, population, rate_per_100k) */

(function () {
  const { fmt, pct, frame, showTip, hideTip, onResize, segmented, loadError } = Viz;
  const gridEl = document.getElementById("q4-grid");
  const summaryEl = document.getElementById("q4-summary");

  // Data breaks to shade: the gap between these two years is not comparable.
  const BREAKS = {
    Vic: { from: 2011, to: 2012, note: "Victoria: counts from 2012 are not comparable with 2011" },
    NSW: { from: 2017, to: 2018, note: "NSW: definition change, so the drop is partly a recording change" }
  };
  const STATE_NAMES = { NSW: "New South Wales", Vic: "Victoria", Qld: "Queensland", WA: "Western Australia",
    SA: "South Australia", Tas: "Tasmania", ACT: "Australian Capital Territory", NT: "Northern Territory" };
  const ORDER = ["NSW", "Vic", "Qld", "WA", "SA", "Tas", "ACT", "NT"];

  let rows = [];
  let mode = "count"; // "count" | "rate"

  d3.csv("data/state_annual.csv", d => ({
    year: +d.year, state: d.state, count: +d.hospitalisations, rate: +d.rate_per_100k
  })).then(data => { rows = data; render(); })
    .catch(err => { loadError(gridEl); console.error(err); });

  segmented("#q4 .seg[data-value]", v => { mode = v; render(); });
  onResize(render);

  function render() {
    if (!rows.length) return;
    hideTip();
    const val = d => d[mode];
    const yMax = d3.max(rows, val);
    const years = d3.extent(rows, d => d.year);
    gridEl.innerHTML = "";

    summaryEl.textContent = mode === "count"
      ? "Counts: the big states dominate, and the small territories look flat. Switch to rate to compare like with like. All panels share the same y-axis."
      : "Rate per 100,000 people: this removes population size, so the Northern Territory now stands out. All panels share the same y-axis.";

    for (const st of ORDER) {
      const values = rows.filter(d => d.state === st).sort((a, b) => a.year - b.year);
      const cell = document.createElement("div");
      cell.className = "sm-cell";
      cell.innerHTML = `<h4 class="sm-title">${STATE_NAMES[st]}</h4><div class="sm-chart"></div>`;
      gridEl.appendChild(cell);
      const el = cell.querySelector(".sm-chart");

      const { g, iw, ih } = frame(el, { height: () => 150, margin: { top: 10, right: 12, bottom: 22, left: 44 } });
      const x = d3.scaleLinear().domain(years).range([0, iw]);
      const y = d3.scaleLinear().domain([0, yMax]).nice().range([ih, 0]);

      const br = BREAKS[st];
      if (br) {
        g.append("rect").attr("class", "break-band")
          .attr("x", x(br.from)).attr("width", x(br.to) - x(br.from)).attr("height", ih);
        g.append("text").attr("class", "break-label").attr("x", x(br.from) + (x(br.to) - x(br.from)) / 2)
          .attr("y", ih - 4).attr("text-anchor", "middle").text("break");
      }

      g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(3).tickSize(-iw).tickFormat(""));
      g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(3).tickFormat(d3.format("~s")).tickSizeOuter(0))
        .call(s => s.select(".domain").remove());
      g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
        .call(d3.axisBottom(x).tickValues(years).tickFormat(d3.format("d")).tickSizeOuter(0));

      // If there is a break, draw the line in two pieces so the break isn't bridged
      const line = d3.line().x(d => x(d.year)).y(d => y(val(d)));
      const pieces = br
        ? [values.filter(d => d.year <= br.from), values.filter(d => d.year >= br.to)]
        : [values];
      pieces.forEach(p => g.append("path").datum(p).attr("class", "line").attr("d", line));
      const last = values[values.length - 1];
      g.append("circle").attr("class", "dot").attr("r", 3.5).attr("cx", x(last.year)).attr("cy", y(val(last)));

      const cross = g.append("line").attr("class", "crosshair").attr("y2", ih).style("display", "none");
      const dot = g.append("circle").attr("class", "hover-dot").attr("r", 4).style("display", "none");
      g.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
        .on("pointermove", event => {
          const yr = Math.max(years[0], Math.min(years[1], Math.round(x.invert(d3.pointer(event)[0]))));
          const d = values.find(v => v.year === yr), p = values.find(v => v.year === yr - 1);
          cross.attr("x1", x(yr)).attr("x2", x(yr)).style("display", null);
          dot.attr("cx", x(yr)).attr("cy", y(val(d))).style("display", null);
          showTip(event, `<div class="tt-label">${STATE_NAMES[st]}, ${yr}</div>
            <div class="tt-value">${fmt(d.count)} hospitalisations</div>
            <div class="tt-label">${d.rate.toFixed(1)} per 100,000 people</div>
            ${p ? `<div class="tt-label">${pct(val(d) / val(p) - 1)} on ${yr - 1}</div>` : ""}
            ${br && yr === br.to ? `<div class="tt-label">⚠ ${br.note}</div>` : ""}`);
        })
        .on("pointerleave", () => { cross.style("display", "none"); dot.style("display", "none"); hideTip(); });
    }
  }
})();
