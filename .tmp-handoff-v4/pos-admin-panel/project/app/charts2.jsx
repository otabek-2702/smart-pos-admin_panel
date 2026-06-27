/* ============================================================
   ALPHA POS — advanced chart library (charts2)
   Hand-built SVG, design-token colors, transition-based reveal
   (degrades gracefully in hidden tabs), hover tooltips.
   Exposes: Gauge, Sparkline, StackedBar, GroupedBar, Heatmap,
   Treemap, Radar, Funnel, Bullet, Scatter, ComboPareto,
   ProgressRing, MiniDonut.
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

/* shared tooltip (reuses .charttip styles) */
function useTip() {
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, title: "", rows: [] });
  const show = (e, title, rows) => setTip({ show: true, x: e.clientX, y: e.clientY, title, rows });
  const move = (e) => setTip((t) => (t.show ? Object.assign({}, t, { x: e.clientX, y: e.clientY }) : t));
  const hide = () => setTip((t) => Object.assign({}, t, { show: false }));
  return [tip, show, move, hide];
}
function Tip(props) {
  if (!props.tip.show) return null;
  return (
    <div className="charttip" style={{ left: props.tip.x, top: props.tip.y }}>
      {props.tip.title && <div className="charttip__t">{props.tip.title}</div>}
      {props.tip.rows.map((r, i) => (
        <div className="charttip__row" key={i}>
          {r.color && <span className="legend-swatch" style={{ background: r.color }} />}
          <span>{r.label}</span><span className="charttip__v">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function useShown2(delay) {
  const [s, setS] = useState(() => (typeof document !== "undefined" && document.hidden));
  useEffect(() => {
    if (s) return;
    const t = setTimeout(() => setS(true), delay || 60);
    return () => clearTimeout(t);
  }, []);
  return s;
}
function useBox() {
  const ref = useRef(null); const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current); setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
function niceTop(max, n) {
  if (max <= 0) return { top: 1, step: 1, ticks: [0, 1] };
  const raw = max / (n || 4), mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
  let step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  step *= mag; const top = Math.ceil(max / step) * step; const ticks = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);
  return { top, step, ticks };
}

/* ===================== Radial Gauge ===================== */
function Gauge(props) {
  const shown = useShown2(80);
  const size = props.size || 200;
  const value = props.value || 0, max = props.max || 100;
  const pct = Math.max(0, Math.min(1, value / max));
  const stroke = props.stroke || 16;
  const r = (size - stroke) / 2 - 6;
  const cx = size / 2, cy = size / 2;
  const startA = Math.PI * 0.75, endA = Math.PI * 2.25; // 270° arc
  const sweep = endA - startA;
  const polar = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const arcPath = (a0, a1) => {
    const [x0, y0] = polar(a0), [x1, y1] = polar(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return "M" + x0 + " " + y0 + " A" + r + " " + r + " 0 " + large + " 1 " + x1 + " " + y1;
  };
  const valA = startA + sweep * (shown ? pct : 0);
  const color = props.color || "var(--primary)";
  return (
    <div style={{ position: "relative", width: size, height: size * 0.82, margin: "0 auto" }}>
      <svg width={size} height={size * 0.92} viewBox={"0 0 " + size + " " + (size * 0.92)}>
        <path d={arcPath(startA, endA)} fill="none" stroke="var(--chart-track)" strokeWidth={stroke} strokeLinecap="round" />
        <path d={arcPath(startA, valA)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          style={{ transition: "all 1s cubic-bezier(.2,.8,.2,1)" }} />
        <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700" fontSize={size * 0.17} fill="var(--text)" letterSpacing="-0.02em">
          {props.centerValue || (Math.round(pct * 100) + "%")}
        </text>
        <text x={cx} y={cy + size * 0.12} textAnchor="middle" fontSize={size * 0.066} fontWeight="600" fill="var(--text-secondary)">{props.label || ""}</text>
      </svg>
      {props.footer && <div style={{ textAlign: "center", marginTop: -6, fontSize: 13, color: "var(--text-tertiary)" }}>{props.footer}</div>}
    </div>
  );
}

/* ===================== Sparkline (tiny inline) ===================== */
function Sparkline(props) {
  const shown = useShown2(props.delay || 60);
  const w = props.width || 120, h = props.height || 34;
  const data = props.data || [];
  if (!data.length) return <svg width={w} height={h} />;
  const min = Math.min.apply(null, data), max = Math.max.apply(null, data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [ (i / (data.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / span) * (h - 6) ]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + " L" + pts[pts.length - 1][0] + " " + h + " L" + pts[0][0] + " " + h + " Z";
  const color = props.color || "var(--chart-revenue)";
  const id = useMemo(() => "spk" + Math.random().toString(36).slice(2, 7), []);
  const up = data[data.length - 1] >= data[0];
  const c = props.colorByTrend ? (up ? "var(--success)" : "var(--error)") : color;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={c} stopOpacity="0.22" /><stop offset="100%" stopColor={c} stopOpacity="0" />
      </linearGradient></defs>
      {props.fill !== false && <path d={area} fill={"url(#" + id + ")"} style={{ opacity: shown ? 1 : 0, transition: "opacity .6s ease .2s" }} />}
      <path className="spark-line" pathLength="1" d={line} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        style={{ strokeDasharray: 1, strokeDashoffset: shown ? 0 : 1, transition: "stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)" }} />
      {props.dot !== false && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={c} style={{ opacity: shown ? 1 : 0, transition: "opacity .3s ease .8s" }} />}
    </svg>
  );
}

/* ===================== Stacked / Grouped bars ===================== */
function StackedBar(props) {
  const [ref, w] = useBox();
  const shown = useShown2(80);
  const [tip, show, move, hide] = useTip();
  const [hidden, setHidden] = useState({});
  const h = props.height || 280;
  const data = props.data || [];          // [{label, values:{k:v}}]
  const series = (props.series || []).filter((s) => !hidden[s.key]); // [{key,label,color}]
  const grouped = props.grouped;
  if (!data.length) return <div ref={ref}><StateFill icon="chart" title="No data" style={{ height: h }} /></div>;
  const padL = 46, padR = 12, padT = 14, padB = 30;
  const iw = Math.max(10, w - padL - padR), ih = h - padT - padB;
  const totals = data.map((d) => series.reduce((a, s) => a + (d.values[s.key] || 0), 0));
  const maxStack = grouped
    ? Math.max(1, ...data.map((d) => Math.max(...series.map((s) => d.values[s.key] || 0))))
    : Math.max(1, ...totals);
  const { top, ticks } = niceTop(maxStack, 4);
  const band = iw / data.length;
  const y = (v) => padT + ih - (v / top) * ih;
  const fmt = props.yFormat || Fmt.abbr;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg width={w} height={h} style={{ display: "block" }} onMouseLeave={hide}>
        {ticks.map((t, i) => (<g key={i}>
          <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--chart-axis)" fontFamily="var(--font-mono)">{fmt(t)}</text>
        </g>))}
        {data.map((d, i) => {
          const bx = padL + band * i;
          if (grouped) {
            const gw = band * 0.7, bw = gw / series.length;
            return <g key={i}>
              {series.map((s, si) => {
                const v = d.values[s.key] || 0, bh = (v / top) * ih;
                return <rect key={s.key} x={bx + (band - gw) / 2 + si * bw + 1} y={y(v)} width={bw - 2} height={Math.max(bh, 0)} rx="3" fill={s.color}
                  style={{ transformBox: "fill-box", transformOrigin: "bottom", transform: shown ? "scaleY(1)" : "scaleY(0)", transition: "transform .6s cubic-bezier(.2,.8,.2,1) " + (i * 0.03) + "s" }}
                  onMouseEnter={(e) => show(e, d.label, [{ color: s.color, label: s.label, value: Fmt.num(v) }])} onMouseMove={move} />;
              })}
              <text x={bx + band / 2} y={h - 10} textAnchor="middle" fontSize="11" fill="var(--chart-axis)">{d.label}</text>
            </g>;
          }
          let acc = 0; const bw = Math.min(band * 0.6, 46);
          return <g key={i}>
            {series.map((s) => {
              const v = d.values[s.key] || 0; const bh = (v / top) * ih; const yTop = y(acc + v); acc += v;
              return <rect key={s.key} x={bx + (band - bw) / 2} y={yTop} width={bw} height={Math.max(bh, 0)} fill={s.color}
                style={{ transformBox: "fill-box", transformOrigin: "bottom", transform: shown ? "scaleY(1)" : "scaleY(0)", transition: "transform .6s cubic-bezier(.2,.8,.2,1) " + (i * 0.03) + "s" }}
                onMouseEnter={(e) => show(e, d.label, series.map((ss) => ({ color: ss.color, label: ss.label, value: Fmt.num(d.values[ss.key] || 0) })))} onMouseMove={move} />;
            })}
            <text x={bx + band / 2} y={h - 10} textAnchor="middle" fontSize="11" fill="var(--chart-axis)">{d.label}</text>
          </g>;
        })}
      </svg>
      {props.series && (
        <div className="chart-legend" style={{ marginTop: 12, justifyContent: "center" }}>
          {props.series.map((s) => (
            <button key={s.key} className="legend-item" style={{ border: "none", background: "none", cursor: "pointer", opacity: hidden[s.key] ? 0.4 : 1 }}
              onClick={() => setHidden((h) => Object.assign({}, h, { [s.key]: !h[s.key] }))}>
              <span className="legend-swatch" style={{ background: s.color }} />{s.label}
            </button>
          ))}
        </div>
      )}
      <Tip tip={tip} />
    </div>
  );
}

/* ===================== Heatmap (hour × day) ===================== */
function Heatmap(props) {
  const [ref, w] = useBox();
  const shown = useShown2(80);
  const [tip, show, move, hide] = useTip();
  const rows = props.rows || [];        // row labels (e.g. days)
  const cols = props.cols || [];        // col labels (e.g. hours)
  const matrix = props.matrix || [];    // matrix[r][c] = value
  if (!rows.length || !cols.length) return <div ref={ref}><StateFill icon="chart" title="No data" /></div>;
  const labelW = 42, gap = 3, padT = 22;
  const cw = Math.max(8, (w - labelW - gap * (cols.length - 1)) / cols.length);
  const ch = Math.min(cw, 30);
  const max = Math.max(1, ...matrix.flat());
  const base = props.color || "58, 91, 219"; // rgb of primary
  const h = padT + rows.length * (ch + gap);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg width={w} height={h} style={{ display: "block" }} onMouseLeave={hide}>
        {cols.map((c, ci) => (ci % (cols.length > 16 ? 2 : 1) === 0) &&
          <text key={ci} x={labelW + ci * (cw + gap) + cw / 2} y={14} textAnchor="middle" fontSize="10" fill="var(--chart-axis)">{c}</text>)}
        {rows.map((rLab, ri) => (
          <g key={ri}>
            <text x={labelW - 8} y={padT + ri * (ch + gap) + ch / 2 + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--text-secondary)">{rLab}</text>
            {cols.map((cLab, ci) => {
              const v = (matrix[ri] && matrix[ri][ci]) || 0;
              const t = v / max;
              const op = v === 0 ? 0.04 : 0.12 + t * 0.88;
              return <rect key={ci} x={labelW + ci * (cw + gap)} y={padT + ri * (ch + gap)} width={cw} height={ch} rx="4"
                fill={"rgba(" + base + ", " + op + ")"}
                style={{ opacity: shown ? 1 : 0, transition: "opacity .5s ease " + ((ri + ci) * 0.012) + "s", cursor: "default" }}
                onMouseEnter={(e) => show(e, rLab + " · " + cLab, [{ color: "var(--primary)", label: props.unit || "Value", value: Fmt.num(v) }])} onMouseMove={move} />;
            })}
          </g>
        ))}
      </svg>
      {props.scale !== false && (
        <div className="row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 10, fontSize: 11, color: "var(--text-tertiary)" }}>
          <span>Less</span>
          {[0.08, 0.3, 0.55, 0.8, 1].map((o, i) => <span key={i} style={{ width: 16, height: 12, borderRadius: 3, background: "rgba(" + base + "," + o + ")" }} />)}
          <span>More</span>
        </div>
      )}
      <Tip tip={tip} />
    </div>
  );
}

/* ===================== Treemap (squarified-ish) ===================== */
function Treemap(props) {
  const [ref, w] = useBox();
  const shown = useShown2(80);
  const [tip, show, move, hide] = useTip();
  const h = props.height || 300;
  const data = (props.data || []).slice().sort((a, b) => b.value - a.value);
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  // simple row-based slice/dice
  const rects = useMemo(() => {
    if (!w) return [];
    const out = []; let x = 0, y = 0, rowH; let remaining = data.slice(); let availW = w, availH = h;
    // alternate: split into rows of ~equal area chunks
    let i = 0; const cols = Math.ceil(Math.sqrt(data.length));
    // pack greedily into horizontal strips
    let idx = 0;
    while (idx < data.length) {
      const rowItems = data.slice(idx, idx + cols);
      const rowVal = rowItems.reduce((a, b) => a + b.value, 0);
      rowH = (rowVal / total) * h;
      let rx = 0;
      rowItems.forEach((d) => {
        const rw = (d.value / rowVal) * w;
        out.push({ d, x: rx, y, w: rw, h: rowH });
        rx += rw;
      });
      y += rowH; idx += cols;
    }
    return out;
  }, [w, data, total, h]);
  const palette = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--primary-hover)"];
  if (!data.length) return <div ref={ref}><StateFill icon="chart" title="No data" style={{ height: h }} /></div>;
  return (
    <div ref={ref} style={{ position: "relative", height: h }}>
      <svg width={w} height={h} onMouseLeave={hide}>
        {rects.map((r, i) => {
          const color = r.d.color || palette[i % palette.length];
          const big = r.w > 64 && r.h > 38;
          return <g key={i} style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : "scale(.92)", transformBox: "fill-box", transformOrigin: "center", transition: "opacity .5s ease " + (i * 0.04) + "s, transform .5s cubic-bezier(.2,.8,.2,1) " + (i * 0.04) + "s" }}
            onMouseEnter={(e) => show(e, r.d.label, [{ color, label: "Revenue", value: Fmt.money(r.d.value) + " (" + Math.round(r.d.value / total * 100) + "%)" }])} onMouseMove={move}>
            <rect x={r.x + 2} y={r.y + 2} width={Math.max(0, r.w - 4)} height={Math.max(0, r.h - 4)} rx="8" fill={color} />
            {big && <text x={r.x + 12} y={r.y + 24} fontSize="13" fontWeight="700" fill="#fff">{r.d.label}</text>}
            {big && <text x={r.x + 12} y={r.y + 42} fontSize="12" fontFamily="var(--font-mono)" fill="rgba(255,255,255,.85)">{Fmt.abbr(r.d.value)}</text>}
          </g>;
        })}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/* ===================== Radar ===================== */
function Radar(props) {
  const shown = useShown2(80);
  const [tip, show, move, hide] = useTip();
  const size = props.size || 280;
  const axes = props.axes || [];        // [label]
  const series = props.series || [];    // [{label,color,values:[]}]
  const cx = size / 2, cy = size / 2, R = size / 2 - 38;
  const n = axes.length;
  if (!n) return <StateFill icon="chart" title="No data" />;
  const max = props.max || 100;
  const ang = (i) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const pt = (i, val) => [cx + R * (val / max) * Math.cos(ang(i)), cy + R * (val / max) * Math.sin(ang(i))];
  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <div style={{ position: "relative", width: size, margin: "0 auto" }} onMouseLeave={hide}>
      <svg width={size} height={size}>
        {rings.map((r, i) => (
          <polygon key={i} points={axes.map((_, ai) => { const p = pt(ai, max * r); return p[0] + "," + p[1]; }).join(" ")}
            fill="none" stroke="var(--chart-grid)" strokeWidth="1" />
        ))}
        {axes.map((_, ai) => { const p = pt(ai, max); return <line key={ai} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="var(--chart-grid)" />; })}
        {axes.map((lab, ai) => { const p = pt(ai, max * 1.16); return <text key={ai} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="600" fill="var(--text-secondary)">{lab}</text>; })}
        {series.map((s, si) => {
          const poly = axes.map((_, ai) => { const p = pt(ai, shown ? s.values[ai] : 0); return p[0] + "," + p[1]; }).join(" ");
          return <g key={si} style={{ transition: "all .8s cubic-bezier(.2,.8,.2,1)" }}>
            <polygon points={poly} fill={s.color} fillOpacity="0.16" stroke={s.color} strokeWidth="2" style={{ transition: "all .8s cubic-bezier(.2,.8,.2,1)" }} />
            {axes.map((_, ai) => { const p = pt(ai, shown ? s.values[ai] : 0); return <circle key={ai} cx={p[0]} cy={p[1]} r="3.5" fill="var(--surface)" stroke={s.color} strokeWidth="2"
              onMouseEnter={(e) => show(e, axes[ai], [{ color: s.color, label: s.label, value: s.values[ai] }])} onMouseMove={move} />; })}
          </g>;
        })}
      </svg>
      {series.length > 1 && <div className="chart-legend" style={{ justifyContent: "center", marginTop: 4 }}>
        {series.map((s) => <span key={s.label} className="legend-item"><span className="legend-swatch" style={{ background: s.color }} />{s.label}</span>)}
      </div>}
      <Tip tip={tip} />
    </div>
  );
}

/* ===================== Funnel ===================== */
function Funnel(props) {
  const shown = useShown2(80);
  const data = props.data || [];   // [{label, value, color}]
  if (!data.length) return <StateFill icon="chart" title="No data" />;
  const max = Math.max.apply(null, data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => {
        const pct = d.value / max;
        const conv = i === 0 ? 100 : Math.round(d.value / data[0].value * 100);
        return (
          <div key={i} style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : "translateX(-8px)", transition: "all .5s cubic-bezier(.2,.8,.2,1) " + (i * 0.08) + "s" }}>
            <div className="row between" style={{ marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</span>
              <span className="row" style={{ gap: 8 }}><span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{Fmt.num(d.value)}</span><span className="badge t-neutral">{conv}%</span></span>
            </div>
            <div style={{ height: 30, background: "var(--chart-track)", borderRadius: var_r(), overflow: "hidden" }}>
              <div style={{ width: (shown ? pct * 100 : 0) + "%", height: "100%", background: d.color || "var(--primary)", borderRadius: var_r(), transition: "width .7s cubic-bezier(.2,.8,.2,1) " + (i * 0.08) + "s", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
function var_r() { return "8px"; }

/* ===================== Bullet (target vs actual) ===================== */
function Bullet(props) {
  const shown = useShown2(80);
  const items = props.items || [];  // [{label, value, target, max, color}]
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((it, i) => {
        const max = it.max || Math.max(it.value, it.target) * 1.25;
        const vp = Math.min(100, it.value / max * 100), tp = Math.min(100, it.target / max * 100);
        const hit = it.value >= it.target;
        return (
          <div key={i}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{it.label}</span>
              <span className="row" style={{ gap: 8, fontSize: 12 }}>
                <span className="mono" style={{ fontWeight: 700 }}>{Fmt.abbr(it.value)}</span>
                <span className="tertiary mono">/ {Fmt.abbr(it.target)}</span>
                <span className={cx("badge", hit ? "t-success" : "t-warning")}>{Math.round(it.value / it.target * 100)}%</span>
              </span>
            </div>
            <div style={{ position: "relative", height: 14, background: "var(--chart-track)", borderRadius: 99 }}>
              <div style={{ position: "absolute", inset: 0, width: (shown ? vp : 0) + "%", background: it.color || (hit ? "var(--success)" : "var(--primary)"), borderRadius: 99, transition: "width .7s cubic-bezier(.2,.8,.2,1) " + (i * 0.05) + "s" }} />
              <div style={{ position: "absolute", top: -3, bottom: -3, left: tp + "%", width: 3, borderRadius: 2, background: "var(--text)", opacity: .55 }} title="Target" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== Scatter / Bubble ===================== */
function Scatter(props) {
  const [ref, w] = useBox();
  const shown = useShown2(80);
  const [tip, show, move, hide] = useTip();
  const h = props.height || 300;
  const data = props.data || [];   // [{x,y,r,label,color}]
  if (!data.length) return <div ref={ref}><StateFill icon="chart" title="No data" style={{ height: h }} /></div>;
  const padL = 50, padR = 16, padT = 14, padB = 36;
  const iw = Math.max(10, w - padL - padR), ih = h - padT - padB;
  const maxX = Math.max.apply(null, data.map((d) => d.x)), maxY = Math.max.apply(null, data.map((d) => d.y));
  const nx = niceTop(maxX, 4), ny = niceTop(maxY, 4);
  const X = (v) => padL + (v / nx.top) * iw, Y = (v) => padT + ih - (v / ny.top) * ih;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg width={w} height={h} onMouseLeave={hide}>
        {ny.ticks.map((t, i) => <g key={i}>
          <line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} stroke="var(--chart-grid)" />
          <text x={padL - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--chart-axis)" fontFamily="var(--font-mono)">{(props.yFormat || Fmt.abbr)(t)}</text>
        </g>)}
        {nx.ticks.map((t, i) => <text key={i} x={X(t)} y={h - 12} textAnchor="middle" fontSize="11" fill="var(--chart-axis)" fontFamily="var(--font-mono)">{(props.xFormat || Fmt.abbr)(t)}</text>)}
        {props.xLabel && <text x={padL + iw / 2} y={h - 0} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text-tertiary)">{props.xLabel}</text>}
        {data.map((d, i) => (
          <circle key={i} cx={X(d.x)} cy={Y(d.y)} r={shown ? (d.r || 8) : 0} fill={d.color || "var(--primary)"} fillOpacity="0.7" stroke={d.color || "var(--primary)"} strokeWidth="1.5"
            style={{ transition: "r .5s cubic-bezier(.2,.8,.2,1) " + (i * 0.05) + "s", cursor: "default" }}
            onMouseEnter={(e) => show(e, d.label, [{ color: d.color, label: props.xLabel || "X", value: Fmt.num(d.x) }, { color: d.color, label: props.yLabel || "Y", value: Fmt.num(d.y) }])} onMouseMove={move} />
        ))}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/* ===================== Combo: bars + cumulative line (Pareto) ===================== */
function ComboPareto(props) {
  const [ref, w] = useBox();
  const shown = useShown2(80);
  const [tip, show, move, hide] = useTip();
  const h = props.height || 300;
  const data = (props.data || []).slice().sort((a, b) => b.value - a.value);
  if (!data.length) return <div ref={ref}><StateFill icon="chart" title="No data" style={{ height: h }} /></div>;
  const padL = 48, padR = 46, padT = 16, padB = 46;
  const iw = Math.max(10, w - padL - padR), ih = h - padT - padB;
  const total = data.reduce((a, b) => a + b.value, 0);
  const maxV = Math.max.apply(null, data.map((d) => d.value));
  const { top, ticks } = niceTop(maxV, 4);
  const band = iw / data.length, bw = Math.min(band * 0.6, 44);
  const y = (v) => padT + ih - (v / top) * ih;
  const yC = (p) => padT + ih - (p / 100) * ih;
  let acc = 0; const cum = data.map((d) => { acc += d.value; return acc / total * 100; });
  const linePts = cum.map((p, i) => [padL + band * i + band / 2, yC(shown ? p : 0)]);
  const line = linePts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg width={w} height={h} onMouseLeave={hide}>
        {ticks.map((t, i) => <g key={i}>
          <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--chart-axis)" fontFamily="var(--font-mono)">{Fmt.abbr(t)}</text>
        </g>)}
        {[0, 25, 50, 75, 100].map((p, i) => <text key={i} x={w - padR + 8} y={yC(p) + 4} fontSize="10" fill="var(--chart-axis)" fontFamily="var(--font-mono)">{p}%</text>)}
        {data.map((d, i) => {
          const bh = (d.value / top) * ih; const bx = padL + band * i + (band - bw) / 2;
          return <g key={i}>
            <rect x={bx} y={y(d.value)} width={bw} height={Math.max(bh, 0)} rx="4" fill={i === 0 ? "var(--chart-revenue)" : "var(--c4)"}
              style={{ transformBox: "fill-box", transformOrigin: "bottom", transform: shown ? "scaleY(1)" : "scaleY(0)", transition: "transform .6s cubic-bezier(.2,.8,.2,1) " + (i * 0.04) + "s" }}
              onMouseEnter={(e) => show(e, d.label, [{ color: "var(--chart-revenue)", label: "Value", value: Fmt.money(d.value) }, { color: "var(--chart-expense)", label: "Cumulative", value: Math.round(cum[i]) + "%" }])} onMouseMove={move} />
            <text x={bx + bw / 2} y={h - 26} textAnchor="middle" fontSize="10" fill="var(--chart-axis)" transform={data.length > 6 ? "rotate(0)" : ""}>{d.label.length > 9 ? d.label.slice(0, 8) + "…" : d.label}</text>
          </g>;
        })}
        <path d={line} fill="none" stroke="var(--chart-expense)" strokeWidth="2.5" strokeLinejoin="round"
          style={{ strokeDasharray: 1, strokeDashoffset: shown ? 0 : 1, transition: "stroke-dashoffset 1s ease .3s" }} pathLength="1" />
        {linePts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="var(--surface)" stroke="var(--chart-expense)" strokeWidth="2" style={{ opacity: shown ? 1 : 0, transition: "opacity .3s ease " + (0.4 + i * 0.05) + "s" }} />)}
      </svg>
      <Tip tip={tip} />
    </div>
  );
}

/* ===================== Progress ring (compact) ===================== */
function ProgressRing(props) {
  const shown = useShown2(80);
  const size = props.size || 92, stroke = props.stroke || 9;
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, (props.value || 0) / (props.max || 100)));
  const color = props.color || "var(--primary)";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart-track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={shown ? c * (1 - pct) : c} style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", flexDirection: "column" }}>
        <span className="mono" style={{ fontWeight: 700, fontSize: size * 0.2, lineHeight: 1 }}>{props.centerValue || Math.round(pct * 100) + "%"}</span>
      </div>
    </div>
  );
}

Object.assign(window, { Gauge, Sparkline, StackedBar, Heatmap, Treemap, Radar, Funnel, Bullet, Scatter, ComboPareto, ProgressRing, useTip, Tip });

/* ===================== Top-products toggle chart =====================
   Switch metric (Revenue / Units) — re-sorts and re-renders the bars. */
function TopProductsChart(props) {
  const [metric, setMetric] = useState("value");
  const data = (props.data || []).map((d) => ({
    name: d.name, value: metric === "value" ? d.value : (d.units || 0), _rev: d.value, _units: d.units,
  })).sort((a, b) => b.value - a.value);
  const fmt = metric === "value" ? Fmt.abbr : ((v) => String(Math.round(v)) + " pcs");
  return (
    <div>
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 14 }}>
        <div className="seg">
          <button className={cx("seg__btn", metric === "value" && "is-active")} onClick={() => setMetric("value")}><Icon name="wallet" size={14} />Revenue</button>
          <button className={cx("seg__btn", metric === "units" && "is-active")} onClick={() => setMetric("units")}><Icon name="bars" size={14} />Units</button>
        </div>
      </div>
      <HBarChart data={data} valueFormat={fmt} loading={props.loading} />
    </div>
  );
}

Object.assign(window, { TopProductsChart });
