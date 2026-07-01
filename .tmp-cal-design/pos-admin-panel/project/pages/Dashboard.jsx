/* ============================================================
   ALPHA POS — Dashboard
   KPI row (top) -> charts ordered by importance (top-left = most)
   ============================================================ */
const { useState, useEffect } = React;

function DashboardPage(props) {
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, [props.dateRange]);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); toast({ tone: "success", title: "Dashboard refreshed", msg: "Data updated to 13.06.2026, 19:38." }); }, 700);
  };

  const trend = DB.revenueTrend;
  const cats = trend.map((d) => d.label);
  const revSeries = [
    { key: "revenue", label: "Revenue", color: "var(--chart-revenue)", data: trend.map((d) => d.revenue) },
    { key: "expense", label: "Expenses", color: "var(--chart-expense)", data: trend.map((d) => d.expense) },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle="Today's snapshot · 13.06.2026, 19:38"
        actions={<React.Fragment>
          <Button variant="secondary" icon="refresh" onClick={refresh} loading={loading}>Refresh</Button>
          <Button variant="primary" icon="download">Export report</Button>
        </React.Fragment>}
      />

      {/* KPI row */}
      <div className="grid cols-4" style={{ marginBottom: "var(--sp-5)" }}>
        {DB.dashboardKpis.map((k) => loading
          ? <KpiSkel key={k.key} />
          : <Kpi key={k.key} data={Object.assign({}, k, { deltaLabel: k.delta != null ? "vs last week" : (k.key === "lowstock" ? "needs reorder" : null) })} />)}
      </div>

      {/* Secondary KPIs */}
      <div className="grid cols-4" style={{ marginBottom: "var(--sp-5)" }}>
        {DB.dashboardSubKpis.map((k) => loading ? <KpiSkel key={k.key} mini /> : <KpiMini key={k.key} data={k} />)}
      </div>

      {/* Revenue trend + payment mix */}
      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr", marginBottom: "var(--sp-5)" }}>
        <ChartCard
          eyebrow="Revenue vs expenses · last 14 days"
          insight="Revenue is up 12% vs last week"
          actions={<Segmented value="rev" onChange={() => {}} options={[{ value: "rev", label: "Revenue" }, { value: "ord", label: "Orders" }]} />}>
          <LineAreaChart loading={loading} categories={cats} series={revSeries} target={DB.revenueTarget} height={260} />
          {!loading && (
            <div className="chart-legend" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--chart-revenue)" }} />Revenue <b>{Fmt.money(trend[trend.length - 1].revenue)}</b></span>
              <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--chart-expense)" }} />Expenses <b>{Fmt.money(trend[trend.length - 1].expense)}</b></span>
              <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--chart-target)" }} />Daily target <b>{Fmt.money(DB.revenueTarget)}</b></span>
            </div>
          )}
        </ChartCard>

        <ChartCard eyebrow="Payment mix · today" insight="Cash leads at 35%" sub="Share of paid revenue by method">
          <DonutChart loading={loading} data={DB.paymentMix} centerLabel="Collected" size={188} />
        </ChartCard>
      </div>

      {/* Orders by hour + top products */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", marginBottom: "var(--sp-5)" }}>
        <ChartCard eyebrow="Orders by hour · today" insight="Peak trade at 19:00" sub="143 orders across the day">
          <BarChart loading={loading} data={DB.ordersByHour.map((h) => ({ label: h.label, value: h.orders, peak: h.peak }))} height={240} valueLabel="Orders" yFormat={(v) => String(Math.round(v))} />
        </ChartCard>
        <ChartCard eyebrow="Top products · today" insight="Pitsa tovuqli katta leads revenue" sub="By revenue contribution">
          <HBarChart loading={loading} data={DB.topProductsToday} valueFormat={Fmt.abbr} />
        </ChartCard>
      </div>

      {/* Recent orders + side column */}
      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
        <Card>
          <div className="card__head">
            <div className="card__head-text"><h3 className="card__title">Recent orders</h3><div className="card__sub">Latest activity today</div></div>
            <div className="card__actions"><Button variant="ghost" size="sm" iconRight="chevright" onClick={() => props.onNav("orders")}>View all</Button></div>
          </div>
          <div className="card__divider" />
          {loading ? <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>{[0,1,2,3,4].map((i)=><Skeleton key={i} h={18} />)}</div> : (
            <table className="dtable">
              <thead><tr>
                <th>Order</th><th>Type</th><th>Status</th><th>Payment</th><th className="num">Total</th><th className="num">Time</th>
              </tr></thead>
              <tbody>
                {DB.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="cell-strong mono">#{o.id}</td>
                    <td><Badge tone="neutral">{o.type}</Badge></td>
                    <td><StatusBadge value={o.status} dot /></td>
                    <td><StatusBadge value={o.payment} /></td>
                    <td className="num mono cell-strong">{Fmt.money(o.total)}</td>
                    <td className="num mono cell-muted">{Fmt.time(o.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          <Card>
            <div className="card__head" style={{ paddingBottom: "var(--sp-3)" }}>
              <div className="card__head-text"><h3 className="card__title">Clocked in</h3></div>
              <Badge tone="primary">{DB.clockedIn.length} active</Badge>
            </div>
            <div className="card__body" style={{ paddingTop: 0 }}>
              {loading ? [0,1].map((i)=><Skeleton key={i} h={40} style={{ marginBottom: 10 }} />) : DB.clockedIn.map((c) => (
                <div key={c.name} className="row" style={{ padding: "8px 0", gap: 12 }}>
                  <div className="avatar avatar--sm">{c.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                    <div className="tertiary" style={{ fontSize: 12 }}>Since {Fmt.dateTime(c.since)}</div>
                  </div>
                  <span className="badge t-success badge--dot">On shift</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="card__head" style={{ paddingBottom: "var(--sp-3)" }}>
              <div className="card__head-text"><h3 className="card__title">Low stock</h3></div>
              <Badge tone="warning">{DB.lowStock.length} items</Badge>
            </div>
            <div className="card__body" style={{ paddingTop: 0 }}>
              {loading ? [0,1,2].map((i)=><Skeleton key={i} h={28} style={{ marginBottom: 10 }} />) : DB.lowStock.map((s) => (
                <div key={s.name} className="row between" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</span>
                  <span className="row" style={{ gap: 10 }}>
                    <span className="mono" style={{ color: "var(--warning)", fontWeight: 600, fontSize: 13 }}>{s.level} {s.unit}</span>
                    <span className="tertiary" style={{ fontSize: 12 }}>/ {s.reorder}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiSkel(props) {
  return (
    <div className="kpi">
      {!props.mini && <div className="kpi__top"><Skeleton w={38} h={38} r={8} /><Skeleton w={90} h={13} /></div>}
      {props.mini && <Skeleton w={70} h={13} style={{ marginBottom: 10 }} />}
      <Skeleton w={props.mini ? 90 : 140} h={props.mini ? 24 : 30} />
      {!props.mini && <Skeleton w={80} h={18} style={{ marginTop: 12, borderRadius: 99 }} />}
    </div>
  );
}

Object.assign(window, { DashboardPage, KpiSkel });
