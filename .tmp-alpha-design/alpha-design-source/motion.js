/* ============================================================
   ALPHA POS — motion layer (JS)
   Robustness: uses setTimeout (fires in hidden/background tabs)
   rather than requestAnimationFrame (paused when hidden) to arm
   and trigger transition-based reveals, so content is never
   stranded invisible.
   ============================================================ */
const { useState, useEffect, useRef } = React;

/* Arm the entrance system as early as possible. Resting state (no
   .anim class) is fully visible, so this is purely additive. */
(function armMotion() {
  try {
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    document.documentElement.classList.add("anim");
    setTimeout(function () { document.documentElement.classList.add("rin"); }, 1200);
  } catch (e) {}
})();

/* Replays the page-level entrance: clears .rin (hides), then re-adds
   it on the next tick to fire the transition. Called on first load
   and on every route change. setTimeout keeps it working when hidden. */
function replayMotion() {
  var html = document.documentElement;
  if (!html.classList.contains("anim")) return;
  html.classList.remove("rin");
  // double timeout guarantees a style flush between hide and show
  setTimeout(function () {
    setTimeout(function () { html.classList.add("rin"); }, 20);
  }, 0);
}

function usePrefersReduced() {
  const [r, setR] = useState(() => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  });
  useEffect(() => {
    let m;
    try { m = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch (e) { return; }
    const h = () => setR(m.matches);
    if (m.addEventListener) m.addEventListener("change", h); else if (m.addListener) m.addListener(h);
    return () => { if (m.removeEventListener) m.removeEventListener("change", h); else if (m.removeListener) m.removeListener(h); };
  }, []);
  return r;
}

/* Mount flag toggled via setTimeout (NOT rAF, which is paused when
   the tab is hidden). Charts use this to trigger transition reveals. */
function useShown(delay) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), delay || 30);
    return () => clearTimeout(t);
  }, []);
  return shown;
}

/* Counts a number from 0 → target with ease-out-cubic. Guards against
   hidden tabs (rAF paused) by showing the target immediately when the
   document is hidden, so a KPI never gets stuck reading 0. */
function useCountUp(target, opts) {
  opts = opts || {};
  const duration = opts.duration || 900;
  const reduced = usePrefersReduced();
  const [val, setVal] = useState(target);
  const prev = useRef(0);

  useEffect(() => {
    if (reduced || typeof target !== "number" || !isFinite(target) || (typeof document !== "undefined" && document.hidden)) {
      setVal(target); prev.current = typeof target === "number" ? target : 0; return;
    }
    const from = prev.current || 0;
    setVal(from);
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { prev.current = target; setVal(target); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, duration]);

  return val;
}

function CountUp(props) {
  const v = useCountUp(props.value, { duration: props.duration });
  return props.format ? props.format(v) : Math.round(v);
}

Object.assign(window, { replayMotion, usePrefersReduced, useShown, useCountUp, CountUp });
