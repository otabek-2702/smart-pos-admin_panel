/* ============================================================
   ALPHA POS — UI primitives
   ============================================================ */
const { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } = React;

function cx() {return Array.prototype.filter.call(arguments, Boolean).join(" ");}

/* ---------- Button ---------- */
function Button(props) {
  const { variant = "secondary", size, icon, iconRight, loading, disabled, children, className, ...rest } = props;
  return (
    <button
      className={cx("btn", "btn--" + variant, size && "btn--" + size, loading && "is-loading", className)}
      disabled={disabled || loading} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 16 : 18} />}
    </button>);

}

function IconAction(props) {
  const { icon, tone, title, ...rest } = props;
  return (
    <button className={cx("iconaction", tone && "is-" + tone)} title={title} {...rest}>
      <Icon name={icon} size={17} />
    </button>);

}

/* ---------- Fields ---------- */
function Field(props) {
  return (
    <label className={cx("field", props.className)}>
      {props.label && <span className="field__label">{props.label}</span>}
      {props.children}
      {props.error ? <span className="field__error">{props.error}</span> :
      props.hint ? <span className="field__hint">{props.hint}</span> : null}
    </label>);

}

function Input(props) {
  const { icon, error, disabled, className, ...rest } = props;
  return (
    <div className={cx("control", error && "is-error", disabled && "is-disabled", className)}>
      {icon && <Icon name={icon} size={18} />}
      <input disabled={disabled} {...rest} data-comment-anchor="647f7e9141-input-48-7" />
    </div>);

}

function Select(props) {
  const { value, onChange, options, placeholder, icon, disabled, error, size } = props;
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const ref = useRef(null);
  const norm = (options || []).map((o) => typeof o === "string" ? { value: o, label: o } : o);
  const current = norm.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {if (ref.current && !ref.current.contains(e.target)) setOpen(false);};
    const onKey = (e) => {if (e.key === "Escape") setOpen(false);};
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {document.removeEventListener("mousedown", onDoc);document.removeEventListener("keydown", onKey);};
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const menuH = Math.min(48 + norm.length * 38, 280);
      setUp(spaceBelow < menuH + 12 && r.top > spaceBelow);
    }
    setOpen((o) => !o);
  };
  const choose = (e, v) => {e.stopPropagation();onChange && onChange(v);setOpen(false);};

  return (
    <div className={cx("control control--select", size === "sm" && "control--sm", error && "is-error", disabled && "is-disabled", open && "is-open")}
    ref={ref} onClick={toggle} role="combobox" aria-expanded={open} aria-haspopup="listbox"
    tabIndex={disabled ? -1 : 0}
    onKeyDown={(e) => {if (e.key === "Enter" || e.key === " ") {e.preventDefault();toggle();}}}>
      {icon && <Icon name={icon} size={18} />}
      <span className="control__value" style={{ color: current ? "var(--text)" : "var(--text-tertiary)" }}>
        {current ? current.label : placeholder || ""}
      </span>
      <Icon name="chevdown" size={18} className="chev" />
      {open &&
      <div className={cx("selectmenu", up && "is-up")} role="listbox" onClick={(e) => e.stopPropagation()}>
          {placeholder !== undefined &&
        <div className={cx("selectopt", !current && "is-sel")} role="option" aria-selected={!current} onClick={(e) => choose(e, "")}>
              <span className="selectopt__lab" style={{ color: "var(--text-tertiary)" }}>{placeholder}</span>
              {!current && <Icon name="check" size={16} />}
            </div>
        }
          {norm.map((o) =>
        <div key={o.value} className={cx("selectopt", o.value === value && "is-sel")} role="option" aria-selected={o.value === value} onClick={(e) => choose(e, o.value)}>
              <span className="selectopt__lab">{o.label}</span>
              {o.value === value && <Icon name="check" size={16} />}
            </div>
        )}
        </div>
      }
    </div>);

}

function Switch(props) {
  return <div className={cx("switch", props.checked && "is-on")} onClick={() => props.onChange && props.onChange(!props.checked)} role="switch" aria-checked={!!props.checked} />;
}

/* ---- TimeField: compact HH:MM input (mono, themed) ---- */
function TimeField(props) {
  const { value, onChange, disabled, size, icon } = props;
  return (
    <div className={cx("control", "control--time", size === "sm" && "control--sm", disabled && "is-disabled")}>
      {icon && <Icon name={icon} size={16} />}
      <input type="time" value={value || ""} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.value)} step={props.step || 300} />
    </div>
  );
}

/* ---- TimeRange: from–to time pair ---- */
function TimeRange(props) {
  return (
    <div className="row" style={{ gap: 8, alignItems: "center" }}>
      <TimeField value={props.from} onChange={props.onFrom} icon="clock" />
      <span className="tertiary" style={{ fontSize: 13 }}>to</span>
      <TimeField value={props.to} onChange={props.onTo} />
    </div>
  );
}

