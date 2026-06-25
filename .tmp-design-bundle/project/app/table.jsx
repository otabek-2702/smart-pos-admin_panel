/* ============================================================
   ALPHA POS — DataTable
   sortable · sticky header · selection + bulk bar · expandable
   rows · inline actions · client pagination · loading/empty states
   ============================================================ */
const { useState, useEffect, useMemo } = React;


function SkeletonRows(props) {
  const cols = props.cols, rows = props.rows || 8;
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}><Skeleton h={14} w={c === 0 ? "40%" : c === cols - 1 ? "50%" : "70%"} /></td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function DataTable(props) {
  const {
    columns, rows, getRowId, loading, selectable, bulkActions,
    rowActions, renderExpand, perPage = 10, initialSort, emptyState, onRowClick,
  } = props;

  const [sort, setSort] = useState(initialSort || { key: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [pp, setPp] = useState(perPage);
  const [selected, setSelected] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());

  const idOf = getRowId || ((r) => r.id);

  // sort
  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const val = col && col.sortValue ? col.sortValue : (r) => r[sort.key];
    const arr = rows.slice().sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av === bv) return 0;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (sort.dir === "desc") arr.reverse();
    return arr;
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pp));
  const curPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((curPage - 1) * pp, curPage * pp);

  useEffect(() => { setPage(1); }, [rows.length]);

  const toggleSort = (key) => {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(idOf(r)));
  const someSelected = selected.size > 0 && !allOnPageSelected;
  const toggleAll = () => {
    setSelected((s) => {
      const n = new Set(s);
      if (allOnPageSelected) pageRows.forEach((r) => n.delete(idOf(r)));
      else pageRows.forEach((r) => n.add(idOf(r)));
      return n;
    });
  };
  const toggleOne = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExpand = (id) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());

  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0) + (renderExpand ? 1 : 0);
  const selectedRows = rows.filter((r) => selected.has(idOf(r)));

  return (
    <div>
      {selectable && selected.size > 0 && (
        <div className="bulkbar">
          <Checkbox checked={allOnPageSelected} indeterminate={someSelected} onChange={toggleAll} />
          <span className="bulkbar__count">{selected.size} selected</span>
          <div style={{ flex: 1 }} />
          {bulkActions && bulkActions(selectedRows, clearSel)}
          <Button variant="ghost" size="sm" onClick={clearSel}>Clear</Button>
        </div>
      )}
      <div className="tablewrap">
        <table className="dtable">
          <thead>
            <tr>
              {renderExpand && <th style={{ width: 40 }} />}
              {selectable && (
                <th style={{ width: 44 }}>
                  <Checkbox checked={allOnPageSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cx(c.align === "right" && "num", c.align === "center" && "center", c.sortable && "sortable")}
                  style={{ width: c.width }} onClick={() => c.sortable && toggleSort(c.key)}>
                  {c.label}
                  {c.sortable && (
                    <span className={cx("sort-ic", sort.key === c.key && "is-active")}>
                      <Icon name={sort.key === c.key ? (sort.dir === "asc" ? "sortup" : "sortdown") : "sort"} size={13} />
                    </span>
                  )}
                </th>
              ))}
              {rowActions && <th className="num" style={{ width: 120 }}>Actions</th>}
            </tr>
          </thead>
          {loading ? <SkeletonRows cols={colCount} rows={pp > 10 ? 10 : pp} /> : (
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={colCount} style={{ padding: 0 }}>
                  {emptyState || <StateFill icon="inbox" title="No results" sub="Nothing matches your filters." />}
                </td></tr>
              ) : pageRows.map((r) => {
                const id = idOf(r);
                const isOpen = expanded.has(id);
                return (
                  <React.Fragment key={id}>
                    <tr className={cx(selected.has(id) && "is-selected")} onClick={() => onRowClick && onRowClick(r)} style={{ cursor: onRowClick ? "pointer" : "default" }}>
                      {renderExpand && (
                        <td style={{ width: 40 }}>
                          <button className="iconaction" onClick={(e) => { e.stopPropagation(); toggleExpand(id); }} title="Expand">
                            <Icon name="chevright" size={16} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                          </button>
                        </td>
                      )}
                      {selectable && <td><Checkbox checked={selected.has(id)} onChange={() => toggleOne(id)} /></td>}
                      {columns.map((c) => (
                        <td key={c.key} className={cx(c.align === "right" && "num", c.align === "center" && "center", c.cellClass)}>
                          {c.render ? c.render(r) : r[c.key]}
                        </td>
                      ))}
                      {rowActions && <td className="num"><div className="row-actions">{rowActions(r)}</div></td>}
                    </tr>
                    {renderExpand && isOpen && (
                      <tr className="row-expand"><td colSpan={colCount}><div className="expand-inner">{renderExpand(r)}</div></td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
      {!loading && sorted.length > 0 && (
        <Pagination page={curPage} pages={totalPages} perPage={pp} total={sorted.length}
          onPage={setPage} onPerPage={(v) => { setPp(v); setPage(1); }} />
      )}
    </div>
  );
}

window.DataTable = DataTable;
