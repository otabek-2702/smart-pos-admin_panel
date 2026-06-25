/* ============================================================
   ALPHA POS — SVG charts (no external lib)
   line/area · vertical bar · horizontal bar · donut
   each with loading (skeleton), empty, and hover/tooltip states
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;


function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

let _tipId = 0;
function ChartTip(props) {
  if (!props.show) return null;
  return (
    <div className="charttip" style={{ left: props.x, top: props.y }}>
      {props.title && <div className="charttip__t">{props.title}</div>}
      {props.rows.map((r, i) => (
        <div className="charttip__row" key={i}>
          {r.color && <span className="legend-swatch" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="charttip__v">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function niceTicks(max, count) {
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step;
  if (norm <= 1) step = 1; else if (norm <= 2) step = 2; else if (norm <= 2.5) step = 2.5; else if (norm <= 5) step = 5; else step = 10;
  step *= mag;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);
  return { ticks, top };
}

/* ---------------- Line / Area ---------------- */
function LineAreaChart(props) {
  const [ref, w] = useWidth();
  const shown = useShown(140);
  const [hover, setHover] = useState(null);
  const [tip, setTip] = useState({ show: false });
  const id = useMemo(() => "g" + (++_tipId), []);
  const height = props.height || 240;
  const series = props.series || [];
  const cats = props.categories || [];
  const yfmt = props.yFormat || Fmt.abbr;

  if (props.loading) return <div ref={ref} style={{ height }}><Skeleton h={height} r={10} /></div>;
  if (!series.length || !cats.length) return <div ref={ref}><StateFill icon="chart" title="No data for this range" sub="Try a different date range." style={{ height }} /></div>;

  const padL = 52, padR = 16, padT = 16, padB = 28;
  const iw = Math.max(10, w - padL - padR);
  const ih = height - padT - padB;
  let maxV = 0;
  series.forEach((s) => s.data.forEach((v) => { if (v > maxV) maxV = v; }));
  if (props.target) maxV = Math.max(maxV, props.target);
  const { ticks, top } = niceTicks(maxV || 1, 4);
  const x = (i) => padL + (cats.length === 1 ? iw / 2 : (i / (cats.length - 1)) * iw);
  const y = (v) => padT + ih - (v / top) * ih;

  const labelEvery = Math.ceil(cats.length / 7);

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseLeave={() => { setHover(null); setTip({ show: false }); }}>
      <svg width={w} height={height} style={{ display: "block" }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={series[0].color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={series[0].color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--chart-axis)" fontFamily="var(--font-mono)">{yfmt(t)}</text>
          </g>
        ))}
        {props.target && (
          <g>
            <line x1={padL} x2={w - padR} y1={y(props.target)} y2={y(props.target)} stroke="var(--chart-target)" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={w - padR} y={y(props.target) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--chart-target)">Target {yfmt(props.target)}</text>
          </g>
        )}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => [x(i), y(v)]);
          const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
          const area = line + " L" + x(cats.length - 1) + " " + (padT + ih) + " L" + x(0) + " " + (padT + ih) + " Z";
          return (
            <g key={si}>
              {si === 0 && <path className="spark-area" d={area} fill={"url(#" + id + ")"} />}
              <path className={s.dashed ? "" : "spark-line"} pathLength={s.dashed ? undefined : 1} d={line} fill="none" stroke={s.color} strokeWidth={s.key === "expense" ? 2 : 2.5} strokeDasharray={s.dashed ? "5 4" : 1} strokeDashoffset={s.dashed ? undefined : (shown ? 0 : 1)} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="var(--border-strong)" strokeWidth="1" />}
        {hover !== null && series.map((s, si) => (
          <circle key={si} cx={x(hover)} cy={y(s.data[hover])} r="4.5" fill="var(--surface)" stroke={s.color} strokeWidth="2.5" />
        ))}
        {cats.map((c, i) => (
          (i % labelEvery === 0 || i === cats.length - 1) &&
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--chart-axis)">{c}</text>
        ))}
        {cats.map((c, i) => (
          <rect key={"h" + i} x={x(i) - (iw / cats.length) / 2} y={padT} width={iw / cats.length} height={ih} fill="transparent"
            onMouseEnter={(e) => {
              setHover(i);
              setTip({ show: true, x: e.clientX, y: y(series[0].data[i]) + (ref.current ? ref.current.getBoundingClientRect().top - padT : 0) });
            }}
            onMouseMove={(e) => setTip((t) => Object.assign({}, t, { x: e.clientX, y: e.clientY }))} />
        ))}
      </svg>
      <ChartTip show={tip.show} x={tip.x} y={tip.y}
        title={hover !== null ? cats[hover] : ""}
        rows={hover !== null ? series.map((s) => ({ color: s.color, label: s.label, value: (props.unit ? "" : "") + Fmt.num(s.data[hover]) })) : []} />
    </div>
  );
}

