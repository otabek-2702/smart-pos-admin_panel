/* ============================================================
   ALPHA POS — DateRangePicker (reusable)
   Modern, minimal range calendar: preset rail + dual-month grid,
   click-start → hover-preview → click-end range selection.
   value: { from: "YYYY-MM-DD"|"", to: "YYYY-MM-DD"|"", preset?: string }
   onChange(value) fires on Apply.
   Drop <DateRangePicker value={range} onChange={setRange} /> anywhere.
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;

/* ---- local-date helpers (no timezone drift) ---- */
function ymd(d) { const p = (n) => (n < 10 ? "0" + n : "" + n); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
function parseYmd(s) { if (!s) return null; const m = String(s).split("-"); if (m.length < 3) return null; const d = new Date(+m[0], +m[1] - 1, +m[2]); return isNaN(d) ? null : d; }
function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function isBetween(d, a, b) { const t = startOfDay(d).getTime(); return t > Math.min(a, b) && t < Math.max(a, b); }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/* ---- presets (return {from,to} as Date or null/null for "all time") ---- */
function presetRange(key, today) {
  const t = startOfDay(today);
  switch (key) {
    case "today": return [t, t];
    case "yesterday": { const y = addDays(t, -1); return [y, y]; }
    case "7d": return [addDays(t, -6), t];
    case "30d": return [addDays(t, -29), t];
    case "month": return [new Date(t.getFullYear(), t.getMonth(), 1), t];
    case "prevmonth": { const s = new Date(t.getFullYear(), t.getMonth() - 1, 1); const e = new Date(t.getFullYear(), t.getMonth(), 0); return [s, e]; }
    case "year": return [new Date(t.getFullYear(), 0, 1), t];
    case "all": return [null, null];
    default: return [null, null];
  }
}
const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "prevmonth", label: "Last month" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

function fmtShort(d) { return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getFullYear(); }

function matchPreset(from, to, today) {
  if (!from && !to) return "all";
  for (const p of PRESETS) {
    if (p.key === "all") continue;
    const [a, b] = presetRange(p.key, today);
    if (a && b && from && to && sameDay(from, a) && sameDay(to, b)) return p.key;
  }
  return null;
}

/* ---- one month grid ---- */
function MonthGrid(props) {
  const { month, selFrom, selTo, hover, onPick, onHover, today, min, max } = props;
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startWd = (first.getDay() + 6) % 7; // Monday-first
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const fromT = selFrom ? selFrom.getTime() : null;
  const toT = selTo ? selTo.getTime() : null;
  // effective end for preview while picking
  const previewT = (selFrom && !selTo && hover) ? hover.getTime() : toT;

  return (
    <div className="drp-month">
      <div className="drp-wd">{WD.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="drp-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={i} className="drp-cell is-empty" />;
          const tt = d.getTime();
          const disabled = (min && tt < min) || (max && tt > max);
          const isFrom = fromT && sameDay(d, selFrom);
          const isTo = previewT && sameDay(d, new Date(previewT));
          const lo = fromT != null ? Math.min(fromT, previewT != null ? previewT : fromT) : null;
          const hi = fromT != null ? Math.max(fromT, previewT != null ? previewT : fromT) : null;
          const inRange = lo != null && hi != null && tt > lo && tt < hi;
          const isEdge = isFrom || isTo;
          const single = isFrom && isTo;
          return (
            <button key={i} type="button"
              className={cx("drp-cell",
                disabled && "is-disabled",
                sameDay(d, today) && "is-today",
                inRange && "in-range",
                isEdge && "is-edge",
                isFrom && !single && "is-start",
                isTo && !single && "is-end",
                single && "is-single")}
              disabled={disabled}
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}>
              <span className="drp-num">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TIME_PRESETS = [
  { key: "open", label: "Open hours", from: "09:00", to: "23:00" },
  { key: "lunch", label: "Lunch", from: "12:00", to: "15:00" },
  { key: "dinner", label: "Dinner", from: "18:00", to: "22:00" },
  { key: "late", label: "Late night", from: "22:00", to: "02:00" },
  { key: "allday", label: "All day", from: "00:00", to: "23:59" },
];

function DateRangePicker(props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const valFrom = parseYmd(props.value && props.value.from);
  const valTo = parseYmd(props.value && props.value.to);
  const align = props.align || "left";
  const enableTime = props.enableTime !== false;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState((props.value && props.value.mode) || "date");
  const [from, setFrom] = useState(valFrom);
  const [to, setTo] = useState(valTo);
  const [fromTime, setFromTime] = useState((props.value && props.value.fromTime) || "");
  const [toTime, setToTime] = useState((props.value && props.value.toTime) || "");
  const [hover, setHover] = useState(null);
  const [view, setView] = useState(() => (valFrom ? new Date(valFrom.getFullYear(), valFrom.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1)));
  const ref = useRef(null);

  // sync from props when reopened
  useEffect(() => {
    if (open) {
      setFrom(valFrom); setTo(valTo); setHover(null);
      setMode((props.value && props.value.mode) || "date");
      setFromTime((props.value && props.value.fromTime) || "");
      setToTime((props.value && props.value.toTime) || "");
      setView(valFrom ? new Date(valFrom.getFullYear(), valFrom.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);

  const pick = (d) => {
    if (!from || (from && to)) { setFrom(d); setTo(null); setHover(null); }
    else { if (d.getTime() < from.getTime()) { setTo(from); setFrom(d); } else setTo(d); }
  };

  const applyPreset = (key) => {
    const [a, b] = presetRange(key, today);
    setFrom(a); setTo(b); setHover(null);
    if (a) setView(new Date(a.getFullYear(), a.getMonth(), 1));
    // one-click presets apply immediately
    props.onChange({ from: a ? ymd(a) : "", to: b ? ymd(b) : "", preset: key });
    setOpen(false);
  };

  const apply = () => {
    const f = from, t = to || from;
    props.onChange({ from: f ? ymd(f) : "", to: t ? ymd(t) : "", preset: matchPreset(f, t, today), mode: "date", fromTime: "", toTime: "" });
    setOpen(false);
  };
  const applyTime = () => {
    props.onChange({ from: valFrom ? ymd(valFrom) : "", to: valTo ? ymd(valTo) : "", preset: matchPreset(valFrom, valTo, today), mode: "time", fromTime: fromTime, toTime: toTime });
    setOpen(false);
  };
  const applyTimePreset = (p) => { setFromTime(p.from); setToTime(p.to); };
  const clear = () => { setFrom(null); setTo(null); setHover(null); };

  const activePreset = matchPreset(valFrom, valTo, today);
  const valMode = (props.value && props.value.mode) || "date";
  const triggerLabel = (() => {
    if (valMode === "time" && (props.value.fromTime || props.value.toTime)) {
      const tp = TIME_PRESETS.find((x) => x.from === props.value.fromTime && x.to === props.value.toTime);
      return tp ? tp.label : (props.value.fromTime || "00:00") + " – " + (props.value.toTime || "23:59");
    }
    if (activePreset && activePreset !== null) { const p = PRESETS.find((x) => x.key === activePreset); if (p && p.key !== "all") return p.label; }
    if (valFrom && valTo) return sameDay(valFrom, valTo) ? fmtShort(valFrom) : fmtShort(valFrom) + " – " + fmtShort(valTo);
    if (valFrom) return "From " + fmtShort(valFrom);
    return props.placeholder || "All time";
  })();
  const hasValue = !!(valFrom || valTo || (valMode === "time" && (props.value.fromTime || props.value.toTime)));

  const draftLabel = (() => {
    if (from && to) return sameDay(from, to) ? fmtShort(from) : fmtShort(from) + " – " + fmtShort(to);
    if (from) return fmtShort(from) + " – …";
    return "Select a start date";
  })();

  return (
    <div className={cx("drp", props.size === "sm" && "drp--sm")} ref={ref}>
      <button type="button" className={cx("drp-trigger", hasValue && "has-value", open && "is-open")} onClick={() => setOpen((o) => !o)}>
        <Icon name={valMode === "time" ? "clock" : "calendar"} size={17} />
        <span className="drp-trigger__label">{triggerLabel}</span>
        <Icon name="chevdown" size={15} className="drp-trigger__chev" />
      </button>

      {open && (
        <div className={cx("drp-pop", "drp-pop--col", align === "right" && "drp-pop--right")}>
          {enableTime && (
            <div className="drp-modebar">
              <div className="seg" style={{ width: "100%" }}>
                <button type="button" className={cx("seg__btn", mode === "date" && "is-active")} style={{ flex: 1 }} onClick={() => setMode("date")}><Icon name="calendar" size={15} />Date range</button>
                <button type="button" className={cx("seg__btn", mode === "time" && "is-active")} style={{ flex: 1 }} onClick={() => setMode("time")}><Icon name="clock" size={15} />Time of day</button>
              </div>
            </div>
          )}

          {mode === "date" ? (
            <div className="drp-body">
              <div className="drp-presets">
                {PRESETS.map((p) => (
                  <button key={p.key} type="button"
                    className={cx("drp-preset", matchPreset(from, to, today) === p.key && "is-active")}
                    onClick={() => applyPreset(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="drp-cal">
                <div className="drp-cal__head">
                  <button type="button" className="drp-nav" onClick={() => setView(addMonths(view, -1))} title="Previous month"><Icon name="chevleft" size={17} /></button>
                  <div className="drp-cal__titles">
                    <span>{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
                  </div>
                  <button type="button" className="drp-nav" onClick={() => setView(addMonths(view, 1))} title="Next month"><Icon name="chevright" size={17} /></button>
                </div>

                <div className="drp-months" onMouseLeave={() => setHover(null)}>
                  <MonthGrid month={view} selFrom={from} selTo={to} hover={hover} today={today} max={today.getTime()} onPick={pick} onHover={setHover} />
                </div>

                <div className="drp-foot">
                  <span className="drp-foot__draft">{draftLabel}</span>
                  <div className="drp-foot__actions">
                    {(from || to) && <button type="button" className="drp-clear" onClick={clear}>Clear</button>}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Cancel</button>
                    <button type="button" className="btn btn--primary btn--sm" onClick={apply} disabled={!from}>Apply</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="drp-time">
              <div className="drp-time__label">Filter by time of day</div>
              <div className="drp-time__chips">
                {TIME_PRESETS.map((p) => {
                  const active = fromTime === p.from && toTime === p.to;
                  return <button key={p.key} type="button" className={cx("drp-timechip", active && "is-active")} onClick={() => applyTimePreset(p)}>{p.label}</button>;
                })}
              </div>
              <div className="drp-time__custom">
                <span className="drp-time__customlabel">Custom</span>
                <TimeRange from={fromTime} to={toTime} onFrom={setFromTime} onTo={setToTime} />
              </div>
              <div className="drp-foot" style={{ marginTop: "auto" }}>
                <span className="drp-foot__draft">{fromTime || toTime ? (fromTime || "00:00") + " – " + (toTime || "23:59") : "Any time"}</span>
                <div className="drp-foot__actions">
                  {(fromTime || toTime) && <button type="button" className="drp-clear" onClick={() => { setFromTime(""); setToTime(""); }}>Clear</button>}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>Cancel</button>
                  <button type="button" className="btn btn--primary btn--sm" onClick={applyTime}>Apply</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { DateRangePicker, drpPresetRange: presetRange, drpYmd: ymd });
