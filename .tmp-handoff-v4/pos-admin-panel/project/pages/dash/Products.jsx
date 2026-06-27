/* ============================================================
   ALPHA POS — Dashboard 4: Products & Menu performance
   ============================================================ */
function ProductsDashboard(props) {
  if (props.loading) return <DashLoading rows={3} />;
  const D = window.DASH;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <HeroKpi data={{ label: "Menu items", value: 316, icon: "box", tone: "primary", sub: "across 8 categories" }} />
        <HeroKpi data={{ label: "Best seller", value: "Pitsa katta", icon: "star", tone: "warning", sub: "312 units · 30d" }} />
        <HeroKpi data={{ label: "Units sold (30d)", value: 8420, delta: 9.3, icon: "receipt", tone: "info" }} />
        <HeroKpi data={{ label: "Menu revenue", value: 80700000, money: true, unit: "UZS", delta: 11.8, icon: "wallet", tone: "success" }} />
      </div>

      {/* treemap + category donut */}
      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Revenue composition</div><h3 className="card__insight">Pizza & Lavash are half of sales</h3></div></div>
          <div className="card__body"><Treemap data={D.categories.slice(0, 6)} height={320} /></div>
        </Card>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Category mix</div><h3 className="card__title">Share of revenue</h3></div></div>
          <div className="card__body"><DonutChart data={D.categories.slice(0, 6)} centerLabel="Categories" size={180} /></div>
        </Card>
      </div>

      {/* frequently bought together — switchable views */}
      <AffinityCard loading={props.loading} />

      {/* pareto + sparkline table */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Pareto analysis</div><h3 className="card__insight">Top 3 products = 58% of revenue</h3></div></div>
          <div className="card__body"><ComboPareto data={D.productPareto} height={300} /></div>
        </Card>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Product trends · 14 days</div><h3 className="card__title">Movers & shakers</h3></div></div>
          <div className="card__divider" />
          <table className="dtable sparktable">
            <thead><tr><th>Product</th><th className="num">Units</th><th>Trend</th><th className="num">Revenue</th><th className="num">Δ</th></tr></thead>
            <tbody>
              {D.productTrends.map((p) => (
                <tr key={p.name}>
                  <td className="cell-strong">{p.name}</td>
                  <td className="num mono">{p.units}</td>
                  <td style={{ width: 110 }}><Sparkline data={p.spark} width={100} height={28} colorByTrend dot={false} /></td>
                  <td className="num mono cell-strong">{Fmt.abbr(p.revenue)}</td>
                  <td className="num"><Delta value={p.delta} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { ProductsDashboard });
