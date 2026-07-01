/* ============================================================
   ALPHA POS — Dashboards hub (5 switchable dashboard views)
   Replaces the single old dashboard. Tabbed, animated, with a
   shared header, date range, refresh, and per-view loading.
   ============================================================ */
const { useState, useEffect, useRef } = React;

const DASH_VIEWS = [
  { id: "exec", label: "Overview", icon: "dashboard", Comp: () => window.ExecutiveDashboard },
  { id: "sales", label: "Sales & Revenue", icon: "trend", Comp: () => window.SalesDashboard },
  { id: "ops", label: "Operations", icon: "clock", Comp: () => window.OperationsDashboard },
  { id: "products", label: "Products", icon: "box", Comp: () => window.ProductsDashboard },
  { id: "staff", label: "Staff & Shifts", icon: "users", Comp: () => window.StaffDashboard },
];

function DashboardPage(props) {
  const [view, setView] = useState(() => { try { return localStorage.getItem("alphapos-dashview") || "exec"; } catch (e) { return "exec"; } });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "", preset: "30d" });
  const toast = useToast();

  useEffect(() => { try { localStorage.setItem("alphapos-dashview", view); } catch (e) {} }, [view]);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 520);
    return () => clearTimeout(t);
  }, [view, dateRange]);

  // replay entrance animation when switching view
  useEffect(() => { if (window.replayMotion) window.replayMotion(); }, [view]);

  const cur = DASH_VIEWS.find((v) => v.id === view) || DASH_VIEWS[0];
  const Comp = cur.Comp();

  const refresh = () => { setLoading(true); setTimeout(() => { setLoading(false); toast({ tone: "success", title: "Dashboard refreshed", msg: "Updated " + Fmt.dateTime(new Date()) }); }, 600); };

  return (
    <div className="page">
      <div className="page__head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page__title">Dashboards</h1>
          <div className="page__subtitle">{dashSubtitle(view)}</div>
        </div>
        <div className="page__head-actions">
          <DateRangePicker value={dateRange} onChange={setDateRange} align="right" placeholder="Last 30 days" />
          <Button variant="secondary" icon="refresh" onClick={refresh} loading={loading}>Refresh</Button>
          <Button variant="primary" icon="download">Export</Button>
        </div>
      </div>

      {/* view switcher */}
      <div className="dashtabs" style={{ marginBottom: "var(--sp-6)" }}>
        {DASH_VIEWS.map((v) => (
          <button key={v.id} className={cx("dashtab", view === v.id && "is-active")} onClick={() => setView(v.id)}>
            <Icon name={v.icon} size={17} /><span>{v.label}</span>
          </button>
        ))}
      </div>

      {Comp ? <Comp loading={loading} /> : <DashLoading />}
    </div>
  );
}

function dashSubtitle(view) {
  return {
    exec: "Executive snapshot · the headline numbers at a glance",
    sales: "Revenue, margins and where sales come from",
    ops: "Live operations · orders, kitchen and floor",
    products: "Menu performance · what sells and what doesn't",
    staff: "Team performance · cashiers and shifts",
  }[view] || "";
}

Object.assign(window, { DashboardPage });
