/* ============================================================
   ALPHA POS — "Frequently bought together" (product affinity)
   Views: Chord · Matrix · Ranked pairs. Full drill-down:
   click a product → all its pairings; click a pairing → rich
   pair detail (confidence, lift, est. revenue, suggestion).
   ============================================================ */
const { useState, useMemo } = React;

function polar(cx, cy, r, ang) { return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]; }
function samePair(p, a, b) { return p && ((p.a === a && p.b === b) || (p.a === b && p.b === a)); }
function findPair(pairs, a, b) { return pairs.find((p) => samePair(p, a, b)) || null; }

/* ---------------- analytics helpers ---------------- */
function productStats(products, pairs, i) {
  const partners = pairs.filter((p) => p.a === i || p.b === i)
    .map((p) => ({ other: p.a === i ? p.b : p.a, count: p.count }))
    .sort((x, y) => y.count - x.count);
  const combined = partners.reduce((a, p) => a + p.count, 0);
  return {
    partners, combined, distinct: partners.length,
    attach: products[i].orders ? combined / products[i].orders : 0,
    top: partners[0] || null,
  };
}
function pairStats(products, pairs, a, b, totalN) {
  const pr = findPair(pairs, a, b);
  const count = pr ? pr.count : 0;
  const A = products[a], B = products[b];
  const confAB = A.orders ? count / A.orders : 0;   // P(B | A)
  const confBA = B.orders ? count / B.orders : 0;   // P(A | B)
  const N = totalN || 1240;
  const lift = (A.orders && B.orders) ? (count * N) / (A.orders * B.orders) : 0;
  const revenue = count * ((A.price || 0) + (B.price || 0));
  return { count, confAB, confBA, lift, revenue };
}

