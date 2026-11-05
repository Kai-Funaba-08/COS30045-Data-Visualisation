/* Q2: Which road users drove the change?
   Diverging bar chart: change in hospitalisations by road user between two years.
   Data: data/road_user_annual.csv  (year, road_user, hospitalisations) */

(function () {
  const { fmt, pct, frame, showTip, hideTip, onResize, table, loadError } = Viz;
  const chartEl = document.getElementById("q2-chart");
  const tableEl = document.getElementById("q2-table");
  const summaryEl = document.getElementById("q2-summary");
  const fromSel = document.getElementById("q2-from");
  const toSel = document.getElementById("q2-to");
  let rows = [];
  let showTable = false;
  // Shorter names for small screens
  const SHORT = {
    "Heavy transport unknown position": "Heavy veh. (unknown)",
    "Heavy transport passenger": "Heavy veh. passenger",
    "Heavy transport driver": "Heavy veh. driver",
    "Pick-up truck or van occupant": "Pick-up or van",
    "Car unknown position": "Car (unknown)"
  };

  d3.csv("data/road_user_annual.csv", d => ({
    year: +d.year, user: d.road_user, value: +d.hospitalisations
  })).then(data => {
    rows = data;
    const years = [...new Set(rows.map(d => d.year))].sort();
    for (const sel of [fromSel, toSel]) {
      sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
      sel.addEventListener("change", render);
    }
    fromSel.value = years[0];               // default 2011
    toSel.value = years[years.length - 1];  // default 2021
    document.querySelectorAll("#q2 [data-preset]").forEach(btn =>
      btn.addEventListener("click", () => {
        [fromSel.value, toSel.value] = btn.dataset.preset.split("-");
        render();
      }));
    render();
  }).catch(err => { loadError(chartEl); console.error(err); });

  document.getElementById("q2-table-btn").addEventListener("click", e => {
    showTable = !showTable;
    e.currentTarget.setAttribute("aria-pressed", String(showTable));
    render();
  });
  onResize(render);

  function changes(from, to) {
    const byUser = d3.group(rows, d => d.user);
    return [...byUser].map(([user, list]) => {
      const a = list.find(d => d.year === from), b = list.find(d => d.year === to);
      const before = a ? a.value : 0, after = b ? b.value : 0;
      return { user, before, after, change: after - before, rel: before ? after / before - 1 : null };
    }).sort((x, y) => d3.descending(x.change, y.change));
  }

  function render() {
    if (!rows.length) return;
    hideTip();
    const from = +fromSel.value, to = +toSel.value;
    const data = changes(from, to);
    const net = d3.sum(data, d => d.change);
    const top = data[0];

    summaryEl.textContent = from === to
      ? "Pick two different years to see the change."
      : `Net change ${from} to ${to}: ${net >= 0 ? "+" : ""}${fmt(net)}. Largest rise: ${top.user} (${top.change >= 0 ? "+" : ""}${fmt(top.change)}). Bars to the right are increases, bars to the left are decreases.`;

    chartEl.hidden = showTable;
    tableEl.hidden = !showTable;
    if (showTable) {
      table(tableEl, `Change in hospitalisations by road user, ${from} to ${to}`, [
        { label: "Road user", value: d => d.user },
        { label: String(from), value: d => fmt(d.before), num: true },
        { label: String(to), value: d => fmt(d.after), num: true },
        { label: "Change", value: d => (d.change >= 0 ? "+" : "") + fmt(d.change), num: true },
        { label: "Change %", value: d => d.rel == null ? "–" : pct(d.rel), num: true }
      ], data);
      return;
    }

    const narrow = chartEl.clientWidth < 560;
    const barH = narrow ? 22 : 26;
    const { g, iw } = frame(chartEl, {
      height: () => data.length * barH + 56,
      margin: { left: narrow ? 140 : 190, right: 56, top: 16, bottom: 32 }
    });
    const ih = data.length * barH;

    const ext = (d3.max(data, d => Math.abs(d.change)) || 1) * 1.2; // room for value labels
    const x = d3.scaleLinear().domain([-ext, ext]).nice().range([0, iw]);
    const y = d3.scaleBand().domain(data.map(d => d.user)).range([0, ih]).padding(0.25);

    g.append("g").attr("class", "grid").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(narrow ? 4 : 6).tickSize(-ih).tickFormat(""));
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).ticks(narrow ? 4 : 6).tickFormat(d3.format("+,")).tickSizeOuter(0))
      .call(s => s.select(".domain").remove());

    // zero line
    g.append("line").attr("class", "zero-line")
      .attr("x1", x(0)).attr("x2", x(0)).attr("y1", -4).attr("y2", ih);

    // road user labels on the left
    g.append("g").selectAll("text").data(data).join("text")
      .attr("class", "cat-label")
      .attr("x", -10).attr("y", d => y(d.user) + y.bandwidth() / 2)
      .attr("dy", "0.35em").attr("text-anchor", "end")
      .text(d => narrow ? (SHORT[d.user] || d.user) : d.user);

    // bars (rounded at the data end only)
    g.append("g").selectAll("path").data(data).join("path")
      .attr("class", d => d.change >= 0 ? "bar bar-up" : "bar bar-down")
      .attr("d", d => hbar(x(0), x(d.change), y(d.user), y.bandwidth(), 4))
      .on("pointermove", (event, d) => showTip(event,
        `<div class="tt-label">${d.user}</div>
         <div class="tt-value">${d.change >= 0 ? "+" : ""}${fmt(d.change)}</div>
         <div class="tt-label">${fmt(d.before)} in ${from} → ${fmt(d.after)} in ${to}${d.rel == null ? "" : ` (${pct(d.rel)})`}</div>`))
      .on("pointerleave", hideTip);

    // value labels at the bar end
    g.append("g").selectAll("text").data(data).join("text")
      .attr("class", "val-label")
      .attr("x", d => x(d.change) + (d.change >= 0 ? 6 : -6))
      .attr("y", d => y(d.user) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => d.change >= 0 ? "start" : "end")
      .text(d => (d.change > 0 ? "+" : "") + fmt(d.change));
  }

  // Horizontal bar path from x0 to x1, rounded only at the outer end
  function hbar(x0, x1, y, h, r) {
    const w = Math.abs(x1 - x0);
    r = Math.min(r, w, h / 2);
    if (x1 >= x0) {
      return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
    }
    return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
  }
})();
