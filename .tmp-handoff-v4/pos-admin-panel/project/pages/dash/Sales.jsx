/* ============================================================
   ALPHA POS — Dashboard 2: Sales & Revenue
   ============================================================ */
function SalesDashboard(props) {
  if (props.loading) return <DashLoading rows={3} />;
  const D = window.DASH;

  const channelSeries = [
    { key: "hall", label: "Hall", color: "var(--c1)" },
    { key: "delivery", label: "Delivery", color: "var(--c3)" },
    { key: "pickup", label: "Pickup", color: "var(--c2)" },
  ];
  const bullets = [
    { label: "Pizza", value: 24800000, target: 26000000 },
    { label: "Lavash", value: 18200000, target: 16000000 },
    { label: "Kebab", value: 15600000, target: 18000000 },
    { label: "Hot Dogs", value: 8900000, target: 8000000 },
    { label: "Drinks", value: 6400000, target: 7500000 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <HeroKpi data={{ label: "This month", value: D.monthRevenue, money: true, unit: "UZS", delta: 12.4, icon: "wallet", tone: "primary", spark: D.revenue30.slice(-14) }} />
        <HeroKpi data={{ label: "vs last month", value: "+" + Fmt.abbr(D.monthRevenue - D.lastMonthRev.reduce((a,b)=>a+b,0)), unit: "UZS", delta: 14.1, icon: "trend", tone: "success" }} />
        <HeroKpi data={{ label: "Best day", value: Math.max.apply(null, D.revenue30), money: true, unit: "UZS", icon: "star", tone: "warning", sub: "single-day record" }} />
        <HeroKpi data={{ label: "Expenses (30d)", value: D.expense30.reduce((a,b)=>a+b,0), money: true, unit: "UZS", delta: -2.3, icon: "receipt", tone: "error", spark: D.expense30.slice(-14) }} />
      </div>

      {/* revenue vs expenses + cumulative comparison */}
      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Revenue vs expenses · 30 days</div><h3 className="card__insight">Margin holding at {D.grossMargin}%</h3></div></div>
          <div className="card__body">
            <LineAreaChart categories={D.dayLabels} height={290}
              series={[
                { key: "revenue", label: "Revenue", color: "var(--chart-revenue)", data: D.revenue30 },
                { key: "expense", label: "Expenses", color: "var(--chart-expense)", data: D.expense30 },
              ]} />
            <div className="chart-legend" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--chart-revenue)" }} />Revenue</span>
              <span className="legend-item"><span className="legend-swatch" style={{ background: "var(--chart-expense)" }} />Expenses</span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Category targets</div><h3 className="card__title">Actual vs target</h3></div></div>
          <div className="card__body"><Bullet items={bullets} /></div>
        </Card>
      </div>

      {/* heatmap + channel stack */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">When sales happen</div><h3 className="card__insight">Fri & Sat dinner drive volume</h3></div></div>
          <div className="card__body"><Heatmap rows={D.HM_DAYS} cols={D.HM_HOURS} matrix={D.heatMatrix} unit="orders" /></div>
        </Card>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">By channel · last 7 days</div><h3 className="card__title">Hall vs delivery vs pickup</h3></div></div>
          <div className="card__body"><StackedBar data={D.channelDays} series={channelSeries} height={260} /></div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { SalesDashboard });
