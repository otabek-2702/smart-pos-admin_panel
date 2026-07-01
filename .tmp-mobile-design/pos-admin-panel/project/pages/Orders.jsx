/* ============================================================
   ALPHA POS — Orders (data table page)
   filters + chips · sortable/sticky table · expandable rows ·
   selection + bulk actions · inline actions · states
   ============================================================ */
const { useState, useEffect, useMemo } = React;

function OrdersPage(props) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState(DB.orders);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
    if (from && new Date(o.at) < new Date(from)) return false;
    if (to && new Date(o.at) > new Date(to + "T23:59")) return false;
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
    from && { k: "f", label: "From", val: from, clear: () => setFrom("") },
    to && { k: "t", label: "To", val: to, clear: () => setTo("") },
  ].filter(Boolean);
  const clearAll = () => { setQ(""); setStatus(""); setPayment(""); setFrom(""); setTo(""); };

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
    <div>
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

      <Card>
        <div className="toolbar">
          <div className="grow" style={{ maxWidth: 280 }}>
            <Input icon="search" placeholder="Search orders…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ width: 170 }}><Select icon="filter" placeholder="All statuses" value={status} onChange={setStatus} options={["PREPARING", "READY", "COMPLETED", "CANCELLED"]} /></div>
          <div style={{ width: 170 }}><Select placeholder="All payments" value={payment} onChange={setPayment} options={["PAID", "UNPAID"]} /></div>
          <div className="row" style={{ gap: 8, marginLeft: "auto" }}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="control--sm" style={{ width: 150 }} />
            <span className="tertiary">→</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="control--sm" style={{ width: 150 }} />
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

Object.assign(window, { OrdersPage });