function Segmented(props) {
  return (
    <div className="seg" role="tablist">
      {props.options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lab = typeof o === "string" ? o : o.label;
        const ic = typeof o === "object" ? o.icon : null;
        return (
          <button key={val} className={cx("seg__btn", props.value === val && "is-active")}
          onClick={() => props.onChange(val)} role="tab" aria-selected={props.value === val}>
            {ic && <Icon name={ic} size={15} />}{lab}
          </button>);

      })}
    </div>);

}

function Checkbox(props) {
  return (
    <div className={cx("checkbox", props.checked && "is-checked", props.indeterminate && "is-indeterminate")}
    onClick={(e) => {e.stopPropagation();props.onChange && props.onChange(!props.checked);}} role="checkbox" aria-checked={!!props.checked}>
      {props.indeterminate ? <Icon name="" size={12} style={{ width: 9, height: 2, background: "currentColor", borderRadius: 2 }} /> :
      props.checked ? <Icon name="check" size={13} weight={2.4} /> : null}
    </div>);

}

/* ---------- Cards ---------- */
function Card(props) {
  return <div className={cx("card", props.className)} style={props.style}>{props.children}</div>;
}

/* ---------- Delta chip ---------- */
function Delta(props) {
  const v = props.value;
  if (v === null || v === undefined) return <span className="delta is-flat"><Icon name="" size={1} />—</span>;
  const dir = v > 0 ? "is-up" : v < 0 ? "is-down" : "is-flat";
  return (
    <span className={cx("delta", dir)}>
      {v !== 0 && <Icon name={v > 0 ? "arrowup" : "arrowdown"} size={13} weight={2.2} />}
      {Fmt.delta(v)}
    </span>);

}

/* ---------- KPI stat card ---------- */
function Kpi(props) {
  const d = props.data;
  const tone = d.tone || "primary";
  const isMoney = d.money;
  let display,unit = null;
  if (typeof d.value === "string") {display = d.value;} else
  if (isMoney) {display = <CountUp value={d.value} format={Fmt.abbr} />;unit = "UZS";} else
  {display = <CountUp value={d.value} format={Fmt.num} />;}
  const toneColor = { primary: "var(--primary)", success: "var(--success)", warning: "var(--warning)", error: "var(--error)", info: "var(--info)", neutral: "var(--text-tertiary)" }[tone];
  const hasSpark = d.spark && d.spark.length && window.Sparkline;
  return (
    <div className={cx("kpi", "kpi--accent")} style={{ "--kpi-accent": toneColor }}>
      <div className="kpi__top">
        {d.icon && <div className={cx("kpi__icon", "t-" + tone)}><Icon name={d.icon} size={20} /></div>}
        <div className="kpi__label">{d.label}</div>
        {d.delta !== null && d.delta !== undefined && <span style={{ marginLeft: "auto" }}><Delta value={d.delta} /></span>}
      </div>
      <div className="kpi__value">{display}{unit && <span className="kpi__unit">{unit}</span>}</div>
      <div className="kpi__foot">
        {(d.delta === null || d.delta === undefined) && d.sub && <span className="kpi__subtext">{d.sub}</span>}
        {d.delta !== null && d.delta !== undefined && (d.sub || d.deltaLabel) && <span className="kpi__subtext">{d.sub || d.deltaLabel}</span>}
        {hasSpark && <span className="kpi__spark"><Sparkline data={d.spark} width={84} height={28} colorByTrend={d.sparkTrend !== false} color={toneColor} dot={false} /></span>}
      </div>
    </div>);

}

/* compact KPI (sub-row, no icon) */
function KpiMini(props) {
  const d = props.data;
  const tone = d.tone || "neutral";
  const colorMap = { info: "var(--info)", error: "var(--error)", success: "var(--success)", primary: "var(--primary)", warning: "var(--warning)", neutral: "var(--text)" };
  return (
    <div className="kpi" style={{ padding: "var(--sp-4) var(--sp-5)" }}>
      <div className="kpi__label" style={{ marginBottom: 6 }}>{d.label}</div>
      <div className="kpi__value" style={{ fontSize: "var(--fs-h1)", lineHeight: "var(--lh-h1)", color: colorMap[tone] }}>
        {typeof d.value === "string" ? d.value : Fmt.num(d.value)}
      </div>
      {d.sub && <div className="kpi__subtext" style={{ marginTop: 4 }}>{d.sub}</div>}
    </div>);

}

/* KPI skeleton (shared loading placeholder) */
function KpiSkel(props) {
  return (
    <div className="kpi">
      {!props.mini && <div className="kpi__top"><Skeleton w={38} h={38} r={8} /><Skeleton w={90} h={13} /></div>}
      {props.mini && <Skeleton w={70} h={13} style={{ marginBottom: 10 }} />}
      <Skeleton w={props.mini ? 90 : 140} h={props.mini ? 24 : 30} />
      {!props.mini && <Skeleton w={80} h={18} style={{ marginTop: 12, borderRadius: 99 }} />}
    </div>);

}

/* ---------- Badge ---------- */
function Badge(props) {
  return <span className={cx("badge", props.dot && "badge--dot", "t-" + (props.tone || "neutral"), props.className)}>{props.children}</span>;
}

