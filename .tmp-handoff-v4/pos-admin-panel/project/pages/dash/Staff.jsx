/* ============================================================
   ALPHA POS — Dashboard 5: Staff & Shifts performance
   ============================================================ */
function StaffDashboard(props) {
  if (props.loading) return <DashLoading rows={3} />;
  const D = window.DASH;
  const staff = D.staff;
  const maxRev = Math.max.apply(null, staff.map((s) => s.revenue));

  const scatter = staff.map((s, i) => ({
    x: s.orders, y: s.revenue, r: 8 + s.aov / 9000,
    label: s.name, color: ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"][i],
  }));
  const radar = {
    axes: ["Speed", "Accuracy", "Upsell", "Attendance", "Volume"],
    series: [
      { label: staff[0].name, color: "var(--c1)", values: [staff[0].speed, staff[0].accuracy, staff[0].upsell, staff[0].attendance, 92] },
      { label: staff[3].name, color: "var(--c2)", values: [staff[3].speed, staff[3].accuracy, staff[3].upsell, staff[3].attendance, 70] },
    ],
  };
  const punctuality = staff.map((s) => ({
    label: s.initials,
    values: { worked: s.hours, overtime: Math.round(s.hours * 0.08), late: Math.round((100 - s.attendance) * 1.2) },
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <HeroKpi data={{ label: "Active staff", value: 10, icon: "users", tone: "primary", sub: "5 on shift now" }} />
        <HeroKpi data={{ label: "Top performer", value: "Ruxsora", icon: "star", tone: "warning", sub: Fmt.abbr(staff[0].revenue) + " · 30d" }} />
        <HeroKpi data={{ label: "Avg accuracy", value: "92%", delta: 1.4, icon: "check", tone: "success" }} />
        <HeroKpi data={{ label: "Total hours (30d)", value: staff.reduce((a, s) => a + s.hours, 0), icon: "clock", tone: "info", sub: "across team" }} />
      </div>

      {/* leaderboard + radar */}
      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Cashier leaderboard · revenue</div><h3 className="card__insight">Ruxsora leads by 18%</h3></div></div>
          <div className="card__body" style={{ paddingTop: 4 }}>
            {staff.map((s, i) => (
              <div key={s.name} className="lb-row">
                <span className={cx("lb-rank", "is-" + (i + 1))}>{i + 1}</span>
                <div className="avatar avatar--sm">{s.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between"><span className="cell-strong" style={{ fontSize: 14 }}>{s.name}</span><span className="mono cell-strong" style={{ fontSize: 13 }}>{Fmt.money(s.revenue)}</span></div>
                  <div className="lb-bar"><div style={{ width: (s.revenue / maxRev * 100) + "%" }} /></div>
                  <div className="row" style={{ gap: 14, marginTop: 5, fontSize: 11, color: "var(--text-tertiary)" }}>
                    <span>{s.orders} orders</span><span>AOV {Fmt.abbr(s.aov)}</span><span>{s.hours}h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Skill profile</div><h3 className="card__title">Top vs steady performer</h3></div></div>
          <div className="card__body"><Radar axes={radar.axes} series={radar.series} max={100} size={300} /></div>
        </Card>
      </div>

      {/* scatter + punctuality */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Orders vs revenue</div><h3 className="card__insight">Bubble size = avg order value</h3></div></div>
          <div className="card__body"><Scatter data={scatter} height={300} xLabel="Orders" yLabel="Revenue" xFormat={(v) => String(Math.round(v))} /></div>
        </Card>
        <Card>
          <div className="card__head"><div className="card__head-text"><div className="kpi__label">Hours & punctuality</div><h3 className="card__title">Worked vs overtime</h3></div></div>
          <div className="card__body">
            <StackedBar data={punctuality} height={300}
              series={[
                { key: "worked", label: "Worked", color: "var(--c1)" },
                { key: "overtime", label: "Overtime", color: "var(--c3)" },
                { key: "late", label: "Late (min)", color: "var(--c5)" },
              ]} yFormat={(v) => String(Math.round(v))} />
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { StaffDashboard });
