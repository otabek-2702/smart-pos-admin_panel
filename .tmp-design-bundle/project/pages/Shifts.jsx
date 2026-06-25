/* ============================================================
   ALPHA POS — Shifts (daily cash handover / reconciliation)
   The manager's everyday job: receive cash from each cashier,
   count it, and record over/short variance.
   ============================================================ */
const { useState, useEffect, useMemo } = React;

function shiftState(s) { return s.status === "ACTIVE" ? "active" : s.reconciled ? "reconciled" : "awaiting"; }

function VarPill(props) {
  const v = props.value;
  if (v === null || v === undefined) return null;
  const tone = v === 0 ? "neutral" : v > 0 ? "success" : "error";
  const word = v === 0 ? "Exact" : v > 0 ? "Over" : "Short";
  return <Badge tone={tone}>{word} {v === 0 ? "" : (v > 0 ? "+" : "−") + Fmt.num(Math.abs(v))}</Badge>;
}

function MiniStat(props) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="kpi__label" style={{ marginBottom: 3 }}>{props.label}</div>
      <div className="mono" style={{ fontWeight: 700, fontSize: props.big ? 20 : 16, letterSpacing: "-0.02em", color: props.color || "var(--text)" }}>{props.value}</div>
    </div>
  );
}

function PayRow(props) {
  return (
    <div className="row between" style={{ padding: "5px 0" }}>
      <span className="row" style={{ gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
        {props.icon && <Icon name={props.icon} size={15} style={{ color: props.color || "var(--text-tertiary)" }} />}{props.label}
      </span>
      <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: props.valueColor }}>{props.value}</span>
    </div>
  );
}

