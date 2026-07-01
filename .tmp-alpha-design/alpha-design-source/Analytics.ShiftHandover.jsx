/* ============================================================
   ALPHA POS — Analytics · Shift Handover Report
   ============================================================ */
const { useState, useEffect } = React;

function AnalyticsPage(props) {
  const s = DB.shift;
  const [loading, setLoading] = useState(true);
  const [shiftId, setShiftId] = useState(String(s.id));
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, [props.dateRange]);

  const load = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); toast({ tone: "info", title: "Shift #" + shiftId + " loaded" }); }, 700);
  };

  const b = s.breakdown, sp = s.speed;

  return (
    <div className="page">
      <PageHeader
        title="Shift Handover Report"
        subtitle="Per-shift performance, payments and punctuality"
        actions={<React.Fragment>
          <div style={{ width: 130 }}>
            <Field label="Shift ID"><Input value={shiftId} onChange={(e) => setShiftId(e.target.value)} icon="search" /></Field>
          </div>
          <Button variant="primary" icon="chart" onClick={load} loading={loading} style={{ alignSelf: "flex-end" }}>Load</Button>
        </React.Fragment>}
      />

      {/* Shift summary banner */}
      <Card style={{ marginBottom: "var(--sp-5)" }}>
        <div className="row between" style={{ padding: "var(--sp-5)", flexWrap: "wrap", gap: 16 }}>
          <div className="row" style={{ gap: 16 }}>
            <div className="avatar" style={{ width: 48, height: 48, flexBasis: 48, fontSize: 17 }}>{s.initials}</div>
            <div>
              <div className="row" style={{ gap: 10 }}>
                <span style={{ fontSize: "var(--fs-h2)", fontWeight: 700, letterSpacing: "-0.01em" }}>{s.cashier}</span>
                <StatusBadge value={s.status} dot />
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                Shift #{s.id} · {Fmt.dateTime(s.start)} — in progress · {s.durationLabel}
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 28 }}>
            <SummaryStat label="Receipts" value={Fmt.num(s.receipts)} />
            <SummaryStat label="Avg / hour" value={sp.ordersPerHour.toFixed(1)} />
            <SummaryStat label="Top product" value={s.topProduct} mono={false} accent />
          </div>
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid cols-4" style={{ marginBottom: "var(--sp-5)" }}>
        {loading ? [0,1,2,3].map((i) => <KpiSkel key={i} />) : (<React.Fragment>
          <Kpi data={{ label: "Revenue", value: s.kpis.revenue, money: true, tone: "primary", icon: "wallet", sub: Fmt.moneyAbbr(s.kpis.revenuePerHour) + " / h" }} />
          <Kpi data={{ label: "Cash", value: s.kpis.cash, money: true, tone: "success", icon: "coins", sub: Math.round(s.kpis.cash / s.kpis.revenue * 100) + "% of revenue" }} />
          <Kpi data={{ label: "Card", value: s.kpis.card, money: true, tone: "info", icon: "register", sub: Math.round(s.kpis.card / s.kpis.revenue * 100) + "% of revenue" }} />
          <Kpi data={{ label: "Avg Order Value", value: s.kpis.aov, money: true, tone: "neutral", icon: "trend", delta: 3.9, deltaLabel: "vs shift avg" }} />
        </React.Fragment>)}
      </div>

      {/* Payment mix + orders by hour */}
      <div className="grid cols-2" style={{ marginBottom: "var(--sp-5)" }}>
        <ChartCard eyebrow="Payment mix · this shift" insight="Cash & Uzcard cover 64%" sub="Share of collected revenue by method">
          <DonutChart loading={loading} data={s.paymentMix} centerLabel="Collected" size={188} />
        </ChartCard>
        <ChartCard eyebrow="Orders by hour" insight={"Peak trade at " + "19:00"} sub="Busiest window of the shift">
          <BarChart loading={loading} data={s.ordersByHour.map((h) => ({ label: h.label, value: h.orders, peak: h.peak }))} height={236} valueLabel="Orders" yFormat={(v) => String(Math.round(v))} />
        </ChartCard>
      </div>

      {/* Breakdown + Speed & punctuality */}
      <div className="grid cols-2" style={{ marginBottom: "var(--sp-5)" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><h3 className="card__title">Orders breakdown</h3></div></div>
          <div className="card__body">
            <div className="row" style={{ gap: 0, marginBottom: 18 }}>
              <BreakStat label="Completed" value={b.completed} tone="success" />
              <BreakStat label={"Cancelled (" + Fmt.pct(b.cancelledPct) + ")"} value={b.cancelled} tone="error" />
              <BreakStat label="Paid" value={b.paid} tone="primary" />
            </div>
            <LineRow label="Hall" value={b.hall} />
            <LineRow label="Delivery" value={b.delivery} />
            <LineRow label="Pickup" value={b.pickup} />
            <div className="hr" style={{ margin: "12px 0" }} />
            <LineRow label={"Items · " + b.itemsLines + " lines"} value={b.itemsUnits + " units"} mono={false} />
            <LineRow label="Discounts" value={Fmt.money(b.discounts) + " (" + b.discountOrders + " orders)"} mono={false} />
          </div>
        </Card>

        <Card>
          <div className="card__head"><div className="card__head-text"><h3 className="card__title">Speed & punctuality</h3></div></div>
          <div className="card__body">
            <LineRow label="Avg prep time" value={sp.avgPrep} mono={false} />
            <LineRow label="Orders / hour" value={sp.ordersPerHour.toFixed(2)} />
            <div className="hr" style={{ margin: "12px 0" }} />
            <LineRow label="Scheduled start" value={sp.scheduledStart} mono={false} />
            <LineRow label="Actual start" value={Fmt.dateTime(sp.actualStart)} mono={false} />
            <LineRow label="Late" value={<span style={{ color: "var(--warning)", fontWeight: 600 }}>{sp.late}</span>} mono={false} />
            <div className="hr" style={{ margin: "12px 0" }} />
            <div className="kpi__label" style={{ marginBottom: 8 }}>Attendance</div>
            <LineRow label="Check in / out" value={Fmt.time(sp.checkIn) + " / —"} mono={false} />
            <LineRow label="Work / overtime" value={sp.work + " / " + sp.overtime} mono={false} />
          </div>
        </Card>
      </div>

      {/* Top products + product detail */}
      <div className="grid cols-2" style={{ marginBottom: "var(--sp-5)" }}>
        <ChartCard eyebrow="Top products · this shift" insight="Pitsa tovuqli katta is the top earner"
          actions={<Badge tone="success"><Icon name="star" size={13} />{s.topProduct}</Badge>}>
          <HBarChart loading={loading} data={s.topProducts} valueFormat={Fmt.abbr} />
        </ChartCard>
        <Card>
          <div className="card__head"><div className="card__head-text"><h3 className="card__title">Product detail</h3></div></div>
          <div className="card__divider" />
          {loading ? <div style={{ padding: 20 }}>{[0,1,2,3,4].map((i)=><Skeleton key={i} h={18} style={{ marginBottom: 14 }} />)}</div> : (
            <table className="dtable">
              <thead><tr><th>Name</th><th className="num">Units</th><th className="num">Orders</th><th className="num">Revenue</th></tr></thead>
              <tbody>
                {s.productDetail.map((p) => (
                  <tr key={p.name}>
                    <td className="cell-strong">{p.name}</td>
                    <td className="num mono">{p.units}</td>
                    <td className="num mono cell-muted">{p.orders}</td>
                    <td className="num mono cell-strong">{Fmt.money(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* All receipts */}
      <Card>
        <div className="card__head">
          <div className="card__head-text"><h3 className="card__title">All receipts</h3><div className="card__sub">{s.receiptsList.length} of {s.receipts} shown</div></div>
          <div className="card__actions"><Button variant="secondary" size="sm" icon="download">Export</Button></div>
        </div>
        <div className="card__divider" />
        {loading ? <div style={{ padding: 20 }}>{[0,1,2,3,4].map((i)=><Skeleton key={i} h={18} style={{ marginBottom: 14 }} />)}</div> : (
          <table className="dtable">
            <thead><tr>
              <th>#</th><th>Status</th><th>Type</th><th>Payment</th><th className="num">Lines</th><th className="num">Units</th><th className="num">Discount</th>
            </tr></thead>
            <tbody>
              {s.receiptsList.map((r) => (
                <tr key={r.id}>
                  <td className="cell-strong mono">#{r.id}</td>
                  <td><StatusBadge value={r.status} dot /></td>
                  <td><Badge tone="neutral">{r.type}</Badge></td>
                  <td><StatusBadge value={r.payment} /></td>
                  <td className="num mono">{r.lines}</td>
                  <td className="num mono">{r.units}</td>
                  <td className="num mono cell-muted">{r.discount ? Fmt.money(r.discount) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function SummaryStat(props) {
  return (
    <div style={{ textAlign: "right" }}>
      <div className="kpi__label">{props.label}</div>
      <div className={cx(props.mono === false ? "" : "mono")} style={{ fontSize: props.accent ? 15 : 20, fontWeight: 700, marginTop: 2, color: props.accent ? "var(--primary)" : "var(--text)", maxWidth: 180 }}>{props.value}</div>
    </div>
  );
}
function BreakStat(props) {
  const colorMap = { success: "var(--success)", error: "var(--error)", primary: "var(--primary)" };
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: colorMap[props.tone], marginBottom: 4 }}>{props.label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{Fmt.num(props.value)}</div>
    </div>
  );
}
function LineRow(props) {
  return (
    <div className="row between" style={{ padding: "7px 0" }}>
      <span className="muted" style={{ fontSize: 14 }}>{props.label}</span>
      <span className={cx(props.mono === false ? "" : "mono")} style={{ fontWeight: 600, fontSize: 14 }}>{props.value}</span>
    </div>
  );
}

Object.assign(window, { AnalyticsPage });
