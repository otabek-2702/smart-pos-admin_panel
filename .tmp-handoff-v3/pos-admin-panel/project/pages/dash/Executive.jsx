/* ============================================================
   ALPHA POS — Dashboard 1: Executive Overview
   ============================================================ */
const { useState, useEffect } = React;

function ExecutiveDashboard(props) {
  const loading = props.loading;
  const D = window.DASH;

  const heroKpis = [
    { label: "Revenue (30d)", value: D.monthRevenue, money: true, unit: "UZS", delta: 12.4, icon: "wallet", tone: "primary", spark: D.revenue30.slice(-14) },
    { label: "Orders (30d)", value: D.monthOrders, delta: 8.1, icon: "receipt", tone: "info", sub: "", spark: D.orders30.slice(-14) },
    { label: "Avg Order Value", value: D.avgAov, money: true, unit: "UZS", delta: 3.9, icon: "trend", tone: "success", spark: D.aov30.slice(-14) },
    { label: "Gross Margin", value: D.grossMargin + "%", delta: 1.6, icon: "coins", tone: "warning", sub: "of revenue" },
    { label: "Repeat Rate", value: D.repeatRate + "%", delta: 4.2, icon: "users", tone: "primary", sub: "returning guests" },
  ];

  if (loading) return <DashLoading rows={3} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      {/* hero KPI strip */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {heroKpis.map((k) => <HeroKpi key={k.label} data={k} />)}
      </div>

      {/* main: big switchable chart + goal gauge */}
      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
        <Card>
          <div className="card__head">
            <div className="card__head-text">
              <div className="kpi__label" style={{ marginBottom: 3 }}>Performance · last 30 days</div>
              <h3 className="card__insight">Revenue is up 12% this month</h3>
            </div>
          </div>
          <div className="card__body">
            <SwitchChart
              categories={D.dayLabels}
              metrics={[
                { key: "rev", label: "Revenue", color: "var(--chart-revenue)", data: D.revenue30, format: Fmt.abbr },
                { key: "ord", label: "Orders", color: "var(--chart-revenue)", data: D.orders30, format: (v) => String(Math.round(v)) },
                { key: "aov", label: "Avg Order", color: "var(--chart-revenue)", data: D.aov30, format: Fmt.abbr },
              ]}
              compareData={{ rev: D.lastMonthRev }}
              compareLabel="Last month"
              height={300}
            />
          </div>
        </Card>

        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Monthly target</div><h3 className="card__title">Revenue goal</h3></div></div>
          <div className="card__body">
            <Gauge value={D.monthRevenue} max={D.monthTarget} size={220} label="of target"
              centerValue={Math.round(D.monthRevenue / D.monthTarget * 100) + "%"}
              footer={Fmt.money(D.monthRevenue) + " / " + Fmt.abbr(D.monthTarget) + " UZS"} />
            <div className="hr" style={{ margin: "8px 0 16px" }} />
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="muted" style={{ fontSize: 13 }}>Daily pace needed</span>
              <span className="mono" style={{ fontWeight: 700 }}>{Fmt.abbr((D.monthTarget - D.monthRevenue) / 6)}/day</span>
            </div>
            <div className="row between">
              <span className="muted" style={{ fontSize: 13 }}>Projected close</span>
              <span className="badge t-success">On track</span>
            </div>
          </div>
        </Card>
      </div>

      {/* secondary row: payment donut + channel + live feed */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Payment mix</div><h3 className="card__title">How guests pay</h3></div></div>
          <div className="card__body"><DonutChart data={DB.paymentMix} centerLabel="Collected" size={170} /></div>
        </Card>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Top categories</div><h3 className="card__title">Revenue by category</h3></div></div>
          <div className="card__body"><HBarChart data={DASH.categories.slice(0, 5).map((c) => ({ name: c.label, value: c.value }))} valueFormat={Fmt.abbr} /></div>
        </Card>
        <Card>
          <div className="card__head between"><div className="card__head-text"><div className="kpi__label">Live</div><h3 className="card__title">Recent activity</h3></div><span className="badge t-success badge--dot">Live</span></div>
          <div className="card__body" style={{ paddingTop: 0 }}><LiveFeed /></div>
        </Card>
      </div>
    </div>
  );
}

/* live animated order feed */
function LiveFeed() {
  const [feed, setFeed] = useState(window.DASH.liveFeed);
  useEffect(() => {
    const names = ["Table 7", "Table 3", "Chilonzor", "—", "Table 12", "Yunusobod", "Table 1"];
    const types = ["HALL", "DELIVERY", "PICKUP"];
    const iv = setInterval(() => {
      setFeed((f) => {
        const id = f[0].id + 1;
        const next = { id, type: types[Math.floor(Math.random() * 3)], info: names[Math.floor(Math.random() * names.length)], total: (20 + Math.floor(Math.random() * 200)) * 1000, ts: Date.now(), status: "PREPARING", _new: true };
        return [next].concat(f).slice(0, 6);
      });
    }, 3800);
    return () => clearInterval(iv);
  }, []);
  const ago = (ts) => { const s = Math.round((Date.now() - ts) / 1000); return s < 60 ? s + "s" : Math.round(s / 60) + "m"; };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {feed.map((o, i) => (
        <div key={o.id} className={cx("feed-row", o._new && "feed-row--new")} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderBottom: i < feed.length - 1 ? "1px solid var(--border)" : "none" }}>
          <span className={cx("feed-dot", "t-" + (o.status === "READY" ? "success" : o.status === "COMPLETED" ? "neutral" : "warning"))} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 7 }}><span className="cell-strong mono" style={{ fontSize: 13 }}>#{o.id}</span><Badge tone={o.type === "DELIVERY" ? "info" : o.type === "PICKUP" ? "primary" : "neutral"}>{o.type}</Badge></div>
            <div className="tertiary" style={{ fontSize: 11 }}>{o.info} · {ago(o.ts)} ago</div>
          </div>
          <span className="mono cell-strong" style={{ fontSize: 13 }}>{Fmt.money(o.total)}</span>
        </div>
      ))}
    </div>
  );
}

function DashLoading(props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="herokpi"><Skeleton h={14} w="60%" /><Skeleton h={28} w="80%" style={{ marginTop: 14 }} /><Skeleton h={16} w="50%" style={{ marginTop: 12 }} /></div>)}
      </div>
      {Array.from({ length: props.rows || 2 }).map((_, r) => (
        <div key={r} className="grid" style={{ gridTemplateColumns: r % 2 ? "1fr 1fr 1fr" : "1.7fr 1fr" }}>
          {Array.from({ length: r % 2 ? 3 : 2 }).map((_, i) => <Card key={i} style={{ padding: 20 }}><Skeleton h={18} w="40%" /><Skeleton h={240} style={{ marginTop: 16, borderRadius: 10 }} /></Card>)}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { ExecutiveDashboard, LiveFeed, DashLoading });
