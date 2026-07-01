/* ============================================================
   ALPHA POS — Orders (data table page)
   filters + chips · sortable/sticky table · expandable rows ·
   selection + bulk actions · inline actions · states
   ============================================================ */
const { useState, useEffect, useMemo } = React;

/* compact label for an active period chip */
function rangeLabel(r) {
  const PRE = { today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days", month: "This month", prevmonth: "Last month", year: "This year" };
  if (r.preset && PRE[r.preset]) return PRE[r.preset];
  const f = (s) => { const d = new Date(s); return Fmt.date(d); };
  if (r.from && r.to) return r.from === r.to ? f(r.from) : f(r.from) + " – " + f(r.to);
  if (r.from) return "From " + f(r.from);
  return "All time";
}

function OrdersPage(props) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState(DB.orders);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [range, setRange] = useState({ from: "", to: "", preset: "all" });
  const from = range.from, to = range.to;
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, [props.dateRange]);

  const filtered = useMemo(() => orders.filter((o) => {
    if (q && !("#" + o.id).includes(q.replace("#", "")) && !String(o.id).includes(q)) return false;
    if (status && o.status !== status) return false;
    if (payment && o.payment !== payment) return false;
    if (from && new Date(o.at) < new Date(from + "T00:00")) return false;
    if (to && new Date(o.at) > new Date(to + "T23:59:59")) return false;
    return true;
  }), [orders, q, status, payment, from, to]);

  const markPaid = (ids) => {
    setOrders((os) => os.map((o) => ids.includes(o.id) ? Object.assign({}, o, { payment: "PAID" }) : o));
    toast({ tone: "success", title: ids.length > 1 ? ids.length + " orders marked paid" : "Order #" + ids[0] + " marked paid" });
  };
  const cancelOrders = (ids) => {
    setOrders((os) => os.map((o) => ids.includes(o.id) ? Object.assign({}, o, { status: "CANCELLED" }) : o));
    toast({ tone: "error", title: ids.length > 1 ? ids.length + " orders cancelled" : "Order #" + ids[0] + " cancelled" });
  };

  const activeFilters = [
    q && { k: "q", label: "Search", val: q, clear: () => setQ("") },
    status && { k: "s", label: "Status", val: status, clear: () => setStatus("") },
    payment && { k: "p", label: "Payment", val: payment, clear: () => setPayment("") },
    (from || to) && { k: "d", label: "Period", val: rangeLabel(range), clear: () => setRange({ from: "", to: "", preset: "all" }) },
  ].filter(Boolean);
  const clearAll = () => { setQ(""); setStatus(""); setPayment(""); setRange({ from: "", to: "", preset: "all" }); };

  const columns = [
    { key: "id", label: "Order", sortable: true, render: (o) => <span className="cell-strong mono">#{o.id}</span> },
    { key: "type", label: "Type", render: (o) => <Badge tone={o.type === "DELIVERY" ? "info" : o.type === "PICKUP" ? "primary" : "neutral"}>{o.type}</Badge> },
    { key: "info", label: "Info", render: (o) => <span className="cell-muted">{o.info}</span> },
    { key: "status", label: "Status", sortable: true, render: (o) => <StatusBadge value={o.status} dot /> },
    { key: "payment", label: "Payment", render: (o) => <StatusBadge value={o.payment} /> },
    { key: "total", label: "Total", sortable: true, align: "right", render: (o) => <span className="mono cell-strong">{Fmt.money(o.total)}</span> },
    { key: "items", label: "Items", align: "right", render: (o) => <span className="mono cell-muted">{o.items}</span> },
    { key: "at", label: "Date", sortable: true, align: "right", sortValue: (o) => new Date(o.at).getTime(), render: (o) => <span className="mono cell-muted nowrap">{Fmt.dateTime(o.at)}</span> },
  ];

  const renderExpand = (o) => (
    <div className="row" style={{ gap: "var(--sp-5)", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "2 1 380px", minWidth: 0 }}>
        <div className="kpi__label" style={{ marginBottom: 10 }}>Order items</div>
        <table className="dtable" style={{ background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
          <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Subtotal</th></tr></thead>
          <tbody>
            {o.lines.map((l, i) => (
              <tr key={i}>
                <td className="cell-strong">{l.name}</td>
                <td className="num mono">{l.qty}</td>
                <td className="num mono cell-muted">{Fmt.money(l.price)}</td>
                <td className="num mono cell-strong">{Fmt.money(l.price * l.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {o.payment === "PAID" && (
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <PaymentBreakdown methods={o.methods || [{ type: "Cash", amount: o.total }]} total={o.total} />
        </div>
      )}
    </div>
  );

  const rowActions = (o) => (
    <React.Fragment>
      {o.payment === "UNPAID" && o.status !== "CANCELLED" && <IconAction icon="dollar" tone="success" title="Mark paid" onClick={(e) => { e.stopPropagation(); markPaid([o.id]); }} />}
      {(o.status === "PREPARING" || o.status === "READY") && <IconAction icon="close" tone="danger" title="Cancel order" onClick={(e) => { e.stopPropagation(); cancelOrders([o.id]); }} />}
      <IconAction icon="more" title="More" onClick={(e) => e.stopPropagation()} />
    </React.Fragment>
  );

  const bulkActions = (rows, clear) => {
    const ids = rows.map((r) => r.id);
    return (
      <React.Fragment>
        <Button variant="secondary" size="sm" icon="dollar" onClick={() => { markPaid(ids); clear(); }}>Mark paid</Button>
        <Button variant="danger-soft" size="sm" icon="close" onClick={() => { cancelOrders(ids); clear(); }}>Cancel</Button>
        <Button variant="secondary" size="sm" icon="download" onClick={() => { toast({ tone: "info", title: "Exporting " + ids.length + " orders…" }); clear(); }}>Export</Button>
      </React.Fragment>
    );
  };

  return (
    <div className="page">
      <PageHeader title="Orders" subtitle="Track, settle and reconcile every order"
        actions={<Button variant="primary" icon="download">Export to 1C</Button>} />

      <div className="grid cols-4" style={{ marginBottom: "var(--sp-5)" }}>
        {DB.ordersKpis.map((k) => loading ? <KpiSkel key={k.key} /> : <Kpi key={k.key} data={k} />)}
      </div>

      {!loading && <OrdersInsights orders={DB.orders} status={status} payment={payment} onStatus={setStatus} onPayment={setPayment} />}

      <Card>
        <div className="toolbar">
          <div className="grow" style={{ maxWidth: 280 }}>
            <Input icon="search" placeholder="Search orders…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ width: 170 }}><Select icon="filter" placeholder="All statuses" value={status} onChange={setStatus} options={["PREPARING", "READY", "COMPLETED", "CANCELLED"]} /></div>
          <div style={{ width: 170 }}><Select placeholder="All payments" value={payment} onChange={setPayment} options={["PAID", "UNPAID"]} /></div>
          <div style={{ marginLeft: "auto" }}>
            <DateRangePicker value={range} onChange={setRange} align="right" placeholder="All time" />
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="toolbar" style={{ paddingTop: 0 }}>
            <div className="chips">
              <span className="tertiary" style={{ fontSize: 13, marginRight: 2 }}>Filters:</span>
              {activeFilters.map((f) => (
                <span key={f.k} className="chip"><span>{f.label}: <b>{f.val}</b></span><span className="chip__x" onClick={f.clear}><Icon name="close" size={13} /></span></span>
              ))}
              <button className="chip--clear" onClick={clearAll}>Clear all</button>
            </div>
          </div>
        )}
        <div className="card__divider" />

        <DataTable
          columns={columns}
          rows={filtered}
          getRowId={(o) => o.id}
          loading={loading}
          selectable
          renderExpand={renderExpand}
          rowActions={rowActions}
          bulkActions={bulkActions}
          initialSort={{ key: "id", dir: "desc" }}
          emptyState={<StateFill icon="receipt" title="No orders match your filters"
            sub="Adjust the search, status or date range to see results."
            action={<div style={{ marginTop: 12 }}><Button variant="secondary" onClick={clearAll}>Clear filters</Button></div>} />}
        />
      </Card>
    </div>
  );
}

/* ---- Interactive insights strip: clickable status distribution + payment + hourly ---- */
function OrdersInsights(props) {
  const orders = props.orders;
  const STATUSES = [
    { key: "PREPARING", label: "Preparing", color: "var(--warning)", tone: "warning" },
    { key: "READY", label: "Ready", color: "var(--success)", tone: "success" },
    { key: "COMPLETED", label: "Completed", color: "var(--primary)", tone: "primary" },
    { key: "CANCELLED", label: "Cancelled", color: "var(--error)", tone: "error" },
  ];
  const counts = {}; STATUSES.forEach((s) => counts[s.key] = 0);
  let paid = 0, unpaid = 0, revenue = 0;
  orders.forEach((o) => {
    if (counts[o.status] !== undefined) counts[o.status] += 1;
    if (o.payment === "PAID") { paid += 1; revenue += o.total; } else unpaid += 1;
  });
  const total = orders.length || 1;
  const paidPct = Math.round(paid / total * 100);

  // hourly distribution
  const byHour = {};
  orders.forEach((o) => { const h = new Date(o.at).getHours(); byHour[h] = (byHour[h] || 0) + 1; });
  const hours = []; for (let h = 11; h <= 22; h++) hours.push(byHour[h] || 0);

  return (
    <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr 1fr", marginBottom: "var(--sp-5)", gap: "var(--sp-5)" }}>
      {/* status distribution — clickable to filter */}
      <Card style={{ padding: "var(--sp-5)" }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <span className="kpi__label">Status distribution</span>
          <span className="tertiary" style={{ fontSize: 12 }}>click to filter</span>
        </div>
        <div className="distbar">
          {STATUSES.map((s) => {
            const pct = counts[s.key] / total * 100;
            if (pct === 0) return null;
            const active = props.status === s.key;
            return (
              <div key={s.key} className={cx("distbar__seg", props.status && !active && "is-dim")}
                style={{ width: pct + "%", background: s.color }}
                title={s.label + ": " + counts[s.key]}
                onClick={() => props.onStatus(active ? "" : s.key)} />
            );
          })}
        </div>
        <div className="row wrap" style={{ gap: 14, marginTop: 14 }}>
          {STATUSES.map((s) => {
            const active = props.status === s.key;
            return (
              <button key={s.key} className={cx("distlegend", active && "is-active")} onClick={() => props.onStatus(active ? "" : s.key)}>
                <span className="legend-swatch" style={{ background: s.color }} />
                <span>{s.label}</span>
                <b className="mono">{counts[s.key]}</b>
              </button>
            );
          })}
        </div>
      </Card>

      {/* payment split — ring */}
      <Card style={{ padding: "var(--sp-5)" }}>
        <div className="kpi__label" style={{ marginBottom: 8 }}>Payment status</div>
        <div className="row" style={{ gap: 16, alignItems: "center" }}>
          <ProgressRing value={paidPct} color="var(--success)" size={84} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <button className={cx("distlegend", props.payment === "PAID" && "is-active")} style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => props.onPayment(props.payment === "PAID" ? "" : "PAID")}>
              <span className="legend-swatch" style={{ background: "var(--success)" }} /><span>Paid</span><b className="mono" style={{ marginLeft: "auto" }}>{paid}</b>
            </button>
            <button className={cx("distlegend", props.payment === "UNPAID" && "is-active")} style={{ width: "100%", justifyContent: "flex-start", marginTop: 4 }} onClick={() => props.onPayment(props.payment === "UNPAID" ? "" : "UNPAID")}>
              <span className="legend-swatch" style={{ background: "var(--error)" }} /><span>Unpaid</span><b className="mono" style={{ marginLeft: "auto" }}>{unpaid}</b>
            </button>
          </div>
        </div>
      </Card>

      {/* hourly mini bars */}
      <Card style={{ padding: "var(--sp-5)" }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <span className="kpi__label">Orders by hour</span>
          <span className="badge t-neutral">11:00–22:00</span>
        </div>
        <MiniBars data={hours} labels={["11","","13","","15","","17","","19","","21",""]} />
      </Card>
    </div>
  );
}

/* tiny inline bar chart */
function MiniBars(props) {
  const shown = window.useShown ? useShown(80) : true;
  const data = props.data, max = Math.max.apply(null, data) || 1;
  const peak = data.indexOf(max);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 64 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }} title={(11 + i) + ":00 · " + v + " orders"}>
          <div style={{ width: "100%", height: (shown ? (v / max) * 46 : 0) + "px", minHeight: 2, borderRadius: 3, background: i === peak ? "var(--chart-revenue)" : "var(--c4)", transition: "height .5s cubic-bezier(.2,.8,.2,1) " + (i * 0.025) + "s" }} />
          <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{props.labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* Payment breakdown — splits a (possibly mixed) payment into method rows with amounts */
function PaymentBreakdown(props) {
  const methods = props.methods || [];
  const total = props.total || methods.reduce((a, m) => a + m.amount, 0);
  const TONE = { Cash: "var(--c2)", Uzcard: "var(--c1)", Humo: "var(--c4)", Payme: "var(--c3)", Click: "var(--c5)", Card: "var(--c1)" };
  const mixed = methods.length > 1;
  return (
    <div className="paybreak">
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="kpi__label">Payment {mixed && <span className="badge t-primary" style={{ marginLeft: 6 }}>Mixed · {methods.length}</span>}</span>
        <span className="mono cell-strong" style={{ fontSize: 13 }}>{Fmt.money(total)}</span>
      </div>
      <div className="paybreak__bar">
        {methods.map((m, i) => (
          <div key={i} className="paybreak__seg" style={{ width: (m.amount / total * 100) + "%", background: TONE[m.type] || "var(--c5)" }} title={m.type} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
        {methods.map((m, i) => (
          <div key={i} className="row between">
            <span className="legend-item"><span className="legend-swatch" style={{ background: TONE[m.type] || "var(--c5)" }} />{m.type}</span>
            <span className="row" style={{ gap: 8 }}>
              <span className="mono cell-strong" style={{ fontSize: 13 }}>{Fmt.money(m.amount)}</span>
              <span className="tertiary mono" style={{ fontSize: 11, width: 34, textAlign: "right" }}>{Math.round(m.amount / total * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { OrdersPage, OrdersInsights, MiniBars, PaymentBreakdown });