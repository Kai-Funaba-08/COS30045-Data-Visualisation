/* Q5: How do First Nations patterns compare, within the data's limits?
   Two donuts for 2021: share of hospitalisations by remoteness area,
   First Nations people vs non-Indigenous Australians.
   Data: data/first_nations_remoteness.csv (group, remoteness, year, hospitalisations) */

(function () {
  const { fmt, showTip, hideTip, onResize, loadError } = Viz;
  const gridEl = document.getElementById("q5-donuts");
  const summaryEl = document.getElementById("q5-summary");
  const YEAR = 2021;
  const GROUPS = ["First Nations people", "Non-Indigenous"];
  const AREAS = ["Major Cities", "Regional", "Remote"];
  const share = d3.format(".1%");
  let data = [];

  d3.csv("data/first_nations_remoteness.csv", d => ({
    group: d.group, area: d.remoteness, year: +d.year, value: +d.hospitalisations
  })).then(rows => {
    data = GROUPS.map(grp => {
      const list = rows.filter(d => d.group === grp && d.year === YEAR);
      const total = d3.sum(list, d => d.value);
      return { grp, total, parts: AREAS.map(area => {
        const value = (list.find(d => d.area === area) || { value: 0 }).value;
        return { grp, area, value, share: value / total };
      }) };
    });
    render();
  }).catch(err => { loadError(gridEl); console.error(err); });

  onResize(render);

  function render() {
    if (!data.length) return;
    hideTip();
    gridEl.innerHTML = "";

    for (const d of data) {
      const remote = d.parts.find(p => p.area === "Remote");
      const cell = document.createElement("figure");
      cell.className = "donut-cell";
      cell.innerHTML = `<figcaption class="donut-title">${d.grp}</figcaption><div class="donut-chart"></div>`;
      // screen readers get the numbers as text instead of the drawing
      cell.querySelector(".donut-chart").setAttribute("role", "img");
      cell.querySelector(".donut-chart").setAttribute("aria-label",
        `${d.grp}, ${YEAR}: ` + d.parts.map(p => `${p.area} ${share(p.share)}`).join(", ") + `, of ${fmt(d.total)} hospitalisations.`);
      gridEl.appendChild(cell);
      const el = cell.querySelector(".donut-chart");

      const size = Math.min(260, Math.max(180, el.clientWidth));
      const r = size / 2, inner = r * 0.6;
      const svg = d3.select(el).append("svg")
        .attr("viewBox", `0 0 ${size} ${size}`).attr("width", size).attr("height", size)
        .attr("aria-hidden", "true");
      const g = svg.append("g").attr("transform", `translate(${r},${r})`);

      const pie = d3.pie().value(p => p.value).sort(null).padAngle(0.012);
      const arc = d3.arc().innerRadius(inner).outerRadius(r - 2).cornerRadius(3);
      const arcs = pie(d.parts);

      g.selectAll("path").data(arcs).join("path")
        .attr("class", a => `donut-seg seg-${AREAS.indexOf(a.data.area) + 1}`)
        .attr("d", arc)
        .on("pointermove", (event, a) => showTip(event,
          `<div class="tt-label">${a.data.grp}, ${YEAR}</div>
           <div>${a.data.area}: <span class="tt-value">${share(a.data.share)}</span></div>
           <div class="tt-label">${fmt(a.data.value)} hospitalisations</div>`))
        .on("pointerleave", hideTip);

      // % label on slices big enough to hold it
      g.selectAll(".seg-label").data(arcs.filter(a => a.endAngle - a.startAngle > 0.35)).join("text")
        .attr("class", a => `seg-label on-${AREAS.indexOf(a.data.area) + 1}`)
        .attr("transform", a => `translate(${arc.centroid(a)})`)
        .attr("dy", "0.35em").attr("text-anchor", "middle")
        .text(a => d3.format(".0%")(a.data.share));

      // centre: the key comparison (share living in remote areas)
      g.append("text").attr("class", "donut-center").attr("text-anchor", "middle").attr("dy", "-0.1em")
        .text(share(remote.share));
      g.append("text").attr("class", "donut-sub").attr("text-anchor", "middle").attr("dy", "1.4em")
        .text("in remote areas");

      cell.insertAdjacentHTML("beforeend", `<p class="chart-note donut-total">${fmt(d.total)} hospitalisations</p>`);
    }

    const fn = data[0].parts.find(p => p.area === "Remote"), ni = data[1].parts.find(p => p.area === "Remote");
    summaryEl.textContent =
      `In ${YEAR}, ${share(fn.share)} of First Nations hospitalisations were of people living in remote areas, against ${share(ni.share)} for non-Indigenous Australians. Shares use records with a known remoteness area only.`;
  }
})();
