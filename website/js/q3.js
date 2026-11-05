/* Q3: Who is most affected by age and sex?
   (a) Heatmap: age group x year, coloured by % change since 2011 or by count.
   (b) Line chart: male and female hospitalisations per year.
   Data: data/age_annual.csv (year, age_group, hospitalisations)
         data/sex_annual.csv (year, sex, hospitalisations) */

(function () {
  const { fmt, pct, css, frame, showTip, hideTip, onResize, segmented, loadError } = Viz;
  const heatEl = document.getElementById("q3-heatmap");
  const legendEl = document.getElementById("q3-legend");
  const linesEl = document.getElementById("q3-lines");
  const AGE_ORDER = ["0-7", "8-16", "17-25", "26-39", "40-64", "65-74", "75+"]; // "Missing" left out
  const SEXES = ["Male", "Female"];  // "intersex or indeterminate or missing" left out (very small)
  let age = [], sex = [];
  let mode = "change"; // "change" | "count"

  Promise.all([
    d3.csv("data/age_annual.csv", d => ({ year: +d.year, group: d.age_group, value: +d.hospitalisations })),
    d3.csv("data/sex_annual.csv", d => ({ year: +d.year, sex: d.sex, value: +d.hospitalisations }))
  ]).then(([a, s]) => {
    const base = new Map(a.filter(d => d.year === 2011).map(d => [d.group, d.value]));
    age = a.filter(d => AGE_ORDER.includes(d.group))
      .map(d => ({ ...d, change: d.value / base.get(d.group) - 1 }));
    sex = s.filter(d => SEXES.includes(d.sex));
    render();
  }).catch(err => { loadError(heatEl); console.error(err); });

  segmented("#q3 .seg[data-value]", v => { mode = v; renderHeatmap(); });
  onResize(render);

  function render() { if (age.length) { renderHeatmap(); renderLines(); } }

  /* ---------- (a) Heatmap ---------- */
  function renderHeatmap() {
    hideTip();
    const years = [...new Set(age.map(d => d.year))].sort();
    const narrow = heatEl.clientWidth < 560;
    const cellH = narrow ? 30 : 36;
    const { g, iw } = frame(heatEl, {
      height: () => AGE_ORDER.length * cellH + 48,
      margin: { left: 64, right: 8, top: 8, bottom: 32 }
    });
    const ih = AGE_ORDER.length * cellH;
    const x = d3.scaleBand().domain(years).range([0, iw]).paddingInner(0.06);
    const y = d3.scaleBand().domain(AGE_ORDER).range([0, ih]).paddingInner(0.08);

    let color, legendTicks, legendFmt;
    if (mode === "change") {
      const m = d3.max(age, d => Math.abs(d.change));
      color = d3.scaleDiverging()
        .domain([-m, 0, m])
        .interpolator(d3.piecewise(d3.interpolateRgb, [css("--div-neg"), css("--div-mid"), css("--div-pos")]));
      legendTicks = [-m, 0, m]; legendFmt = d3.format("+.0%");
    } else {
      color = d3.scaleSequential()
        .domain([0, d3.max(age, d => d.value)])
        .interpolator(d3.interpolateRgb(css("--seq-low"), css("--seq-high")));
      legendTicks = color.domain(); legendFmt = d3.format(",");
    }

    g.append("g").selectAll("rect").data(age).join("rect")
      .attr("class", "cell")
      .attr("x", d => x(d.year)).attr("y", d => y(d.group))
      .attr("width", x.bandwidth()).attr("height", y.bandwidth())
      .attr("rx", 3)
      .attr("fill", d => color(mode === "change" ? d.change : d.value))
      .on("pointermove", (event, d) => showTip(event,
        `<div class="tt-label">Age ${d.group}, ${d.year}</div>
         <div class="tt-value">${fmt(d.value)} hospitalisations</div>
         <div class="tt-label">${pct(d.change)} since 2011</div>`))
      .on("pointerleave", hideTip);

    // label the 2021 column so the key numbers are readable without hovering
    if (mode === "change") {
      const last = years[years.length - 1];
      g.append("g").selectAll("text").data(age.filter(d => d.year === last)).join("text")
        .attr("class", "cell-label")
        .style("font-size", narrow ? "9px" : null)
        .attr("x", d => x(d.year) + x.bandwidth() / 2)
        .attr("y", d => y(d.group) + y.bandwidth() / 2)
        .attr("dy", "0.35em").attr("text-anchor", "middle")
        .attr("fill", d => Math.abs(d.change) > 0.3 ? "#ffffff" : css("--text-primary"))
        .text(d => d3.format("+.0%")(d.change));
    }

    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).tickValues(narrow ? years.filter((y, i) => i % 2 === 0) : years).tickSizeOuter(0))
      .call(s => s.select(".domain").remove());
    g.append("g").attr("class", "axis")
      .call(d3.axisLeft(y).tickSize(0).tickPadding(8))
      .call(s => s.select(".domain").remove());

    // colour legend
    const w = Math.min(260, heatEl.clientWidth - 32);
    legendEl.innerHTML = "";
    const ls = d3.select(legendEl).append("svg").attr("viewBox", `0 0 ${w + 20} 40`).attr("width", w + 20).attr("height", 40).attr("aria-hidden", "true");
    const gradId = "q3-grad";
    const grad = ls.append("defs").append("linearGradient").attr("id", gradId);
    d3.range(0, 1.01, 0.1).forEach(t => {
      const v = legendTicks[0] + t * (legendTicks[legendTicks.length - 1] - legendTicks[0]);
      grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(v));
    });
    ls.append("rect").attr("x", 10).attr("y", 4).attr("width", w).attr("height", 10).attr("rx", 2).attr("fill", `url(#${gradId})`);
    const lx = d3.scaleLinear().domain([legendTicks[0], legendTicks[legendTicks.length - 1]]).range([10, 10 + w]);
    ls.selectAll("text").data(legendTicks).join("text").attr("class", "legend-text")
      .attr("x", d => lx(d)).attr("y", 30)
      .attr("text-anchor", (d, i) => i === 0 ? "start" : i === legendTicks.length - 1 ? "end" : "middle")
      .text(legendFmt);
  }

  /* ---------- (b) Male and female lines ---------- */
  function renderLines() {
    const { g, iw, ih, width } = frame(linesEl, {
      height: w => w < 500 ? 260 : 300,
      margin: { right: 70 }
    });
    const series = SEXES.map((s, i) => ({ sex: s, cls: `series-${i + 1}`, values: sex.filter(d => d.sex === s).sort((a, b) => a.year - b.year) }));
    const x = d3.scaleLinear().domain(d3.extent(sex, d => d.year)).range([0, iw]);
    const y = d3.scaleLinear().domain([0, d3.max(sex, d => d.value)]).nice().range([ih, 0]);

    // 2020 band
    g.append("rect").attr("class", "band").attr("x", x(2019.5)).attr("width", x(2020.5) - x(2019.5)).attr("height", ih);
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")).tickSizeOuter(0)).call(s => s.select(".domain").remove());
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(width < 500 ? 6 : 11).tickFormat(d3.format("d")).tickSizeOuter(0));

    const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
    for (const s of series) {
      g.append("path").datum(s.values).attr("class", `line ${s.cls}`).attr("d", line);
      const last = s.values[s.values.length - 1];
      g.append("text").attr("class", "series-label")
        .attr("x", x(last.year) + 8).attr("y", y(last.value)).attr("dy", "0.35em").text(s.sex);
    }

    // hover: crosshair + tooltip with both values
    const cross = g.append("line").attr("class", "crosshair").attr("y2", ih).style("display", "none");
    const dots = g.selectAll(".hover-dot").data(series).join("circle").attr("class", d => `hover-dot ${d.cls}`).attr("r", 5).style("display", "none");
    g.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
      .on("pointermove", event => {
        const yr = Math.round(x.invert(d3.pointer(event)[0]));
        cross.attr("x1", x(yr)).attr("x2", x(yr)).style("display", null);
        dots.style("display", null).attr("cx", x(yr)).attr("cy", d => y(d.values.find(v => v.year === yr).value));
        showTip(event, `<div class="tt-label">${yr}</div>` + series.map(s => {
          const v = s.values.find(v => v.year === yr), p = s.values.find(v => v.year === yr - 1);
          return `<div><span class="swatch ${s.cls}"></span>${s.sex}: <span class="tt-value">${fmt(v.value)}</span>${p ? ` <span class="tt-label">(${pct(v.value / p.value - 1)})</span>` : ""}</div>`;
        }).join(""));
      })
      .on("pointerleave", () => { cross.style("display", "none"); dots.style("display", "none"); hideTip(); });
  }
})();