/* ---------- Receive cash modal ---------- */
function ReceiveCashModal(props) {
  const s = props.shift;
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = counted === "" ? null : Number(String(counted).replace(/[^\d-]/g, ""));
  const variance = parsed === null ? null : parsed - s.expectedCash;

  return (
    <Modal title={"Receive cash · " + s.cashier} subtitle={"Shift #" + s.id + " · count the drawer and confirm the handover"}
      width={520} onClose={props.onClose}
      footer={<React.Fragment>
        <Button variant="ghost" onClick={props.onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" icon="check" loading={busy} disabled={parsed === null}
          onClick={() => { setBusy(true); setTimeout(() => props.onConfirm(parsed, variance, note), 700); }}>Confirm handover</Button>
      </React.Fragment>}>
      {/* expected breakdown */}
      <div style={{ background: "var(--surface-inset)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>
        <PayRow label="Cash sales" value={Fmt.money(s.cash)} icon="coins" color="var(--success)" />
        <PayRow label="Cash expenses paid" value={"− " + Fmt.money(s.expenses)} icon="receipt" valueColor="var(--text-secondary)" />
        <div className="hr" style={{ margin: "8px 0" }} />
        <div className="row between">
          <span style={{ fontWeight: 600, fontSize: 14 }}>Expected in drawer</span>
          <span className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{Fmt.money(s.expectedCash)} <span className="tertiary" style={{ fontSize: 12 }}>UZS</span></span>
        </div>
      </div>

      <Field label="Counted cash (UZS)" hint="Enter the amount you physically counted from the till.">
        <Input inputMode="numeric" placeholder="e.g. 1 301 000" value={counted} icon="wallet"
          onChange={(e) => setCounted(e.target.value)} autoFocus />
      </Field>

      {/* live variance */}
      <div className="row between" style={{ marginTop: 14, padding: "12px 14px", borderRadius: "var(--r-md)",
        background: variance === null ? "var(--surface-2)" : variance === 0 ? "var(--neutral-weak)" : variance > 0 ? "var(--success-weak)" : "var(--error-weak)",
        border: "1px solid " + (variance === null ? "var(--border)" : variance === 0 ? "var(--neutral-border)" : variance > 0 ? "var(--success-border)" : "var(--error-border)") }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Variance</span>
        {variance === null ? <span className="tertiary">Enter counted amount</span>
          : <span className="row" style={{ gap: 10 }}>
              <span className="mono" style={{ fontWeight: 700, fontSize: 16, color: variance === 0 ? "var(--text)" : variance > 0 ? "var(--success)" : "var(--error)" }}>
                {variance > 0 ? "+" : variance < 0 ? "−" : ""}{Fmt.money(Math.abs(variance))}
              </span>
              <VarPill value={variance} />
            </span>}
      </div>

      <Field label="Note (optional)" className="span-2" style={{ marginTop: 16 }}>
        <textarea className="control" placeholder="Reason for any difference, deposits, etc." value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

/* ---------- Shift card ---------- */
function ShiftCard(props) {
  const s = props.shift;
  const st = shiftState(s);
  const badge = st === "active" ? <Badge tone="success" dot>ACTIVE</Badge>
    : st === "awaiting" ? <Badge tone="warning" dot>AWAITING CASH</Badge>
    : <Badge tone="neutral"><Icon name="checkcircle" size={13} />RECONCILED</Badge>;

  return (
    <Card style={{ display: "flex", flexDirection: "column", borderColor: st === "awaiting" ? "var(--warning-border)" : "var(--border)" }}>
      {/* header */}
      <div className="row" style={{ gap: 12, padding: "var(--sp-5) var(--sp-5) var(--sp-4)" }}>
        <div className="avatar">{s.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{s.cashier}</div>
          <div className="tertiary" style={{ fontSize: 12 }}>Shift #{s.id} · {s.template}</div>
        </div>
        {badge}
      </div>

      {/* time strip */}
      <div className="row between" style={{ margin: "0 var(--sp-5)", padding: "9px 12px", background: "var(--surface-inset)", borderRadius: "var(--r-sm)", fontSize: 13 }}>
        <span className="row" style={{ gap: 7 }}>
          <span className="mono">{Fmt.dateTime(s.start)}</span>
          <Icon name="chevright" size={14} className="tertiary" />
          <span className="mono" style={{ color: s.end ? "var(--text)" : "var(--success)", fontWeight: s.end ? 400 : 600 }}>{s.end ? Fmt.dateTime(s.end) : "running"}</span>
        </span>
        <span className="badge t-neutral"><Icon name="clock" size={13} />{s.durationLabel}</span>
      </div>

      {/* sales stats */}
      <div className="row" style={{ gap: 0, padding: "var(--sp-4) var(--sp-5) var(--sp-3)" }}>
        <MiniStat label="Orders" value={Fmt.num(s.orders)} />
        <MiniStat label="Gross" value={Fmt.money(s.gross)} big />
        <MiniStat label="Net" value={Fmt.money(s.net)} big color="var(--success)" />
      </div>

      <div className="card__divider" />

      {/* reconciliation block — the hero */}
      <div style={{ padding: "var(--sp-4) var(--sp-5)", flex: 1 }}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <span className="kpi__label">{st === "reconciled" ? "Cash received" : "Cash to receive"}</span>
          {st === "reconciled" && <VarPill value={s.variance} />}
        </div>
        <div className="row between" style={{ alignItems: "flex-end", marginBottom: 12 }}>
          <span className="mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>
            {Fmt.money(st === "reconciled" ? s.reported : s.expectedCash)}<span className="tertiary" style={{ fontSize: 12, fontWeight: 500 }}> UZS</span>
          </span>
        </div>
        <PayRow label="Cash sales" value={Fmt.money(s.cash)} icon="coins" color="var(--success)" />
        <PayRow label="Card / digital" value={Fmt.money(s.card)} icon="register" color="var(--info)" />
        <PayRow label="Expenses" value={"− " + Fmt.money(s.expenses)} icon="receipt" />
        <PayRow label={"Cancelled · " + s.cancelled} value={s.cancelledAmount ? "− " + Fmt.money(s.cancelledAmount) : "—"} icon="close" />
        {st === "reconciled" && (
          <div className="row between" style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border-strong)", fontSize: 12 }}>
            <span className="tertiary">Counted {Fmt.money(s.reported)} · received by {s.reportedBy}</span>
          </div>
        )}
      </div>

      {/* footer meta + actions */}
      <div style={{ padding: "0 var(--sp-5) var(--sp-3)" }}>
        <div className="row wrap" style={{ gap: 14, fontSize: 11, color: "var(--text-tertiary)", paddingBottom: 12 }}>
          <span>Avg ticket <b className="mono" style={{ color: "var(--text-secondary)" }}>{Fmt.abbr(s.avgTicket)}</b></span>
          <span>Items <b className="mono" style={{ color: "var(--text-secondary)" }}>{s.items}</b></span>
          <span>Avg prep <b style={{ color: "var(--text-secondary)" }}>{s.avgPrep}</b></span>
          <span>Peak <b style={{ color: "var(--text-secondary)" }}>{s.peak}</b></span>
        </div>
      </div>
      <div className="row" style={{ gap: 8, padding: "var(--sp-4) var(--sp-5)", borderTop: "1px solid var(--border)", background: "var(--surface-2)", borderRadius: "0 0 var(--r-lg) var(--r-lg)" }}>
        {st === "active" && <React.Fragment>
          <Button variant="secondary" icon="chart" onClick={() => props.onNav("analytics")} style={{ flex: 1 }}>Live report</Button>
          <Button variant="ghost" icon="clock" onClick={() => props.onEnd(s)}>End shift</Button>
        </React.Fragment>}
        {st === "awaiting" && <React.Fragment>
          <Button variant="primary" icon="dollar" onClick={() => props.onReceive(s)} style={{ flex: 1 }}>Receive cash</Button>
          <Button variant="secondary" icon="chart" onClick={() => props.onNav("analytics")}>Report</Button>
        </React.Fragment>}
        {st === "reconciled" && <React.Fragment>
          <div className="row" style={{ gap: 7, flex: 1, color: "var(--success)", fontWeight: 600, fontSize: 13 }}><Icon name="checkcircle" size={17} />Handover complete</div>
          <Button variant="ghost" icon="chart" onClick={() => props.onNav("analytics")}>Report</Button>
        </React.Fragment>}
      </div>
    </Card>
  );
}

function ShiftCardSkel() {
  return (
    <Card style={{ padding: "var(--sp-5)" }}>
      <div className="row" style={{ gap: 12, marginBottom: 16 }}><Skeleton w={40} h={40} style={{ borderRadius: 99 }} /><div style={{ flex: 1 }}><Skeleton w={120} h={14} /><Skeleton w={80} h={11} style={{ marginTop: 6 }} /></div><Skeleton w={90} h={22} style={{ borderRadius: 6 }} /></div>
      <Skeleton h={38} style={{ marginBottom: 16 }} />
      <Skeleton h={56} style={{ marginBottom: 16 }} />
      <Skeleton h={70} style={{ marginBottom: 16 }} />
      <Skeleton h={40} />
    </Card>
  );
}

function ShiftsPage(props) {
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState(DB.shiftsList);
  const [cashier, setCashier] = useState("");
  const [statusF, setStatusF] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [receiving, setReceiving] = useState(null);
  const toast = useToast();

  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, [props.dateRange]);

  const filtered = useMemo(() => shifts.filter((s) => {
    if (cashier && s.cashier !== cashier) return false;
    if (liveOnly && !s.live) return false;
    if (statusF) {
      const st = shiftState(s);
      if (statusF === "Active" && st !== "active") return false;
      if (statusF === "Awaiting cash" && st !== "awaiting") return false;
      if (statusF === "Reconciled" && st !== "reconciled") return false;
    }
    if (from && new Date(s.start) < new Date(from)) return false;
    if (to && new Date(s.start) > new Date(to + "T23:59")) return false;
    return true;
  }), [shifts, cashier, statusF, liveOnly, from, to]);

  // summary
  const activeCount = shifts.filter((s) => shiftState(s) === "active").length;
  const awaiting = shifts.filter((s) => shiftState(s) === "awaiting");
  const cashToReceive = awaiting.reduce((a, s) => a + s.expectedCash, 0);
  const netVariance = shifts.filter((s) => s.reconciled).reduce((a, s) => a + (s.variance || 0), 0);
  const grossRange = shifts.reduce((a, s) => a + s.gross, 0);

  const confirmReceive = (counted, variance) => {
    setShifts((ss) => ss.map((x) => x.id === receiving.id ? Object.assign({}, x, { reconciled: true, reported: counted, variance: variance, reportedBy: "Reese Lewis" }) : x));
    toast({ tone: variance === 0 ? "success" : Math.abs(variance) > 0 ? (variance > 0 ? "info" : "warning") : "success",
      title: "Cash received from " + receiving.cashier,
      msg: Fmt.money(counted) + " UZS counted · " + (variance === 0 ? "exact match" : (variance > 0 ? "over by " : "short by ") + Fmt.money(Math.abs(variance))) });
    setReceiving(null);
  };
  const endShift = (s) => {
    setShifts((ss) => ss.map((x) => x.id === s.id ? Object.assign({}, x, { status: "COMPLETED", live: false, end: "2026-06-13T19:38:00" }) : x));
    toast({ tone: "info", title: s.cashier + "'s shift ended", msg: "Now awaiting cash handover." });
  };

  const activeFilters = [
    cashier && { k: "c", label: "Cashier", val: cashier, clear: () => setCashier("") },
    statusF && { k: "s", label: "Status", val: statusF, clear: () => setStatusF("") },
    liveOnly && { k: "l", label: "Live only", val: "On", clear: () => setLiveOnly(false) },
    from && { k: "f", label: "From", val: from, clear: () => setFrom("") },
    to && { k: "t", label: "To", val: to, clear: () => setTo("") },
  ].filter(Boolean);
  const clearAll = () => { setCashier(""); setStatusF(""); setLiveOnly(false); setFrom(""); setTo(""); };

  return (
    <div className="page">
      <PageHeader title="Shifts" subtitle="Reconcile cashiers and receive end-of-shift cash"
        actions={<Button variant="secondary" icon="download">Export</Button>} />

      {/* summary KPIs */}
      <div className="grid cols-4" style={{ marginBottom: "var(--sp-5)" }}>
        {loading ? [0,1,2,3].map((i) => <KpiSkel key={i} />) : (<React.Fragment>
          <Kpi data={{ label: "Active now", value: activeCount, tone: "info", icon: "clock", sub: "live shifts" }} />
          <Kpi data={{ label: "Awaiting cash", value: awaiting.length, tone: "warning", icon: "wallet", sub: "to reconcile" }} />
          <Kpi data={{ label: "Cash to receive", value: cashToReceive, money: true, tone: "primary", icon: "coins", sub: "across " + awaiting.length + " shifts" }} />
          <Kpi data={{ label: "Net variance", value: (netVariance >= 0 ? "+" : "−") + Fmt.abbr(Math.abs(netVariance)), tone: netVariance < 0 ? "error" : "success", icon: "trend", sub: "reconciled today" }} />
        </React.Fragment>)}
      </div>

      {/* filter toolbar */}
      <Card style={{ marginBottom: "var(--sp-5)" }}>
        <div className="toolbar">
          <div style={{ width: 190 }}><Select icon="user" placeholder="All cashiers" value={cashier} onChange={setCashier} options={DB.cashiers} /></div>
          <div style={{ width: 180 }}><Select icon="filter" placeholder="All statuses" value={statusF} onChange={setStatusF} options={["Active", "Awaiting cash", "Reconciled"]} /></div>
          <div className="row" style={{ gap: 8 }}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="control--sm" style={{ width: 150 }} />
            <span className="tertiary">→</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="control--sm" style={{ width: 150 }} />
          </div>
          <div className="row" style={{ gap: 10, marginLeft: "auto" }}>
            <span className="row" style={{ gap: 8, fontSize: 14, fontWeight: 500 }}><Switch checked={liveOnly} onChange={setLiveOnly} />Live only</span>
          </div>
        </div>
        {activeFilters.length > 0 && (
          <div className="toolbar" style={{ paddingTop: 0 }}>
            <div className="chips">
              <span className="tertiary" style={{ fontSize: 13, marginRight: 2 }}>Filters:</span>
              {activeFilters.map((f) => <span key={f.k} className="chip"><span>{f.label}: <b>{f.val}</b></span><span className="chip__x" onClick={f.clear}><Icon name="close" size={13} /></span></span>)}
              <button className="chip--clear" onClick={clearAll}>Clear all</button>
            </div>
          </div>
        )}
      </Card>

      {/* cards */}
      {loading ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))" }}>{[0,1,2].map((i) => <ShiftCardSkel key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <Card><StateFill icon="clock" title="No shifts match your filters" sub="Adjust the cashier, status or date range."
          action={<div style={{ marginTop: 12 }}><Button variant="secondary" onClick={clearAll}>Clear filters</Button></div>} /></Card>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))", alignItems: "start" }}>
          {filtered.map((s) => <ShiftCard key={s.id} shift={s} onReceive={setReceiving} onEnd={endShift} onNav={props.onNav} />)}
        </div>
      )}

      {receiving && <ReceiveCashModal shift={receiving} onClose={() => setReceiving(null)} onConfirm={confirmReceive} />}
    </div>
  );
}

Object.assign(window, { ShiftsPage });
