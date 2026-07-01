/* ============================================================
   ALPHA POS — app shell: sidebar, topbar, page header,
   global date range, theme toggle, router
   ============================================================ */
const { useState, useEffect, useRef } = React;


/* ---------- Shared page header ---------- */
function PageHeader(props) {
  return (
    <div className="page__head">
      <div style={{ minWidth: 0 }}>
        <h1 className="page__title">{props.title}</h1>
        {props.subtitle && <div className="page__subtitle">{props.subtitle}</div>}
      </div>
      {props.actions && <div className="page__head-actions">{props.actions}</div>}
    </div>
  );
}

/* ---------- Chart card (insight-led title) ---------- */
function ChartCard(props) {
  return (
    <Card className={props.className} style={props.style}>
      <div className="card__head">
        <div className="card__head-text">
          {props.eyebrow && <div className="kpi__label" style={{ marginBottom: 3 }}>{props.eyebrow}</div>}
          {props.insight ? <h3 className="card__insight">{props.insight}</h3> : <h3 className="card__title">{props.title}</h3>}
          {props.sub && <div className="card__sub">{props.sub}</div>}
        </div>
        {props.actions && <div className="card__actions">{props.actions}</div>}
      </div>
      <div className="card__body">{props.children}</div>
    </Card>
  );
}

/* ---------- Global date range ---------- */
const DATE_PRESETS = [
  { value: "today", label: "Today", range: "13 Jun 2026" },
  { value: "7d", label: "Last 7 days", range: "7–13 Jun 2026" },
  { value: "14d", label: "Last 14 days", range: "31 May – 13 Jun 2026" },
  { value: "month", label: "This month", range: "1–13 Jun 2026" },
  { value: "prev", label: "Last month", range: "1–31 May 2026" },
];
function DateRange(props) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = DATE_PRESETS.find((p) => p.value === props.value) || DATE_PRESETS[2];
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="btn btn--secondary" onClick={() => setOpen((o) => !o)} style={{ gap: 10 }}>
        <Icon name="calendar" size={18} />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600 }}>{cur.label}</span>
          <span style={{ fontSize: 13 }}>{cur.range}</span>
        </span>
        <Icon name="chevdown" size={16} style={{ color: "var(--text-tertiary)" }} />
      </button>
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 240, zIndex: 40, boxShadow: "var(--shadow-lg)", padding: 6 }}>
          {DATE_PRESETS.map((p) => (
            <div key={p.value} className={cx("nav-item", p.value === cur.value && "is-active")} style={{ borderRadius: 8 }}
              onClick={() => { props.onChange(p.value); setOpen(false); }}>
              <span style={{ flex: 1 }}>{p.label}</span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{p.range.length > 14 ? "" : p.range}</span>
              {p.value === cur.value && <Icon name="check" size={16} />}
            </div>
          ))}
          <div className="hr" style={{ margin: "6px 0" }} />
          <div className="nav-item" style={{ borderRadius: 8, color: "var(--text-secondary)" }} onClick={() => setOpen(false)}>
            <Icon name="calendar" size={18} /><span>Custom range…</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Navigation model ---------- */
const NAV = [
  { type: "item", id: "design", label: "Design System", icon: "sliders", live: true },
  { type: "item", id: "dashboard", label: "Dashboard", icon: "dashboard", live: true },
  { type: "item", id: "analytics", label: "Analytics", icon: "chart", live: true },
  { type: "item", id: "ai", label: "AI Assistant", icon: "ai" },
  { type: "item", id: "shifts", label: "Shifts", icon: "clock", live: true, badge: "2" },
  { type: "section", label: "Management" },
  { type: "item", id: "users", label: "Users", icon: "users", live: true },
  { type: "item", id: "categories", label: "Categories", icon: "grid" },
  { type: "item", id: "products", label: "Products", icon: "box", badge: "316" },
  { type: "item", id: "orders", label: "Orders", icon: "receipt", live: true, badge: "5" },
  { type: "item", id: "places", label: "Places & Tables", icon: "table" },
  { type: "item", id: "discounts", label: "Discounts", icon: "tag" },
  { type: "item", id: "cash", label: "Cash Register", icon: "register" },
  { type: "item", id: "treasury", label: "Treasury", icon: "store" },
  { type: "item", id: "loyalty", label: "Loyalty", icon: "gift" },
  { type: "section", label: "HR" },
  { type: "item", id: "employees", label: "Employees", icon: "employee" },
  { type: "item", id: "departments", label: "Departments", icon: "dept" },
  { type: "item", id: "salaries", label: "Salaries", icon: "coins" },
];

