window.Viz = (function () {
  const fmt = d3.format(",");
  const pct = d3.format("+.1%");
  const tooltip = d3.select("#tooltip");

  // Read a colour token from css/style.css so light and dark mode both work
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Create an empty responsive SVG inside a container
  function frame(el, opts = {}) {
    const width = Math.max(300, el.clientWidth);
    const height = opts.height ? opts.height(width) : (width < 500 ? 300 : 360);
    const margin = Object.assign({ top: 24, right: 16, bottom: 32, left: 56 }, opts.margin || {});
    el.innerHTML = "";
    const svg = d3.select(el).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("aria-hidden", "true");
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    return { svg, g, width, height, margin,
      iw: width - margin.left - margin.right,
      ih: height - margin.top - margin.bottom };
  }

  // Tooltip next to the mouse pointer
  function showTip(event, html) {
    tooltip.html(html).attr("hidden", null);
    const node = tooltip.node();
    let left = event.clientX + 14;
    let top = event.clientY - node.offsetHeight - 12;
    if (left + node.offsetWidth > window.innerWidth - 8) left = event.clientX - node.offsetWidth - 14;
    if (top < 8) top = event.clientY + 18;
    tooltip.style("left", `${left}px`).style("top", `${top}px`);
  }
  function hideTip() { tooltip.attr("hidden", true); }

  // Re-run a render function when the window is resized
  function onResize(fn) {
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fn, 150); });
  }

  // Wire a group of segmented buttons (aria-pressed) and call back with data-value
  function segmented(selector, onChange) {
    const buttons = document.querySelectorAll(selector);
    buttons.forEach(btn => btn.addEventListener("click", () => {
      buttons.forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      onChange(btn.dataset.value);
    }));
  }

  // Build an accessible HTML table: columns = [{label, value: d => ..., num: true}]
  function table(el, caption, columns, rows) {
    el.innerHTML = `<table><caption class="chart-note" style="text-align:left">${caption}</caption>
      <thead><tr>${columns.map(c => `<th scope="col"${c.num ? ' class="num"' : ""}>${c.label}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${columns.map(c => `<td${c.num ? ' class="num"' : ""}>${c.value(r)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
  }

  function loadError(el) {
    el.innerHTML = '<p class="chart-note">Could not load the data. Open this page through a local web server (see README), not by double-clicking the file.</p>';
  }

  return { fmt, pct, css, frame, showTip, hideTip, onResize, segmented, table, loadError };
})();
