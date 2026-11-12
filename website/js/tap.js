/* tap.js: tooltips on phones and tablets.
   Phones have no hover, so a tap on a chart (line, bar, map, donut slice, heatmap cell)
   now shows the same tooltip you get by hovering on a computer.
   The tooltip stays until you tap somewhere else or scroll.
   Works with every chart on the site without changing the chart code: it turns a tap into the
   "pointermove" the charts already listen for. Load it on every page after d3. */

(function () {
  let lastTarget = null;

  const isTouch = e => e.pointerType === "touch" || e.pointerType === "pen";
  const tooltip = () => document.getElementById("tooltip");

  // Copy the tap as a pointermove, so each chart's own hover code runs
  function replayAsMove(e, target) {
    target.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, cancelable: true, composed: true,
      clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
      pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary
    }));
    keepOnScreen();
  }

  // Close the tooltip and any crosshair: send the last tapped element a normal (mouse) pointerleave
  function close() {
    if (lastTarget) {
      const t = lastTarget; lastTarget = null;
      t.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse", bubbles: false }));
    }
    const tip = tooltip();
    if (tip) tip.hidden = true;
  }

  // Phones are narrow: never let the tooltip run off the left or right edge
  function keepOnScreen() {
    const tip = tooltip();
    if (!tip || tip.hidden) return;
    const max = window.innerWidth - tip.offsetWidth - 8;
    tip.style.left = `${Math.max(8, Math.min(tip.offsetLeft, max))}px`;
  }

  document.addEventListener("pointerdown", e => {
    if (!isTouch(e)) return;
    const onChart = e.target.closest && e.target.closest("svg") && !e.target.closest(".legend-scale");
    if (!onChart) { close(); return; }
    if (lastTarget && lastTarget !== e.target) close();   // closes the old crosshair in another chart
    lastTarget = e.target;
    replayAsMove(e, e.target);
  }, true);

  // A finger lifting off the screen fires "pointerleave", which would hide the tooltip at once.
  // Block those (touch only); mouse hover is untouched.
  window.addEventListener("pointerleave", e => { if (isTouch(e)) e.stopPropagation(); }, true);
  window.addEventListener("pointerout", e => { if (isTouch(e)) e.stopPropagation(); }, true);

  // Scrolling moves the chart away from the tooltip, so close it
  window.addEventListener("scroll", () => { if (lastTarget) close(); }, { passive: true });
})();