function Sidebar(props) {
  return (
    <aside className={cx("sidebar", props.collapsed && "is-collapsed")}>
      <div className="sidebar__brand">
        <div className="sidebar__logo"><Icon name="store" size={19} weight={2} /></div>
        {!props.collapsed && <div className="sidebar__name">Alpha<span> POS</span></div>}
      </div>
      <nav className="sidebar__nav">
        {NAV.map((n, i) => {
          if (n.type === "section") return props.collapsed
            ? <div key={i} className="hr" style={{ margin: "10px 8px" }} />
            : <div key={i} className="nav-section">{n.label}</div>;
          return (
            <div key={n.id} className={cx("nav-item", props.route === n.id && "is-active")}
              title={props.collapsed ? n.label : ""}
              onClick={() => props.onNav(n.id)}>
              <span className="nav-item__icon"><Icon name={n.icon} size={20} /></span>
              {!props.collapsed && <span style={{ flex: 1 }}>{n.label}</span>}
              {!props.collapsed && n.badge && <span className="nav-item__badge">{n.badge}</span>}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function Topbar(props) {
  const navItem = NAV.find((n) => n.id === props.route);
  return (
    <header className="topbar">
      <button className="iconbtn" onClick={props.onToggleSidebar} title="Toggle sidebar"><Icon name="layout" size={18} /></button>
      <div className="topbar__crumbs">
        <span>Alpha POS</span><Icon name="chevright" size={14} /><b>{navItem ? navItem.label : ""}</b>
      </div>
      <div className="topbar__spacer" />
      {props.showDate && <DateRange value={props.dateRange} onChange={props.onDateRange} />}
      <button className="iconbtn" onClick={props.onToggleTheme} title="Toggle theme">
        <Icon name={props.theme === "dark" ? "sun" : "moon"} size={18} />
      </button>
      <button className="iconbtn" title="Notifications"><Icon name="bell" size={18} /><span className="iconbtn__dot" /></button>
      <div className="avatar" title="Reese Lewis">RL</div>
    </header>
  );
}

/* ---------- Placeholder for non-prototyped screens ---------- */
function PlaceholderPage(props) {
  const item = NAV.find((n) => n.id === props.route);
  return (
    <div className="page">
      <PageHeader title={item ? item.label : "Screen"} subtitle="Part of the live product — not included in this redesign prototype." />
      <Card>
        <StateFill icon={item ? item.icon : "layout"} title={(item ? item.label : "This screen") + " uses the same design system"}
          sub="The redesign covers Dashboard, Analytics, Orders and Users this round. Every other module inherits the same tokens, nav, header and component styles shown here."
          action={<div style={{ marginTop: 12 }}><Button variant="secondary" icon="arrowup" onClick={() => props.onNav("dashboard")}>Back to Dashboard</Button></div>}
          style={{ padding: "64px 24px" }} />
      </Card>
    </div>
  );
}

/* ---------- App ---------- */
function App() {
  const [route, setRoute] = useState("design");
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "light");
  const [dateRange, setDateRange] = useState("14d");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("alphapos-theme", theme); } catch (e) {}
  }, [theme]);

  // Replay the page entrance transition on first load and every route change.
  useEffect(() => { if (window.replayMotion) window.replayMotion(); }, [route]);

  const PAGES = {
    design: window.DesignSystemPage,
    dashboard: window.DashboardPage,
    analytics: window.AnalyticsPage,
    orders: window.OrdersPage,
    users: window.UsersPage,
    shifts: window.ShiftsPage,
  };
  const Page = PAGES[route];
  const showDate = route === "dashboard" || route === "analytics" || route === "orders" || route === "shifts";

  return (
    <div className="app">
      <Sidebar route={route} collapsed={collapsed} onNav={setRoute} />
      <div className="main">
        <Topbar route={route} theme={theme} onToggleTheme={() => setTheme((t) => t === "dark" ? "light" : "dark")}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          showDate={showDate} dateRange={dateRange} onDateRange={setDateRange} />
        <main style={{ flex: 1 }}>
          {Page ? <Page dateRange={dateRange} onNav={setRoute} /> : <PlaceholderPage route={route} onNav={setRoute} />}
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { PageHeader, ChartCard, DateRange, Sidebar, Topbar, App, NAV });