/* ---------------- Vertical bars ---------------- */
function BarChart(props) {
  const [ref, w] = useWidth();
  const shown = useShown(120);
  const [hover, setHover] = useState(null);
  const [tip, setTip] = useState({ show: false });
  const height = props.height || 240;
  const data = props.data || [];
  const yfmt = props.yFormat || Fmt.abbr;

  if (props.loading) return <div ref={ref} style={{ height }}><Skeleton h={height} r={10} /></div>;
  if (!data.length) return <div ref={ref}><StateFill icon="chart" title="No data for this range" style={{ height }} /></div>;

  const padL = 44, padR = 12, padT = 14, padB = 28;
  const iw = Math.max(10, w - padL - padR);
  const ih = height - padT - padB;
  const maxV = Math.max.apply(null, data.map((d) => d.value));
  const { ticks, top } = niceTicks(maxV || 1, 4);
  const band = iw / data.length;
  const bw = Math.min(band * 0.62, 40);
  const y = (v) => padT + ih - (v / top) * ih;

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseLeave={() => { setHover(null); setTip({ show: false }); }}>
      <svg width={w} height={height} style={{ display: "block" }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padL - 9} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--chart-axis)" fontFamily="var(--font-mono)">{yfmt(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const bx = padL + band * i + (band - bw) / 2;
          const bh = (d.value / top) * ih;
          const active = hover === i;
          const fill = d.peak ? "var(--chart-revenue)" : active ? "var(--primary-hover)" : "var(--c4)";
          return (
            <g key={i}>
              <rect className="bar-rise" x={bx} y={y(d.value)} width={bw} height={Math.max(bh, 1)} rx="4" fill={fill} opacity={hover !== null && !active && !d.peak ? 0.55 : 1} style={{ transition: "opacity .12s ease, transform .6s cubic-bezier(.2,.8,.2,1)", transform: shown ? "scaleY(1)" : "scaleY(0)", transitionDelay: (0.04 + i * 0.03) + "s" }} />
              {d.peak && <text x={bx + bw / 2} y={y(d.value) - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--chart-revenue)">{d.value}</text>}
              <text x={bx + bw / 2} y={height - 9} textAnchor="middle" fontSize="11" fill="var(--chart-axis)">{d.label}</text>
              <rect x={padL + band * i} y={padT} width={band} height={ih} fill="transparent"
                onMouseEnter={(e) => { setHover(i); setTip({ show: true, x: e.clientX, y: e.clientY }); }}
                onMouseMove={(e) => setTip({ show: true, x: e.clientX, y: e.clientY })} />
            </g>
          );
        })}
      </svg>
      <ChartTip show={tip.show} x={tip.x} y={tip.y}
        title={hover !== null ? data[hover].label : ""}
        rows={hover !== null ? [{ color: "var(--chart-revenue)", label: props.valueLabel || "Orders", value: Fmt.num(data[hover].value) }] : []} />
    </div>
  );
}