const STATUS_TONE = {
  ACTIVE: "success", COMPLETED: "success", READY: "success", PAID: "success",
  PREPARING: "warning", PENDING: "warning", INACTIVE: "neutral",
  CANCELLED: "error", CANCELED: "error", UNPAID: "error",
  CASHIER: "info", USER: "neutral", MANAGER: "primary", ADMIN: "primary",
  HALL: "neutral", DELIVERY: "info", PICKUP: "primary"
};
function StatusBadge(props) {
  const s = props.value;
  return <Badge tone={STATUS_TONE[s] || "neutral"} dot={props.dot}>{s}</Badge>;
}

/* ---------- Skeleton ---------- */
function Skeleton(props) {
  return <div className="skel" style={Object.assign({ width: props.w || "100%", height: props.h || 16, borderRadius: props.r }, props.style)} />;
}

/* ---------- State fills (empty / error) ---------- */
function StateFill(props) {
  return (
    <div className={cx("statefill", props.error && "is-error")} style={props.style} data-comment-anchor="239825642e-div-243-5">
      <div className="statefill__icon"><Icon name={props.icon || "inbox"} size={24} /></div>
      <div className="statefill__title">{props.title}</div>
      {props.sub && <div className="statefill__sub">{props.sub}</div>}
      {props.action}
    </div>);

}

/* ---------- Modal ---------- */
function Modal(props) {
  useEffect(() => {
    const onKey = (e) => {if (e.key === "Escape") props.onClose && props.onClose();};
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => {if (e.target === e.currentTarget) props.onClose && props.onClose();}}>
      <div className="modal" style={{ maxWidth: props.width }} role="dialog" aria-modal="true">
        <div className="modal__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="modal__title">{props.title}</h3>
            {props.subtitle && <div className="modal__sub">{props.subtitle}</div>}
          </div>
          <IconAction icon="close" onClick={props.onClose} title="Close" />
        </div>
        <div className="modal__body">{props.children}</div>
        {props.footer && <div className="modal__foot">{props.footer}</div>}
      </div>
    </div>);

}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(null);
function useToast() {return useContext(ToastCtx);}
function ToastProvider(props) {
  const [items, setItems] = useState([]);
  const push = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => s.concat([Object.assign({ id, tone: "info" }, t)]));
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), t.duration || 4200);
  }, []);
  useEffect(() => {window.__aiToast = push;return () => {if (window.__aiToast === push) window.__aiToast = null;};}, [push]);
  const remove = (id) => setItems((s) => s.filter((x) => x.id !== id));
  const iconFor = { success: "checkcircle", error: "alert", info: "info", warning: "alert" };
  return (
    <ToastCtx.Provider value={push}>
      {props.children}
      <div className="toast-host">
        {items.map((t) =>
        <div key={t.id} className={cx("toast", "t-" + t.tone)}>
            <div className="toast__icon"><Icon name={iconFor[t.tone]} size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toast__title">{t.title}</div>
              {t.msg && <div className="toast__msg">{t.msg}</div>}
            </div>
            <div className="toast__x" onClick={() => remove(t.id)}><Icon name="close" size={16} /></div>
          </div>
        )}
      </div>
    </ToastCtx.Provider>);

}

/* ---------- Pagination ---------- */
function Pagination(props) {
  const { page, pages, perPage, total, onPage, onPerPage } = props;
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  let nums = [];
  if (pages <= 7) {for (let i = 1; i <= pages; i++) nums.push(i);} else
  if (page <= 4) {nums = [1, 2, 3, 4, 5, "…", pages];} else
  if (page >= pages - 3) {nums = [1, "…", pages - 4, pages - 3, pages - 2, pages - 1, pages];} else
  {nums = [1, "…", page - 1, page, page + 1, "…", pages];}
  return (
    <div className="pagination">
      {onPerPage &&
      <div className="row" style={{ gap: 8 }}>
          <span>Rows per page:</span>
          <div style={{ width: 76 }}>
            <Select size="sm" value={String(perPage)} onChange={(v) => onPerPage(Number(v))} options={["10", "20", "50"]} />
          </div>
        </div>
      }
      <div className="pagination__spacer" />
      <span className="num">{start}–{end} of {Fmt.num(total)}</span>
      <div className="pglist">
        <button className="pgbtn" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="chevleft" size={16} /></button>
        {nums.map((n, i) => n === "…" ?
        <span key={"e" + i} className="pgbtn" style={{ pointerEvents: "none" }}>…</span> :
        <button key={n} className={cx("pgbtn", n === page && "is-active")} onClick={() => onPage(n)}>{n}</button>)}
        <button className="pgbtn" disabled={page >= pages} onClick={() => onPage(page + 1)}><Icon name="chevright" size={16} /></button>
      </div>
    </div>);

}

Object.assign(window, {
  cx, Button, IconAction, Field, Input, Select, Switch, TimeField, TimeRange, Segmented, Checkbox,
  Card, Delta, Kpi, KpiMini, KpiSkel, Badge, StatusBadge, Skeleton, StateFill,
  Modal, ToastProvider, useToast, Pagination, STATUS_TONE
});