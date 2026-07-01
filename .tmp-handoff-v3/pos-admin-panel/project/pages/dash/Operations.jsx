/* ============================================================
   ALPHA POS — Dashboard 3: Operations / Live
   ============================================================ */
const { useState, useEffect } = React;

function OperationsDashboard(props) {
  if (props.loading) return <DashLoading rows={3} />;
  const D = window.DASH;

  const liveCounts = [
    { label: "Open orders", value: 5, icon: "receipt", tone: "warning" },
    { label: "In kitchen", value: 3, icon: "clock", tone: "info" },
    { label: "Ready to serve", value: 2, icon: "check", tone: "success" },
    { label: "Tables seated", value: D.tableGrid.filter((t) => t.status === "seated").length, icon: "table", tone: "primary" },
  ];
  const ordersByHour = DB.ordersByHour.map((h) => ({ label: h.label, value: h.orders, peak: h.peak }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      {/* pulsing live counters */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {liveCounts.map((c) => (
          <div key={c.label} className="herokpi">
            <div className="herokpi__top"><span className="herokpi__label">{c.label}</span><span className={cx("herokpi__icon", "t-" + c.tone)}><Icon name={c.icon} size={17} /></span></div>
            <div className="herokpi__value"><CountUp value={c.value} format={Fmt.num} /></div>
            <div className="herokpi__foot"><span className="badge t-success badge--dot">Live</span></div>
          </div>
        ))}
      </div>

      {/* funnel + prep gauge + avg counters */}
      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr 1fr" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Order pipeline · today</div><h3 className="card__insight">94% of orders close cleanly</h3></div></div>
          <div className="card__body"><Funnel data={D.funnelData} /></div>
        </Card>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Kitchen speed</div><h3 className="card__title">Avg prep time</h3></div></div>
          <div className="card__body">
            <Gauge value={8.3} max={15} size={190} color="var(--success)" centerValue="8:20" label="min / order" footer="Target under 12:00" />
          </div>
        </Card>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Service rings</div><h3 className="card__title">Fulfilment</h3></div></div>
          <div className="card__body">
            <div className="row" style={{ gap: 18, justifyContent: "space-around", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}><ProgressRing value={94} color="var(--success)" /><div className="muted" style={{ fontSize: 12, marginTop: 8 }}>On-time</div></div>
              <div style={{ textAlign: "center" }}><ProgressRing value={86} color="var(--primary)" /><div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Paid</div></div>
              <div style={{ textAlign: "center" }}><ProgressRing value={2.8} max={100} color="var(--error)" centerValue="2.8%" /><div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Cancelled</div></div>
            </div>
          </div>
        </Card>
      </div>

      {/* orders by hour + table occupancy + prep by category */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Avg prep time by category</div><h3 className="card__insight">Pizza runs over target</h3></div></div>
          <div className="card__body"><PrepByCategory data={D.prepByCategory} /></div>
        </Card>
        <Card>
          <div className="card__head between"><div className="card__head-text"><div className="kpi__label">Floor · 16 tables</div><h3 className="card__title">Table occupancy</h3></div>
            <div className="row" style={{ gap: 10, fontSize: 11 }}>
              <span className="row" style={{ gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--success)" }} />Seated</span>
              <span className="row" style={{ gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--warning)" }} />Reserved</span>
            </div>
          </div>
          <div className="card__body">
            <div className="tablegrid">
              {D.tableGrid.map((t) => (
                <div key={t.n} className={cx("tablecell", "s-" + t.status)} title={t.status}>
                  <span className="tablecell__n">{t.n}</span>
                  <span className="tablecell__m">{t.status === "seated" ? t.guests + "p · " + t.mins + "m" : t.status}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* orders by hour full width */}
      <Card>
        <div className="card__head"><div className="card__head-text"><div className="kpi__label">Orders by hour · today</div><h3 className="card__insight">Peak trade at 19:00</h3></div></div>
        <div className="card__body"><BarChart data={ordersByHour} height={250} valueLabel="Orders" yFormat={(v) => String(Math.round(v))} /></div>
      </Card>
    </div>
  );
}

/* Avg prep time by category — bars colored vs target, target marker */
function PrepByCategory(props) {
  const shown = window.useShown ? useShown(80) : true;
  const data = (props.data || []).slice().sort((a, b) => b.mins - a.mins);
  const max = Math.max.apply(null, data.map((d) => Math.max(d.mins, d.target))) * 1.1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      {data.map((d, i) => {
        const over = d.mins > d.target;
        const wpct = (d.mins / max) * 100, tpct = (d.target / max) * 100;
        return (
          <div key={d.label}>
            <div className="row between" style={{ marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</span>
              <span className="row" style={{ gap: 8, fontSize: 12 }}>
                <span className="mono" style={{ fontWeight: 700, color: over ? "var(--error)" : "var(--success)" }}>{d.mins.toFixed(1)}m</span>
                <span className="tertiary mono">/ {d.target}m</span>
              </span>
            </div>
            <div style={{ position: "relative", height: 12, background: "var(--chart-track)", borderRadius: 99 }}>
              <div style={{ position: "absolute", inset: 0, width: (shown ? wpct : 0) + "%", background: over ? "var(--error)" : "var(--success)", borderRadius: 99, transition: "width .6s cubic-bezier(.2,.8,.2,1) " + (i * 0.04) + "s" }} />
              <div style={{ position: "absolute", top: -3, bottom: -3, left: tpct + "%", width: 2.5, borderRadius: 2, background: "var(--text)", opacity: .5 }} title={"Target " + d.target + "m"} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { OperationsDashboard, PrepByCategory });