/* ---------------- Chord diagram ---------------- */
function ChordView(props) {
  const { products, pairs, hover, focus, pair, onHover, onPickProduct, onPickPair } = props;
  const size = props.size || 380;
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 54;
  const ringW = 13;
  const N = products.length;
  const activeIdx = hover != null ? hover : (focus != null ? focus : null);

  const layout = useMemo(() => {
    const m = products.map(() => products.map(() => 0));
    pairs.forEach((p) => { m[p.a][p.b] = p.count; m[p.b][p.a] = p.count; });
    const weight = m.map((row) => row.reduce((a, b) => a + b, 0));
    const W = weight.reduce((a, b) => a + b, 0) || 1;
    const gap = 0.035;
    const avail = Math.PI * 2 - gap * N;
    const scale = avail / W;
    const arcs = []; let cur = -Math.PI / 2;
    const sub = products.map(() => ({}));
    for (let i = 0; i < N; i++) {
      const a0 = cur, span = weight[i] * scale;
      let ptr = a0;
      for (let j = 0; j < N; j++) { if (m[i][j] > 0) { const s = m[i][j] * scale; sub[i][j] = [ptr, ptr + s]; ptr += s; } }
      arcs.push({ i, start: a0, end: a0 + span, mid: a0 + span / 2, weight: weight[i] });
      cur = a0 + span + gap;
    }
    return { arcs, sub, weight };
  }, [products, pairs]);

  const annular = (a0, a1, rIn, rOut) => {
    const o0 = polar(cx, cy, rOut, a0), o1 = polar(cx, cy, rOut, a1);
    const i1 = polar(cx, cy, rIn, a1), i0 = polar(cx, cy, rIn, a0);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return `M${o0[0]} ${o0[1]} A${rOut} ${rOut} 0 ${large} 1 ${o1[0]} ${o1[1]} L${i1[0]} ${i1[1]} A${rIn} ${rIn} 0 ${large} 0 ${i0[0]} ${i0[1]} Z`;
  };
  const ribbonPath = (sa, sb) => {
    const a0 = polar(cx, cy, R, sa[0]), a1 = polar(cx, cy, R, sa[1]);
    const b0 = polar(cx, cy, R, sb[0]), b1 = polar(cx, cy, R, sb[1]);
    const la = (sa[1] - sa[0]) > Math.PI ? 1 : 0, lb = (sb[1] - sb[0]) > Math.PI ? 1 : 0;
    return `M${a0[0]} ${a0[1]} A${R} ${R} 0 ${la} 1 ${a1[0]} ${a1[1]} Q${cx} ${cy} ${b0[0]} ${b0[1]} A${R} ${R} 0 ${lb} 1 ${b1[0]} ${b1[1]} Q${cx} ${cy} ${a0[0]} ${a0[1]} Z`;
  };

  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: "block", maxWidth: size, margin: "0 auto" }}>
      {pairs.map((p, k) => {
        const sa = layout.sub[p.a][p.b], sb = layout.sub[p.b][p.a];
        if (!sa || !sb) return null;
        const isSel = samePair(pair, p.a, p.b);
        const connected = activeIdx != null && (p.a === activeIdx || p.b === activeIdx);
        let op;
        if (pair) op = isSel ? 0.8 : 0.05;
        else if (activeIdx != null) op = connected ? 0.62 : 0.06;
        else op = 0.4;
        return (
          <path key={k} d={ribbonPath(sa, sb)}
            fill={isSel ? "var(--primary)" : "var(--chord-ribbon)"} opacity={op}
            style={{ transition: "opacity .18s, fill .18s", cursor: "pointer" }}
            onMouseEnter={() => !pair && onHover(p.a)} onMouseLeave={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onPickPair({ a: p.a, b: p.b }); }}>
            <title>{products[p.a].name} + {products[p.b].name} — {p.count} orders</title>
          </path>
        );
      })}
      {layout.arcs.map((arc) => {
        const p = products[arc.i];
        let dim = false;
        if (pair) dim = arc.i !== pair.a && arc.i !== pair.b;
        else if (activeIdx != null) dim = arc.i !== activeIdx && !pairs.some((pr) => samePair(pr, arc.i, activeIdx));
        const lp = polar(cx, cy, R + ringW + 12, arc.mid);
        const deg = arc.mid * 180 / Math.PI;
        const flip = arc.mid > Math.PI / 2 && arc.mid < Math.PI * 1.5;
        const isFocus = focus === arc.i || (pair && (pair.a === arc.i || pair.b === arc.i));
        return (
          <g key={arc.i} style={{ cursor: "pointer", transition: "opacity .18s", opacity: dim ? 0.28 : 1 }}
            onMouseEnter={() => onHover(arc.i)} onMouseLeave={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onPickProduct(arc.i); }}>
            <path d={annular(arc.start, arc.end, R, R + ringW + (isFocus ? 3 : 0))} fill={p.color} />
            <text x={lp[0]} y={lp[1]} fontSize="10.5" fontWeight={isFocus ? 700 : 500}
              textAnchor={flip ? "end" : "start"} dominantBaseline="middle"
              fill={isFocus ? "var(--text)" : "var(--text-secondary)"}
              transform={`rotate(${flip ? deg + 180 : deg} ${lp[0]} ${lp[1]})`}>{p.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- Co-occurrence matrix ---------------- */
function MatrixView(props) {
  const { products, pairs, hover, focus, pair, onHover, onPickProduct, onPickPair } = props;
  const N = products.length;
  const activeIdx = hover != null ? hover : (focus != null ? focus : null);
  const m = useMemo(() => {
    const mat = products.map(() => products.map(() => 0));
    pairs.forEach((p) => { mat[p.a][p.b] = p.count; mat[p.b][p.a] = p.count; });
    return mat;
  }, [products, pairs]);
  const max = Math.max.apply(null, pairs.map((p) => p.count)) || 1;
  const cell = 30, labelW = 116, labelH = 92;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={labelW + N * cell + 8} height={labelH + N * cell + 8} style={{ display: "block", margin: "0 auto" }}>
        {products.map((p, j) => {
          const x = labelW + j * cell + cell / 2;
          const on = activeIdx === j || (pair && (pair.a === j || pair.b === j));
          return <text key={"c" + j} x={x} y={labelH - 6} fontSize="10" fill={on ? "var(--text)" : "var(--text-tertiary)"} fontWeight={on ? 600 : 400}
            textAnchor="start" transform={`rotate(-45 ${x} ${labelH - 6})`} style={{ cursor: "pointer" }} onClick={() => onPickProduct(j)}>{p.name.length > 13 ? p.name.slice(0, 12) + "…" : p.name}</text>;
        })}
        {products.map((p, i) => {
          const y = labelH + i * cell;
          const rowOn = activeIdx === i || (pair && (pair.a === i || pair.b === i));
          return (
            <g key={"r" + i}>
              <text x={labelW - 8} y={y + cell / 2} fontSize="10.5" textAnchor="end" dominantBaseline="middle"
                fill={rowOn ? "var(--text)" : "var(--text-secondary)"} fontWeight={rowOn ? 600 : 400}
                style={{ cursor: "pointer" }} onClick={() => onPickProduct(i)} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}>
                {p.name.length > 15 ? p.name.slice(0, 14) + "…" : p.name}</text>
              {products.map((q, j) => {
                if (i === j) return <rect key={j} x={labelW + j * cell + 1} y={y + 1} width={cell - 2} height={cell - 2} rx="4" fill="var(--surface-inset)" />;
                const v = m[i][j], t = v / max;
                const isSel = samePair(pair, i, j);
                return (
                  <g key={j}>
                    <rect x={labelW + j * cell + 1} y={y + 1} width={cell - 2} height={cell - 2} rx="4"
                      fill={v ? "var(--primary)" : "var(--surface-2)"} opacity={v ? (isSel ? 1 : 0.14 + t * 0.86) : 1}
                      stroke={isSel ? "var(--text)" : "none"} strokeWidth={isSel ? 1.5 : 0}
                      style={{ transition: "opacity .15s", cursor: v ? "pointer" : "default" }}
                      onMouseEnter={() => v && onHover(i)} onMouseLeave={() => onHover(null)}
                      onClick={() => v && onPickPair({ a: i, b: j })}>
                      {v ? <title>{p.name} + {q.name} — {v} orders</title> : null}
                    </rect>
                    {v ? <text x={labelW + j * cell + cell / 2} y={y + cell / 2} fontSize="9.5" textAnchor="middle" dominantBaseline="middle"
                      fill={t > 0.5 || isSel ? "#fff" : "var(--text-secondary)"} fontFamily="var(--font-mono)" style={{ pointerEvents: "none" }}>{v}</text> : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------------- Ranked pairs ---------------- */
function PairsView(props) {
  const { products, pairs, pair, hover, onHover, onPickPair } = props;
  const sorted = useMemo(() => pairs.slice().sort((a, b) => b.count - a.count), [pairs]);
  const max = sorted[0] ? sorted[0].count : 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 372, overflowY: "auto", paddingRight: 4 }}>
      {sorted.map((p, k) => {
        const isSel = samePair(pair, p.a, p.b);
        const lit = !pair || isSel;
        return (
          <button key={k} className={cx("pairrow", isSel && "is-active")} onClick={() => onPickPair({ a: p.a, b: p.b })}
            onMouseEnter={() => onHover(p.a)} onMouseLeave={() => onHover(null)}
            style={{ opacity: lit ? 1 : 0.4 }}>
            <div className="row between" style={{ marginBottom: 5 }}>
              <span className="row" style={{ gap: 7, fontSize: 13, fontWeight: 500, minWidth: 0 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="legend-swatch" style={{ background: products[p.a].color }} />{products[p.a].name}</span>
                <span className="tertiary" style={{ fontWeight: 400 }}>+</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="legend-swatch" style={{ background: products[p.b].color }} />{products[p.b].name}</span>
              </span>
              <span className="mono" style={{ fontWeight: 700, fontSize: 13, flex: "0 0 auto", marginLeft: 8 }}>{p.count}<span className="tertiary" style={{ fontWeight: 400, fontSize: 11 }}>×</span></span>
            </div>
            <div style={{ height: 7, borderRadius: 99, background: "var(--chart-track)", overflow: "hidden" }}>
              <div style={{ width: (p.count / max * 100) + "%", height: "100%", borderRadius: 99, background: k === 0 ? "var(--chart-revenue)" : "var(--c4)", transition: "width .5s cubic-bezier(.2,.8,.2,1)" }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Side panels ---------------- */
function StatBox(props) {
  return (
    <div className="affstat">
      <div className="affstat__v mono" style={{ color: props.color }}>{props.value}</div>
      <div className="affstat__l">{props.label}</div>
    </div>
  );
}

function ProductPanel(props) {
  const { products, pairs, idx, totalN, onPickPair, onHover } = props;
  const p = products[idx];
  const s = productStats(products, pairs, idx);
  const maxc = s.partners[0] ? s.partners[0].count : 1;
  return (
    <div>
      <div className="row" style={{ gap: 10, marginBottom: 14 }}>
        <span className="affdot" style={{ background: p.color }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>{p.name}</div>
          <div className="tertiary" style={{ fontSize: 12 }}>{Fmt.num(p.orders)} orders · {Fmt.money(p.price)} UZS</div>
        </div>
      </div>
      <div className="affstats">
        <StatBox value={Fmt.num(s.combined)} label="Bought with others" color="var(--primary)" />
        <StatBox value={s.distinct} label="Partner items" />
        <StatBox value={Fmt.pct(s.attach * 100, 0)} label="Attach rate" color="var(--success)" />
      </div>
      <div className="kpi__label" style={{ margin: "16px 0 8px" }}>Pairs with {p.name.split(" ")[0]} · click to drill in</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 210, overflowY: "auto", paddingRight: 4 }}>
        {s.partners.map((pt) => {
          const o = products[pt.other];
          return (
            <button key={pt.other} className="afflist__row" onClick={() => onPickPair({ a: idx, b: pt.other })} onMouseEnter={() => onHover(pt.other)} onMouseLeave={() => onHover(null)}>
              <span className="legend-swatch" style={{ background: o.color }} />
              <span className="afflist__name">{o.name}</span>
              <span className="affbar"><span className="affbar__fill" style={{ width: (pt.count / maxc * 100) + "%" }} /></span>
              <span className="mono afflist__count">{pt.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PairPanel(props) {
  const { products, pairs, pair, totalN, onPickProduct } = props;
  const A = products[pair.a], B = products[pair.b];
  const st = pairStats(products, pairs, pair.a, pair.b, totalN);
  const liftStrong = st.lift >= 1.15;
  return (
    <div>
      <div className="affpairhead">
        <button className="affchip" onClick={() => onPickProduct(pair.a)}><span className="legend-swatch" style={{ background: A.color }} />{A.name}</button>
        <Icon name="plus" size={14} className="tertiary" />
        <button className="affchip" onClick={() => onPickProduct(pair.b)}><span className="legend-swatch" style={{ background: B.color }} />{B.name}</button>
      </div>
      <div className="affstats" style={{ marginTop: 14 }}>
        <StatBox value={Fmt.num(st.count)} label="Bought together" color="var(--primary)" />
        <StatBox value={st.lift.toFixed(2) + "×"} label="Lift vs chance" color={liftStrong ? "var(--success)" : "var(--text)"} />
        <StatBox value={Fmt.abbr(st.revenue)} label="Est. revenue" />
      </div>

      <div className="kpi__label" style={{ margin: "16px 0 8px" }}>Directional confidence</div>
      <div className="affconf">
        <div className="row between" style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 12.5 }}>Buyers of <b>{A.name.split(" ")[0]}</b> also add {B.name.split(" ")[0]}</span>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{Fmt.pct(st.confAB * 100, 0)}</span>
        </div>
        <div className="affbar affbar--lg"><span className="affbar__fill" style={{ width: Math.min(100, st.confAB * 100) + "%", background: A.color }} /></div>
        <div className="row between" style={{ margin: "10px 0 4px" }}>
          <span style={{ fontSize: 12.5 }}>Buyers of <b>{B.name.split(" ")[0]}</b> also add {A.name.split(" ")[0]}</span>
          <span className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{Fmt.pct(st.confBA * 100, 0)}</span>
        </div>
        <div className="affbar affbar--lg"><span className="affbar__fill" style={{ width: Math.min(100, st.confBA * 100) + "%", background: B.color }} /></div>
      </div>

      <div className={cx("affsuggest", liftStrong ? "is-good" : "is-soft")}>
        <Icon name={liftStrong ? "sparkle" : "info"} size={16} />
        <span>{liftStrong
          ? "Strong pairing — bundle as a combo or upsell " + B.name.split(" ")[0] + " at checkout."
          : "Mild pairing — worth a test promo, but not a natural combo yet."}</span>
      </div>
    </div>
  );
}

/* ---------------- The card ---------------- */
function AffinityCard(props) {
  const data = (window.DASH && window.DASH.affinity) || { products: [], pairs: [], totalOrders: 0 };
  const VIEWS = [
    { key: "chord", icon: "share", label: "Chord" },
    { key: "matrix", icon: "grid", label: "Matrix" },
    { key: "pairs", icon: "list", label: "Ranked" },
  ];
  const [view, setView] = useState("chord");
  const [hover, setHover] = useState(null);
  const [focus, setFocus] = useState(null);   // pinned product idx
  const [pair, setPair] = useState(null);     // selected pair {a,b}

  const pickProduct = (i) => { setPair(null); setFocus((cur) => cur === i ? null : i); };
  const pickPair = (pr) => { setFocus(null); setPair((cur) => samePair(cur, pr.a, pr.b) ? null : pr); };
  const reset = () => { setFocus(null); setPair(null); setHover(null); };

  const stats = useMemo(() => {
    const totalPairs = data.pairs.length;
    const totalTogether = data.pairs.reduce((a, p) => a + p.count, 0);
    const top = data.pairs.slice().sort((a, b) => b.count - a.count)[0];
    return { totalPairs, totalTogether, top };
  }, [data]);

  if (props.loading) return <DashLoading rows={1} />;

  const headerInsight = pair ? "Pair detail"
    : focus != null ? data.products[focus].name
    : stats.top ? data.products[stats.top.a].name + " + " + data.products[stats.top.b].name
    : "Product pairings";

  const vizProps = { products: data.products, pairs: data.pairs, hover, focus, pair, onHover: setHover, onPickProduct: pickProduct, onPickPair: pickPair };

  return (
    <Card>
      <div className="card__head">
        <div className="card__head-text">
          <div className="kpi__label">Frequently bought together · 30 days</div>
          <h3 className="card__insight">{headerInsight}</h3>
          <div className="card__sub">
            {(focus != null || pair) ? (
              <button className="affcrumb" onClick={reset}><Icon name="chevleft" size={13} />All products</button>
            ) : (stats.totalPairs + " product pairs · " + stats.totalTogether + " combined orders")}
          </div>
        </div>
        <div className="card__actions">
          <div className="viewtoggle" role="group" aria-label="Change visualization">
            {VIEWS.map((v) => (
              <button key={v.key} className={cx("viewtoggle__btn", view === v.key && "is-active")}
                onClick={() => { setView(v.key); }} title={v.label}><Icon name={v.icon} size={16} /></button>
            ))}
          </div>
        </div>
      </div>
      <div className="card__divider" />
      <div className="card__body" style={{ paddingTop: "var(--sp-5)" }}>
        <div className="affinity-body">
          <div className="affinity-viz">
            {view === "chord" && <ChordView {...vizProps} />}
            {view === "matrix" && <MatrixView {...vizProps} />}
            {view === "pairs" && <PairsView {...vizProps} />}
          </div>
          <div className="affinity-list">
            {pair ? <PairPanel products={data.products} pairs={data.pairs} pair={pair} totalN={data.totalOrders} onPickProduct={pickProduct} />
              : focus != null ? <ProductPanel products={data.products} pairs={data.pairs} idx={focus} totalN={data.totalOrders} onPickPair={pickPair} onHover={setHover} />
              : (
                <div>
                  <div className="row between" style={{ marginBottom: 10 }}>
                    <span className="kpi__label">Products · click to explore</span>
                    <span className="badge t-neutral">{data.products.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
                    {data.products.map((p, i) => {
                      const partners = data.pairs.filter((pr) => pr.a === i || pr.b === i).reduce((a, pr) => a + pr.count, 0);
                      return (
                        <button key={i} className={cx("afflist__row", hover === i && "is-active")}
                          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => pickProduct(i)}>
                          <span className="legend-swatch" style={{ background: p.color }} />
                          <span className="afflist__name">{p.name}</span>
                          <span className="mono afflist__count">{partners}</span>
                          <Icon name="chevright" size={14} className="afflist__go" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </Card>
  );
}

Object.assign(window, { AffinityCard, ChordView, MatrixView, PairsView });
