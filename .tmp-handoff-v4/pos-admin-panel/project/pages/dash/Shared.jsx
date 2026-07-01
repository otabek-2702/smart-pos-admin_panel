/* ============================================================
   ALPHA POS — dashboards shared helpers + interactive chart
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

/* ---- Switchable big chart: toggle metric + chart type (area/line/bar) ---- */
function SwitchChart(props) {
  const metrics = props.metrics;                 // [{key,label,color,data,format}]
  const [metricKey, setMetricKey] = useState(metrics[0].key);
  const [type, setType] = useState(props.defaultType || "area");
  const [compare, setCompare] = useState(false);
  const m = metrics.find((x) => x.key === metricKey) || metrics[0];
  const cats = props.categories;
  const fmt = m.format || Fmt.abbr;

  const series = useMemo(() => {
    const base = [{ key: m.key, label: m.label, color: m.color, data: m.data }];
    if (compare && props.compareData && props.compareData[m.key])
      base.push({ key: "cmp", label: props.compareLabel || "Previous", color: "var(--chart-target)", data: props.compareData[m.key], dashed: true });
    return base;
  }, [m, compare]);

  return (
    <div>
      <div className="row between wrap" style={{ gap: 12, marginBottom: 16 }}>
        <div className="seg" role="tablist">
          {metrics.map((x) => (
            <button key={x.key} className={cx("seg__btn", metricKey === x.key && "is-active")} onClick={() => setMetricKey(x.key)}>{x.label}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 10 }}>
          {props.compareData && (
            <button className={cx("chip", compare && "is-on")} style={compare ? {} : { background: "transparent", color: "var(--text-secondary)", borderColor: "var(--border-strong)" }} onClick={() => setCompare((c) => !c)}>
              <Icon name={compare ? "check" : "plus"} size={13} /> Compare
            </button>
          )}
          <div className="seg" role="tablist">
            {[{ k: "area", i: "trend" }, { k: "bar", i: "grid" }].map((t) => (
              <button key={t.k} className={cx("seg__btn", type === t.k && "is-active")} title={t.k} onClick={() => setType(t.k)} style={{ padding: "0 10px" }}>
                <Icon name={t.i} size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>
      {type === "bar"
        ? <BarChart data={cats.map((c, i) => ({ label: c, value: m.data[i] }))} height={props.height || 300} valueLabel={m.label} yFormat={fmt} />
        : <LineAreaChart categories={cats} series={type === "line" ? series.map((s) => Object.assign({}, s, { _noArea: true })) : series} height={props.height || 300} yFormat={fmt} noArea={type === "line"} />}
    </div>
  );
}

/* ---- KPI hero with sparkline ---- */
function HeroKpi(props) {
  const d = props.data;
  const reduced = window.usePrefersReduced ? usePrefersReduced() : false;
  return (
    <div className="herokpi">
      <div className="herokpi__top">
        <span className="herokpi__label">{d.label}</span>
        {d.icon && <span className={cx("herokpi__icon", "t-" + (d.tone || "primary"))}><Icon name={d.icon} size={17} /></span>}
      </div>
      <div className="herokpi__value">
        {d.money ? <CountUp value={d.value} format={Fmt.moneyAbbr} /> : (typeof d.value === "number" ? <CountUp value={d.value} format={Fmt.num} /> : d.value)}
        {d.unit && <span className="herokpi__unit">{d.unit}</span>}
      </div>
      <div className="herokpi__foot">
        {d.delta != null && <Delta value={d.delta} />}
        {d.sub && <span className="herokpi__sub">{d.sub}</span>}
        {d.spark && <span style={{ marginLeft: "auto" }}><Sparkline data={d.spark} width={96} height={30} colorByTrend /></span>}
      </div>
    </div>
  );
}

/* ---- Dashboard section title ---- */
function DashSection(props) {
  return (
    <div className="row between wrap" style={{ gap: 12, margin: props.tight ? "0 0 12px" : "4px 0 14px" }}>
      <div>
        <h2 style={{ fontSize: "var(--fs-h3)", fontWeight: 700, margin: 0, letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--text-tertiary)", fontSize: 12, letterSpacing: "0.06em" }}>{props.eyebrow}</h2>
        {props.title && <div style={{ fontSize: "var(--fs-h2)", fontWeight: 700, letterSpacing: "-0.01em", marginTop: 3 }}>{props.title}</div>}
      </div>
      {props.actions}
    </div>
  );
}

Object.assign(window, { SwitchChart, HeroKpi, DashSection });
