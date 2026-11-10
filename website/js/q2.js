/* Q2: How do males and females compare, and how did each change in 2020?
   (a) Grouped bars: females and males side by side for each year.
       Toggle between counts and % change on the previous year.
   (b) Age as a secondary view: % change 2011 to 2021 by age group.
   Data: data/sex_annual.csv (year, sex, hospitalisations)
         data/age_annual.csv (year, age_group, hospitalisations)
   Note: the age file is not split by sex, so the two views are separate. */

(function () {
  const { fmt, pct, frame, showTip, hideTip, onResize, segmented, loadError } = Viz;
  const barsEl = document.getElementById("q2-bars");
  const ageEl = document.getElementById("q2-age");
  const summaryEl = document.getElementById("q2-summary");
  const SEXES = ["Female", "Male"];
  const CLS = { Female: "series-1", Male: "series-2" };
  const AGE_ORDER = ["0-7", "8-16", "17-25", "26-39", "40-64", "65-74", "75+"];
  let sex = [], age = [], years = [];
  let mode = "count"; // "count" | "change"

  Promise.all([
    d3.csv("data/sex_annual.csv", d => ({ year: +d.year, sex: d.sex, value: +d.hospitalisations })),
    d3.csv("data/age_annual.csv", d => ({ year: +d.year, group: d.age_group, value: +d.hospitalisations }))
  ]).then(([s, a]) => {
    // keep Female and Male only (the "intersex, indeterminate or missing" group is 0 to 7 a year)
    sex = s.filter(d => SEXES.includes(d.sex));
    const key = new Map(sex.map(d => [d.sex + d.year, d]));
    sex.forEach(d => { const p = key.get(d.sex + (d.year - 1)); d.change = p ? d.value / p.value - 1 : null; });
    years = [...new Set(sex.map(d => d.year))].sort();
    age = a.filter(d => AGE_ORDER.includes(d.group));
    render();
  }).catch(err => { loadError(barsEl); console.error(err); });

  segmented("#q2 .seg[data-value]", v => { mode = v; renderBars(); });
  onResize(render);
  function render() { if (sex.length) { renderBars(); renderAge(); } }

  /* ---------- (a) Grouped bars by sex ---------- */
  function renderBars() {
    hideTip();
    const data = mode === "change" ? sex.filter(d => d.change !== null) : sex;
    const yrs = [...new Set(data.map(d => d.year))].sort();
    const narrow = barsEl.clientWidth < 560;
    const { g, iw, ih } = frame(barsEl, { height: w => w < 500 ? 280 : 340, margin: { left: 56, right: 8, top: 28 } });
    const x0 = d3.scaleBand().domain(yrs).range([0, iw]).paddingInner(0.25);
    const x1 = d3.scaleBand().domain(SEXES).range([0, x0.bandwidth()]).padding(0.08);
    const val = d => mode === "change" ? d.change : d.value;
    const y = mode === "change"
      ? d3.scaleLinear().domain([d3.min(data, val) * 1.25, d3.max(data, val) * 1.1]).nice().range([ih, 0])
      : d3.scaleLinear().domain([0, d3.max(data, val)]).nice().range([ih, 0]);

    // 2020 highlight band
    if (yrs.includes(2020)) {
      g.append("rect").attr("class", "band").attr("x", x0(2020) - x0.step() * x0.paddingInner() / 2)
        .attr("width", x0.step()).attr("y", -20).attr("height", ih + 20);
      g.append("text").attr("class", "band-label").attr("x", x0(2020) + x0.bandwidth() / 2).attr("y", -8)
        .attr("text-anchor", "middle").text("2020");
    }

    const fmtAxis = mode === "change" ? (v => v === 0 ? "0%" : d3.format("+.0%")(v)) : d3.format("~s");
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat(""));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(fmtAxis).tickSizeOuter(0))
      .call(s => s.select(".domain").remove());
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x0).tickValues(narrow ? yrs.filter((v, i) => i % 2 === 0) : yrs).tickSizeOuter(0).tickFormat(d3.format("d")))
      .call(s => s.select(".domain").remove());
    if (mode === "change") g.append("line").attr("class", "zero-line").attr("x1", 0).attr("x2", iw).attr("y1", y(0)).attr("y2", y(0));

    g.append("g").selectAll("rect").data(data).join("rect")
      .attr("class", d => `gbar ${CLS[d.sex]}`)
      .attr("x", d => x0(d.year) + x1(d.sex)).attr("width", x1.bandwidth())
      .attr("y", d => Math.min(y(val(d)), y(0))).attr("height", d => Math.abs(y(val(d)) - y(0)))
      .attr("rx", 2)
      .on("pointermove", (event, d) => {
        const other = sex.find(o => o.year === d.year && o.sex !== d.sex);
        const total = d.value + other.value;
        showTip(event, `<div class="tt-label">${d.sex === "Female" ? "Females" : "Males"}, ${d.year}</div>
          <div class="tt-value">${fmt(d.value)} hospitalisations</div>
          ${d.change !== null ? `<div class="tt-label">${pct(d.change)} on ${d.year - 1}</div>` : ""}
          <div class="tt-label">${d3.format(".1%")(d.value / total)} of female + male cases</div>`);
      })
      .on("pointerleave", hideTip);

    // label the 2020 bars with their change, so the key finding is visible without hovering
    if (mode === "change") {
      g.append("g").selectAll("text").data(data.filter(d => d.year === 2020)).join("text")
        .attr("class", "val-label").attr("text-anchor", "middle")
        .attr("x", d => x0(d.year) + x1(d.sex) + x1.bandwidth() / 2)
        .attr("y", d => val(d) < 0 ? y(val(d)) + 13 : y(val(d)) - 4)
        .style("font-size", narrow ? "10px" : null)
        .text(d => d3.format("+.1%")(d.change));
    }

    const f19 = sex.find(d => d.sex === "Female" && d.year === 2020), m19 = sex.find(d => d.sex === "Male" && d.year === 2020);
    const last = years[years.length - 1];
    const fL = sex.find(d => d.sex === "Female" && d.year === last), mL = sex.find(d => d.sex === "Male" && d.year === last);
    summaryEl.textContent = mode === "count"
      ? `Males outnumber females every year: in ${last}, ${fmt(mL.value)} males and ${fmt(fL.value)} females were hospitalised. Switch to “% change” to compare 2020.`
      : `In 2020, female hospitalisations fell ${d3.format(".1%")(-f19.change)} while male hospitalisations fell only ${d3.format(".1%")(-m19.change)}. This coincides with COVID-19 restrictions.`;
  }

  /* ---------- (b) Age groups: change 2011 to 2021 ---------- */
  function renderAge() {
    const first = years[0], last = years[years.length - 1];
    const data = AGE_ORDER.map(group => {
      const a = age.find(d => d.group === group && d.year === first), b = age.find(d => d.group === group && d.year === last);
      return { group, from: a.value, to: b.value, change: b.value / a.value - 1 };
    });
    const totalA = d3.sum(data, d => d.from), totalB = d3.sum(data, d => d.to);
    const overall = totalB / totalA - 1;

    const { g, iw, ih } = frame(ageEl, { height: () => AGE_ORDER.length * 30 + 36, margin: { left: 56, right: 56, top: 20, bottom: 16 } });
    const x = d3.scaleLinear().domain([Math.min(0, d3.min(data, d => d.change)), d3.max(data, d => d.change)]).nice().range([0, iw]);
    const y = d3.scaleBand().domain(AGE_ORDER).range([0, ih]).padding(0.25);

    g.append("line").attr("class", "zero-line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", ih);
    g.selectAll("rect").data(data).join("rect")
      .attr("class", d => d.change >= 0 ? "bar-up" : "bar-down")
      .attr("x", d => Math.min(x(0), x(d.change))).attr("width", d => Math.abs(x(d.change) - x(0)))
      .attr("y", d => y(d.group)).attr("height", y.bandwidth()).attr("rx", 2)
      .on("pointermove", (event, d) => showTip(event,
        `<div class="tt-label">Age ${d.group}</div>
         <div class="tt-value">${pct(d.change)} from ${first} to ${last}</div>
         <div class="tt-label">${fmt(d.from)} → ${fmt(d.to)} hospitalisations</div>`))
      .on("pointerleave", hideTip);
    g.selectAll(".cat-label").data(data).join("text").attr("class", "cat-label")
      .attr("x", -8).attr("y", d => y(d.group) + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end")
      .text(d => d.group);
    g.selectAll(".val-label").data(data).join("text").attr("class", "val-label")
      // small falls: put the label on the right of the zero line so it doesn't hit the age label
      .attr("x", d => d.change >= 0 ? x(d.change) + 6 : x(0) + 6)
      .attr("text-anchor", "start")
      .attr("y", d => y(d.group) + y.bandwidth() / 2).attr("dy", "0.35em")
      .text(d => d3.format("+.1%")(d.change));
    // overall reference line
    g.append("line").attr("class", "annot-line").attr("stroke-dasharray", "4 3")
      .attr("x1", x(overall)).attr("x2", x(overall)).attr("y1", -6).attr("y2", ih);
    g.append("text").attr("class", "annot-text").attr("x", x(overall)).attr("y", -10).attr("text-anchor", "middle")
      .text(`All ages ${d3.format("+.1%")(overall)}`);
  }
})();
