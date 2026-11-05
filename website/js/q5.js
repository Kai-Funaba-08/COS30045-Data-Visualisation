/* Q5: How do First Nations patterns compare, within the data's limits?
   (a) Indexed lines: 2011 = 100 for First Nations people and non-Indigenous Australians.
   (b) 100% stacked bars: share of hospitalisations by remoteness, for a chosen year.
   Data: data/first_nation_annual.csv (group, year, hospitalisations)
         data/first_nations_remoteness.csv (group, remoteness, year, hospitalisations) */

(function () {
  const { fmt, pct, frame, showTip, hideTip, onResize, loadError } = Viz;
  const linesEl = document.getElementById("q5-lines");
  const barsEl = document.getElementById("q5-bars");
  const yearSel = document.getElementById("q5-year");
  const GROUPS = ["First Nations people", "Non-Indigenous"];
  const AREAS = ["Major Cities", "Regional", "Remote"];
  let annual = [], remote = [];

  Promise.all([
    d3.csv("data/first_nation_annual.csv", d => ({ group: d.group, year: +d.year, value: +d.hospitalisations })),
    d3.csv("data/first_nations_remoteness.csv", d => ({ group: d.group, area: d.remoteness, year: +d.year, value: +d.hospitalisations }))
  ]).then(([a, r]) => {
    const base = new Map(a.filter(d => d.year === 2011).map(d => [d.group, d.value]));
    annual = a.map(d => ({ ...d, index: d.value / base.get(d.group) * 100 }));
    remote = r;
    const years = [...new Set(r.map(d => d.year))].sort();
    yearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    yearSel.value = years[years.length - 1];
    yearSel.addEventListener("change", renderBars);
    render();
  }).catch(err => { loadError(linesEl); console.error(err); });

  onResize(render);
  function render() { if (annual.length) { renderLines(); renderBars(); } }

  /* ---------- (a) Indexed lines ---------- */
  function renderLines() {
    hideTip();
    const { g, iw, ih, width } = frame(linesEl, { height: w => w < 500 ? 260 : 320, margin: { right: 110 } });
    const series = GROUPS.map((grp, i) => ({ grp, cls: `series-${i + 1}`,
      values: annual.filter(d => d.group === grp).sort((a, b) => a.year - b.year) }));
    const x = d3.scaleLinear().domain(d3.extent(annual, d => d.year)).range([0, iw]);
    const y = d3.scaleLinear().domain([80, d3.max(annual, d => d.index)]).nice().range([ih, 0]);

    g.append("rect").attr("class", "band").attr("x", x(2019.5)).attr("width", x(2020.5) - x(2019.5)).attr("height", ih);
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickSizeOuter(0)).call(s => s.select(".domain").remove());
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(width < 500 ? 6 : 11).tickFormat(d3.format("d")).tickSizeOuter(0));
    // baseline at 100
    g.append("line").attr("class", "zero-line").attr("x1", 0).attr("x2", iw).attr("y1", y(100)).attr("y2", y(100));
    g.append("text").attr("class", "annot-text").attr("x", iw).attr("y", y(100) + 16).attr("text-anchor", "end").text("2011 = 100");

    const line = d3.line().x(d => x(d.year)).y(d => y(d.index));
    for (const s of series) {
      g.append("path").datum(s.values).attr("class", `line ${s.cls}`).attr("d", line);
      const last = s.values[s.values.length - 1];
      const t = g.append("text").attr("class", "series-label").attr("x", x(last.year) + 8).attr("y", y(last.index)).attr("dy", "0.35em");
      t.append("tspan").text(s.grp === GROUPS[0] ? "First Nations" : "Non-Indigenous");
      t.append("tspan").attr("x", x(last.year) + 8).attr("dy", "1.2em").attr("class", "muted").text(d3.format("+.1%")(last.index / 100 - 1));
    }

    const cross = g.append("line").attr("class", "crosshair").attr("y2", ih).style("display", "none");
    const dots = g.selectAll(".hover-dot").data(series).join("circle").attr("class", d => `hover-dot ${d.cls}`).attr("r", 5).style("display", "none");
    g.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent")
      .on("pointermove", event => {
        const yr = Math.round(x.invert(d3.pointer(event)[0]));
        cross.attr("x1", x(yr)).attr("x2", x(yr)).style("display", null);
        dots.style("display", null).attr("cx", x(yr)).attr("cy", d => y(d.values.find(v => v.year === yr).index));
        showTip(event, `<div class="tt-label">${yr}</div>` + series.map(s => {
          const v = s.values.find(v => v.year === yr);
          return `<div><span class="swatch ${s.cls}"></span>${s.grp}: <span class="tt-value">${v.index.toFixed(1)}</span> <span class="tt-label">(${fmt(v.value)})</span></div>`;
        }).join(""));
      })
      .on("pointerleave", () => { cross.style("display", "none"); dots.style("display", "none"); hideTip(); });
  }

  /* ---------- (b) Remoteness: 100% stacked bars ---------- */
  function renderBars() {
    hideTip();
    const yr = +yearSel.value;
    const data = GROUPS.map(grp => {
      const list = remote.filter(d => d.group === grp && d.year === yr);
      const total = d3.sum(list, d => d.value);
      let acc = 0;
      return { grp, total, parts: AREAS.map(area => {
        const v = (list.find(d => d.area === area) || { value: 0 }).value;
        const p = { area, value: v, share: v / total, x0: acc };
        acc += v / total; return p;
      }) };
    });

    const narrow = barsEl.clientWidth < 560;
    const { g, iw } = frame(barsEl, { height: () => 150, margin: { left: narrow ? 100 : 160, right: 16, top: 8, bottom: 28 } });
    const x = d3.scaleLinear().domain([0, 1]).range([0, iw]);
    const y = d3.scaleBand().domain(GROUPS).range([0, 100]).padding(0.3);
    const GAP = 2; // 2px gap between segments

    g.append("g").attr("class", "axis").attr("transform", "translate(0,100)")
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".0%")).tickSizeOuter(0)).call(s => s.select(".domain").remove());
    g.append("g").selectAll("text").data(data).join("text").attr("class", "cat-label")
      .attr("x", -10).attr("y", d => y(d.grp) + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end")
      .text(d => narrow ? (d.grp === GROUPS[0] ? "First Nations" : "Non-Indigenous") : d.grp);

    const rowG = g.selectAll(".row").data(data).join("g").attr("transform", d => `translate(0,${y(d.grp)})`);
    rowG.selectAll("rect").data(d => d.parts.map(p => ({ ...p, grp: d.grp }))).join("rect")
      .attr("class", d => `seg-${AREAS.indexOf(d.area) + 1}`)
      .attr("x", d => x(d.x0) + (d.x0 > 0 ? GAP / 2 : 0))
      .attr("width", d => Math.max(0, x(d.share) - x(0) - (d.x0 > 0 ? GAP / 2 : 0) - (d.x0 + d.share < 0.999 ? GAP / 2 : 0)))
      .attr("height", y.bandwidth()).attr("rx", 3)
      .on("pointermove", (event, d) => showTip(event,
        `<div class="tt-label">${d.grp}, ${yr}</div>
         <div>${d.area}: <span class="tt-value">${d3.format(".1%")(d.share)}</span></div>
         <div class="tt-label">${fmt(d.value)} hospitalisations</div>`))
      .on("pointerleave", hideTip);
    // label segments wide enough to fit text
    rowG.selectAll("text").data(d => d.parts.filter(p => x(p.share) - x(0) > 44)).join("text")
      .attr("class", d => `seg-label on-${AREAS.indexOf(d.area) + 1}`).attr("x", d => x(d.x0 + d.share / 2)).attr("y", y.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "middle").text(d => d3.format(".0%")(d.share));

    const fn = data[0].parts.find(p => p.area === "Remote"), ni = data[1].parts.find(p => p.area === "Remote");
    document.getElementById("q5-summary").textContent =
      `In ${yr}, ${d3.format(".1%")(fn.share)} of First Nations hospitalisations were of people living in remote areas, against ${d3.format(".1%")(ni.share)} for non-Indigenous Australians. Shares use records with a known remoteness area only.`;
  }
})();