/* ---------------- Horizontal bars (direct labels) ---------------- */
function HBarChart(props) {
  const [hover, setHover] = useState(null);
  const shown = useShown(140);
  const data = props.data || [];
  const fmt = props.valueFormat || Fmt.abbr;
  if (props.loading) return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={26} />)}</div>;
  if (!data.length) return <StateFill icon="chart" title="No data for this range" />;
  const maxV = Math.max.apply(null, data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.map((d, i) => {
        const pct = (d.value / maxV) * 100;
        const leader = i === 0;
        return (
          <div key={i} className="hbar-row" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 500, fontSize: "var(--fs-sm)", display: "flex", alignItems: "center", gap: 7 }}>
                {leader && <Icon name="star" size={14} style={{ color: "var(--warning)" }} />}{d.name}
                {d.units !== undefined && <span className="tertiary" style={{ fontSize: "var(--fs-label)" }}>· {d.units} units</span>}
              </span>
              <span className="mono" style={{ fontWeight: 700, fontSize: "var(--fs-sm)" }}>{fmt(d.value)}</span>
            </div>
            <div style={{ height: 10, borderRadius: 99, background: "var(--chart-track)", overflow: "hidden" }}>
              <div style={{ width: (shown ? pct : 0) + "%", height: "100%", borderRadius: 99, background: leader ? "var(--chart-revenue)" : "var(--c4)", opacity: hover !== null && hover !== i ? 0.6 : 1, transition: "width .55s cubic-bezier(.2,.8,.3,1) " + (0.05 + i * 0.06) + "s, opacity .12s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Donut ---------------- */
function DonutChart(props) {
  const [hover, setHover] = useState(null);
  const shown = useShown(120);
  const [tip, setTip] = useState({ show: false });
  const size = props.size || 200;
  const data = props.data || [];
  if (props.loading) return <div style={{ height: size, display: "grid", placeItems: "center" }}><Skeleton w={size} h={size} style={{ borderRadius: "50%" }} /></div>;
  if (!data.length || data.every((d) => !d.value)) return <StateFill icon="chart" title="No data for this range" style={{ height: size }} />;
  const total = data.reduce((a, b) => a + b.value, 0);
  const R = size / 2, r = R * 0.62, cx = R, cy = R;
  const gap = 0.018;
  let acc = -0.25;
  const arcs = data.map((d) => {
    const frac = d.value / total;
    const a0 = acc * 2 * Math.PI + gap * Math.PI;
    const a1 = (acc + frac) * 2 * Math.PI - gap * Math.PI;
    acc += frac;
    const big = (a1 - a0) > Math.PI ? 1 : 0;
    const p = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const o0 = p(a0, R), o1 = p(a1, R), i1 = p(a1, r), i0 = p(a0, r);
    const path = "M" + o0[0] + " " + o0[1] + " A" + R + " " + R + " 0 " + big + " 1 " + o1[0] + " " + o1[1] +
      " L" + i1[0] + " " + i1[1] + " A" + r + " " + r + " 0 " + big + " 0 " + i0[0] + " " + i0[1] + " Z";
    return { path, frac, d };
  });
  return (
    <div className="row" style={{ gap: 24, alignItems: "center", flexWrap: "wrap" }} onMouseLeave={() => { setHover(null); setTip({ show: false }); }}>
      <div style={{ position: "relative", flex: "0 0 auto" }}>
        <svg className="donut-in" width={size} height={size} style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : "rotate(-10deg) scale(.9)" }}>
          {arcs.map((a, i) => (
            <path key={i} d={a.path} fill={a.d.color}
              opacity={hover !== null && hover !== i ? 0.4 : 1}
              style={{ transition: "opacity .12s", cursor: "default", transformOrigin: cx + "px " + cy + "px", transform: hover === i ? "scale(1.03)" : "scale(1)" }}
              onMouseEnter={(e) => { setHover(i); setTip({ show: true, x: e.clientX, y: e.clientY }); }}
              onMouseMove={(e) => setTip({ show: true, x: e.clientX, y: e.clientY })} />
          ))}
          <text x={cx} y={cy - 4} className="donut-center donut-center__v" fontSize="22">{props.centerValue || Fmt.abbr(total)}</text>
          <text x={cx} y={cy + 16} className="donut-center donut-center__l" fontSize="11">{props.centerLabel || "Total"}</text>
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 160 }}>
        {data.map((d, i) => (
          <div key={i} className="row between" style={{ opacity: hover !== null && hover !== i ? 0.5 : 1, transition: "opacity .12s" }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="legend-item"><span className="legend-swatch" style={{ background: d.color }} />{d.label}</span>
            <span className="row" style={{ gap: 8 }}>
              <b className="mono" style={{ fontSize: "var(--fs-sm)" }}>{Fmt.abbr(d.value)}</b>
              <span className="tertiary mono" style={{ fontSize: "var(--fs-label)", width: 38, textAlign: "right" }}>{Math.round((d.value / total) * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
      <ChartTip show={tip.show} x={tip.x} y={tip.y}
        title={hover !== null ? data[hover].label : ""}
        rows={hover !== null ? [{ color: data[hover].color, label: "Amount", value: Fmt.num(data[hover].value) + " (" + Math.round(data[hover].value / total * 100) + "%)" }] : []} />
    </div>
  );
}

Object.assign(window, { useWidth, LineAreaChart, BarChart, HBarChart, DonutChart, ChartTip });
