/* ============================================================
   ALPHA POS — Design System reference
   (deliverable #1: approve the direction · #4: named tokens)
   ============================================================ */
const { useState } = React;

function getVar(n) { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim().toUpperCase(); } catch (e) { return ""; } }

function DSSection(props) {
  return (
    <section style={{ marginBottom: "var(--sp-8)" }}>
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <h2 style={{ fontSize: "var(--fs-h2)", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{props.title}</h2>
        {props.sub && <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{props.sub}</div>}
      </div>
      {props.children}
    </section>
  );
}

function Swatch(props) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", background: "var(--surface)" }}>
      <div style={{ height: 60, background: "var(" + props.token + ")", borderBottom: "1px solid var(--border)" }} />
      <div style={{ padding: "8px 10px" }}>
        <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{props.token}</div>
        <div className="mono tertiary" style={{ fontSize: 11, marginTop: 2 }}>{getVar(props.token) || props.label}</div>
      </div>
    </div>
  );
}

function ChartSwatch(props) {
  return (
    <div className="row" style={{ gap: 10 }}>
      <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(" + props.token + ")", flex: "0 0 28px", border: "1px solid var(--border)" }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{props.name}</div>
        <div className="mono tertiary" style={{ fontSize: 11 }}>{props.token}</div>
      </div>
    </div>
  );
}

function DesignSystemPage(props) {
  const toast = useToast();
  const [demoModal, setDemoModal] = useState(false);
  const [sw, setSw] = useState(true);
  const [seg, setSeg] = useState("a");
  const [chk, setChk] = useState(true);

  const TYPE = [
    ["Display / 32", "--fs-display", 700, "Big numbers & hero stats"],
    ["Heading 1 / 24", "--fs-h1", 700, "Page titles"],
    ["Heading 2 / 19", "--fs-h2", 700, "Section & insight titles"],
    ["Heading 3 / 15", "--fs-h3", 600, "Card titles"],
    ["Body / 14", "--fs-body", 400, "Default text & tables"],
    ["Small / 13", "--fs-sm", 400, "Secondary text"],
    ["Label / 12", "--fs-label", 600, "Field & axis labels (uppercase)"],
  ];
  const MAP = [
    ["--primary", "theme.colors.primary", "Primary actions, links, active nav, revenue series"],
    ["--success / --error / --warning / --info", "colors.success · error · warning · info", "Status pills, deltas, toasts, semantic icons"],
    ["--bg", "colors.background", "App canvas background"],
    ["--surface", "colors.surface", "Cards, menus, table surface"],
    ["--text", "colors.on-surface / on-background", "Primary body text"],
    ["--border", "variables.border-color (@ lower opacity)", "Hairlines, dividers, inputs"],
    ["--chart-revenue / --chart-expense", "custom SCSS: $chart-revenue …", "Fixed chart semantics across all charts"],
    ["--r-sm / --r-lg", "VBtn / VCard rounded", "Control & card corner radius"],
    ["--shadow-sm / --shadow-lg", "elevation tokens", "Card & overlay elevation"],
    ["--font-sans / --font-mono", "$body-font-family / numerals", "Type families"],
  ];

  return (
    <div className="page">
      <PageHeader title="Design system"
        subtitle="High-contrast minimalism · light-first, dark via tokens. Approve the direction here — every screen is built from these."
        actions={<Button variant="primary" icon="arrowup" onClick={() => props.onNav("dashboard")} iconRight="chevright">See it on the Dashboard</Button>} />

      {/* Principles */}
      <div className="grid cols-3" style={{ marginBottom: "var(--sp-8)" }}>
        {[
          ["dashboard", "UX first", "One clear primary action per screen. Consistent header, nav and patterns across every module."],
          ["chart", "Data clarity", "Defined type scale, generous whitespace, AA contrast. Each chart answers one question; its title states the insight."],
          ["sliders", "Meaningful color", "Neutral surfaces, one accent. Color and depth signal state, priority and action — never decoration."],
        ].map((p) => (
          <Card key={p[1]} style={{ padding: "var(--sp-5)" }}>
            <div className="kpi__icon t-primary" style={{ marginBottom: 14 }}><Icon name={p[0]} size={20} /></div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{p[1]}</div>
            <div className="muted" style={{ fontSize: 14 }}>{p[2]}</div>
          </Card>
        ))}
      </div>

      {/* Colors */}
      <DSSection title="Color tokens" sub="Named CSS custom properties. Values shown are live for the current theme — toggle the theme in the top bar.">
        <div className="kpi__label" style={{ marginBottom: 10 }}>Surfaces & lines</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 22 }}>
          {["--bg", "--surface", "--surface-2", "--surface-inset", "--border", "--border-strong"].map((t) => <Swatch key={t} token={t} />)}
        </div>
        <div className="kpi__label" style={{ marginBottom: 10 }}>Brand accent</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 22 }}>
          {["--primary", "--primary-hover", "--primary-active", "--primary-weak", "--primary-weak-2", "--primary-border"].map((t) => <Swatch key={t} token={t} />)}
        </div>
        <div className="kpi__label" style={{ marginBottom: 10 }}>Semantic</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(8, 1fr)", gap: 14, marginBottom: 22 }}>
          {["--success", "--success-weak", "--warning", "--warning-weak", "--error", "--error-weak", "--info", "--info-weak"].map((t) => <Swatch key={t} token={t} />)}
        </div>
        <Card style={{ padding: "var(--sp-5)" }}>
          <div className="kpi__label" style={{ marginBottom: 14 }}>Chart palette — fixed semantics across every chart</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <ChartSwatch token="--chart-revenue" name="Revenue (always)" />
            <ChartSwatch token="--chart-expense" name="Expenses (always)" />
            <ChartSwatch token="--chart-cash" name="Cash" />
            <ChartSwatch token="--chart-track" name="Track / unfilled" />
            <ChartSwatch token="--c1" name="Categorical 1" />
            <ChartSwatch token="--c2" name="Categorical 2" />
            <ChartSwatch token="--c3" name="Categorical 3" />
            <ChartSwatch token="--c5" name="Categorical / neutral" />
          </div>
        </Card>
      </DSSection>

      {/* Type + spacing */}
      <div className="grid cols-2" style={{ alignItems: "start", marginBottom: "var(--sp-8)" }}>
        <DSSection title="Type scale" sub="Hanken Grotesk for UI · JetBrains Mono (tabular) for figures." >
          <Card style={{ padding: "var(--sp-5)" }}>
            {TYPE.map((t, i) => (
              <div key={t[1]} className="row between" style={{ padding: "12px 0", borderBottom: i < TYPE.length - 1 ? "1px solid var(--border)" : "none", gap: 16 }}>
                <span style={{ fontSize: "var(" + t[1] + ")", fontWeight: t[2], lineHeight: 1.1, letterSpacing: "-0.01em" }}>Agar</span>
                <div style={{ textAlign: "right", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t[0]}</div>
                  <div className="tertiary" style={{ fontSize: 12 }}>{t[3]}</div>
                </div>
              </div>
            ))}
            <div className="row between" style={{ paddingTop: 14, marginTop: 4, borderTop: "1px solid var(--border)" }}>
              <span className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>14 230 000</span>
              <div style={{ textAlign: "right" }}><div style={{ fontWeight: 600, fontSize: 13 }}>KPI / mono</div><div className="tertiary" style={{ fontSize: 12 }}>Tabular figures</div></div>
            </div>
          </Card>
        </DSSection>

        <DSSection title="Spacing, radii & elevation" sub="4px base scale.">
          <Card style={{ padding: "var(--sp-5)" }}>
            <div className="kpi__label" style={{ marginBottom: 12 }}>Spacing</div>
            <div className="row" style={{ gap: 10, alignItems: "flex-end", marginBottom: 22 }}>
              {[["1",4],["2",8],["3",12],["4",16],["5",20],["6",24],["7",32],["8",40]].map((s) => (
                <div key={s[0]} style={{ textAlign: "center" }}>
                  <div style={{ width: s[1], height: s[1], background: "var(--primary-weak-2)", border: "1px solid var(--primary-border)", borderRadius: 4, margin: "0 auto" }} />
                  <div className="mono tertiary" style={{ fontSize: 10, marginTop: 5 }}>{s[1]}</div>
                </div>
              ))}
            </div>
            <div className="kpi__label" style={{ marginBottom: 12 }}>Radii</div>
            <div className="row" style={{ gap: 12, marginBottom: 22 }}>
              {[["xs","--r-xs"],["sm","--r-sm"],["md","--r-md"],["lg","--r-lg"],["xl","--r-xl"]].map((r) => (
                <div key={r[0]} style={{ textAlign: "center" }}>
                  <div style={{ width: 52, height: 40, background: "var(--surface-inset)", border: "1px solid var(--border-strong)", borderRadius: "var(" + r[1] + ") var(" + r[1] + ") 0 0" }} />
                  <div className="mono tertiary" style={{ fontSize: 10, marginTop: 5 }}>{r[0]}</div>
                </div>
              ))}
            </div>
            <div className="kpi__label" style={{ marginBottom: 12 }}>Elevation</div>
            <div className="row" style={{ gap: 18 }}>
              {["--shadow-xs","--shadow-sm","--shadow-md","--shadow-lg"].map((s) => (
                <div key={s} style={{ textAlign: "center" }}>
                  <div style={{ width: 64, height: 44, background: "var(--surface)", borderRadius: 10, boxShadow: "var(" + s + ")", border: "1px solid var(--border)" }} />
                  <div className="mono tertiary" style={{ fontSize: 10, marginTop: 8 }}>{s.replace("--shadow-", "")}</div>
                </div>
              ))}
            </div>
          </Card>
        </DSSection>
      </div>

      {/* Components */}
      <DSSection title="Core components" sub="Every state designed: default · hover · focus · active · disabled · loading.">
        <div className="grid cols-2" style={{ alignItems: "start" }}>
          <Card style={{ padding: "var(--sp-5)" }}>
            <div className="kpi__label" style={{ marginBottom: 14 }}>Buttons</div>
            <div className="row wrap" style={{ gap: 10, marginBottom: 12 }}>
              <Button variant="primary" icon="plus">Primary</Button>
              <Button variant="secondary" icon="download">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger" icon="trash">Danger</Button>
            </div>
            <div className="row wrap" style={{ gap: 10 }}>
              <Button variant="primary" loading>Loading</Button>
              <Button variant="primary" disabled>Disabled</Button>
              <Button variant="secondary" size="sm">Small</Button>
              <IconAction icon="edit" tone="primary" /><IconAction icon="pause" tone="warning" /><IconAction icon="trash" tone="danger" />
            </div>
          </Card>

          <Card style={{ padding: "var(--sp-5)" }}>
            <div className="kpi__label" style={{ marginBottom: 14 }}>Inputs & controls</div>
            <div className="form-grid">
              <Field label="Default"><Input icon="search" placeholder="Search…" /></Field>
              <Field label="Error" error="This field is required"><Input icon="mail" defaultValue="not-an-email" error /></Field>
              <Field label="Select"><Select value={seg === "a" ? "CASHIER" : "MANAGER"} onChange={() => {}} options={DB.roles} /></Field>
              <Field label="Disabled"><div className="control is-disabled"><Icon name="lock" size={16} /><input value="Locked" disabled /></div></Field>
            </div>
            <div className="row between" style={{ marginTop: 16 }}>
              <div className="row" style={{ gap: 12 }}>
                <Switch checked={sw} onChange={setSw} /><span style={{ fontSize: 14 }}>Toggle</span>
                <Checkbox checked={chk} onChange={setChk} /><span style={{ fontSize: 14 }}>Checkbox</span>
              </div>
              <Segmented value={seg} onChange={setSeg} options={[{ value: "a", label: "Day" }, { value: "b", label: "Week" }, { value: "c", label: "Month" }]} />
            </div>
          </Card>

          <Card style={{ padding: "var(--sp-5)" }}>
            <div className="kpi__label" style={{ marginBottom: 14 }}>Badges & status</div>
            <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
              {["ACTIVE","PREPARING","CANCELLED","PAID","UNPAID","READY"].map((s) => <StatusBadge key={s} value={s} dot />)}
            </div>
            <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
              {["CASHIER","MANAGER","USER","HALL","DELIVERY","PICKUP"].map((s) => <StatusBadge key={s} value={s} />)}
            </div>
            <div className="kpi__label" style={{ marginBottom: 10 }}>Deltas</div>
            <div className="row" style={{ gap: 10 }}><Delta value={12.4} /><Delta value={-3.9} /><Delta value={0} /></div>
          </Card>

          <Card style={{ padding: "var(--sp-5)" }}>
            <div className="kpi__label" style={{ marginBottom: 14 }}>Feedback</div>
            <div className="row wrap" style={{ gap: 10, marginBottom: 16 }}>
              <Button variant="secondary" icon="checkcircle" onClick={() => toast({ tone: "success", title: "Saved", msg: "Changes stored successfully." })}>Success toast</Button>
              <Button variant="secondary" icon="alert" onClick={() => toast({ tone: "error", title: "Couldn't save", msg: "Check your connection." })}>Error toast</Button>
              <Button variant="secondary" icon="layout" onClick={() => setDemoModal(true)}>Open modal</Button>
            </div>
            <div className="kpi__label" style={{ marginBottom: 10 }}>States</div>
            <div className="row" style={{ gap: 12 }}>
              <div style={{ flex: 1 }}><Skeleton h={14} style={{ marginBottom: 8 }} /><Skeleton h={14} w="70%" /></div>
              <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10 }}><StateFill icon="inbox" title="Empty" sub="No data" style={{ padding: 18 }} /></div>
            </div>
          </Card>
        </div>

        {/* KPI + chart card demo */}
        <div className="grid cols-2" style={{ marginTop: "var(--sp-5)", alignItems: "start" }}>
          <Kpi data={{ label: "Today's Revenue", value: 14230000, money: true, delta: 12.4, icon: "wallet", tone: "primary", deltaLabel: "vs last week" }} />
          <ChartCard eyebrow="Composition · example" insight="Donut · max 5 segments" style={{ gridRow: "span 2" }}>
            <DonutChart data={DB.paymentMix} centerLabel="Total" size={170} />
          </ChartCard>
          <Kpi data={{ label: "Avg Order Value", value: 100211, money: true, delta: -3.9, icon: "trend", tone: "neutral", deltaLabel: "vs last week" }} />
        </div>
      </DSSection>

      {/* Token mapping */}
      <DSSection title="Token → framework mapping" sub="Map these named tokens to your Vuetify/Quasar theme variables for a 1:1 reskin.">
        <Card>
          <table className="dtable">
            <thead><tr><th>CSS token</th><th>Framework key</th><th>Usage</th></tr></thead>
            <tbody>
              {MAP.map((m) => (
                <tr key={m[0]}>
                  <td className="mono cell-strong" style={{ fontSize: 12 }}>{m[0]}</td>
                  <td className="mono cell-muted" style={{ fontSize: 12 }}>{m[1]}</td>
                  <td className="cell-muted">{m[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </DSSection>

      {demoModal && (
        <Modal title="Example modal" subtitle="Overlay, elevation and focus ring in one place" onClose={() => setDemoModal(false)}
          footer={<React.Fragment><Button variant="ghost" onClick={() => setDemoModal(false)}>Cancel</Button><Button variant="primary" icon="check" onClick={() => { setDemoModal(false); toast({ tone: "success", title: "Confirmed" }); }}>Confirm</Button></React.Fragment>}>
          <p className="muted" style={{ margin: 0 }}>Modals use the <span className="mono">--r-xl</span> radius, <span className="mono">--shadow-lg</span> elevation and a scrim of <span className="mono">--overlay</span>. Press <b>Esc</b> or click outside to dismiss.</p>
        </Modal>
      )}
    </div>
  );
}

Object.assign(window, { DesignSystemPage });
