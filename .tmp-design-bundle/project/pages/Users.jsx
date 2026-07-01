/* ============================================================
   ALPHA POS — Users (table + New/Edit form, all states)
   ============================================================ */
const { useState, useEffect, useMemo } = React;

function emptyUser() { return { first: "", last: "", role: "CASHIER", status: "ACTIVE", email: "", password: "" }; }

function UserForm(props) {
  const editing = !!props.user.id;
  const [form, setForm] = useState(() => Object.assign(emptyUser(), props.user, { password: "" }));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => Object.assign({}, f, { [k]: v }));
  const blur = (k) => setTouched((t) => Object.assign({}, t, { [k]: true }));

  const validate = (f) => {
    const e = {};
    if (!f.first.trim()) e.first = "First name is required";
    if (!f.last.trim()) e.last = "Last name is required";
    if (!f.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email address";
    if (!editing && !f.password) e.password = "Password is required for a new user";
    else if (f.password && f.password.length < 6) e.password = "Use at least 6 characters";
    return e;
  };
  useEffect(() => { setErrors(validate(form)); }, [form]);
  const showErr = (k) => touched[k] && errors[k];

  const submit = () => {
    setTouched({ first: 1, last: 1, email: 1, password: 1 });
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setTimeout(() => { setSaving(false); props.onSave(form); }, 800);
  };

  return (
    <Modal title={editing ? "Edit user" : "New user"}
      subtitle={editing ? "Update details for " + props.user.first + " " + props.user.last : "Create a new account and assign a role"}
      onClose={props.onClose}
      footer={<React.Fragment>
        <Button variant="ghost" onClick={props.onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={saving} icon="check">{editing ? "Save changes" : "Create user"}</Button>
      </React.Fragment>}>
      <div className="form-grid">
        {editing && (
          <Field label="User ID" className="span-2" hint="Identifier is assigned automatically and can't be changed.">
            <div className="control is-disabled"><Icon name="lock" size={16} /><input value={"#" + props.user.id} disabled /></div>
          </Field>
        )}
        <Field label="First name" error={showErr("first")}>
          <Input value={form.first} placeholder="Dilnoza" error={showErr("first")} onChange={(e) => set("first", e.target.value)} onBlur={() => blur("first")} />
        </Field>
        <Field label="Last name" error={showErr("last")}>
          <Input value={form.last} placeholder="Saidova" error={showErr("last")} onChange={(e) => set("last", e.target.value)} onBlur={() => blur("last")} />
        </Field>
        <Field label="Role"><Select value={form.role} onChange={(v) => set("role", v)} options={DB.roles} /></Field>
        <Field label="Status"><Select value={form.status} onChange={(v) => set("status", v)} options={DB.statuses} /></Field>
        <Field label="Email" className="span-2" error={showErr("email")}>
          <Input type="email" icon="mail" value={form.email} placeholder="name@pos.local" error={showErr("email")} onChange={(e) => set("email", e.target.value)} onBlur={() => blur("email")} />
        </Field>
        <Field label={editing ? "New password" : "Password"} className="span-2"
          error={showErr("password")} hint={editing ? "Leave blank to keep the current password." : "Minimum 6 characters."}>
          <Input type="password" icon="lock" value={form.password} placeholder={editing ? "Leave blank to keep" : "••••••••"} error={showErr("password")} onChange={(e) => set("password", e.target.value)} onBlur={() => blur("password")} />
        </Field>
      </div>
    </Modal>
  );
}

function OrdersDeleteConfirm(props) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Delete user?" width={440} onClose={props.onClose}
      footer={<React.Fragment>
        <Button variant="ghost" onClick={props.onClose} disabled={busy}>Cancel</Button>
        <Button variant="danger" loading={busy} icon="trash" onClick={() => { setBusy(true); setTimeout(props.onConfirm, 700); }}>Delete user</Button>
      </React.Fragment>}>
      <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
        <div className="kpi__icon t-error" style={{ width: 44, height: 44, flexBasis: 44 }}><Icon name="alert" size={22} /></div>
        <div>
          <p style={{ margin: 0, fontWeight: 600 }}>{props.user.first} {props.user.last} will be removed.</p>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 14 }}>This permanently deletes the account and revokes access. This action can't be undone.</p>
        </div>
      </div>
    </Modal>
  );
}

function UsersPage(props) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState(DB.users);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [editUser, setEditUser] = useState(null);   // object or null
  const [delUser, setDelUser] = useState(null);
  const toast = useToast();

  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, []);

  const filtered = useMemo(() => users.filter((u) => {
    const name = (u.first + " " + u.last + " " + u.email).toLowerCase();
    if (q && !name.includes(q.toLowerCase())) return false;
    if (role && u.role !== role) return false;
    if (status && u.status !== status) return false;
    return true;
  }), [users, q, role, status]);

  const saveUser = (form) => {
    if (form.id) {
      setUsers((us) => us.map((u) => u.id === form.id ? Object.assign({}, u, form) : u));
      toast({ tone: "success", title: "User updated", msg: form.first + " " + form.last + " saved." });
    } else {
      const id = Math.max.apply(null, users.map((u) => u.id)) + 1;
      setUsers((us) => [Object.assign({}, form, { id })].concat(us));
      toast({ tone: "success", title: "User created", msg: form.first + " " + form.last + " added as " + form.role + "." });
    }
    setEditUser(null);
  };
  const toggleStatus = (u) => {
    const ns = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setUsers((us) => us.map((x) => x.id === u.id ? Object.assign({}, x, { status: ns }) : x));
    toast({ tone: ns === "ACTIVE" ? "success" : "warning", title: u.first + " " + (ns === "ACTIVE" ? "reactivated" : "suspended") });
  };
  const doDelete = () => {
    setUsers((us) => us.filter((x) => x.id !== delUser.id));
    toast({ tone: "error", title: "User deleted", msg: delUser.first + " " + delUser.last + " removed." });
    setDelUser(null);
  };

  const activeFilters = [
    q && { k: "q", label: "Search", val: q, clear: () => setQ("") },
    role && { k: "r", label: "Role", val: role, clear: () => setRole("") },
    status && { k: "s", label: "Status", val: status, clear: () => setStatus("") },
  ].filter(Boolean);
  const clearAll = () => { setQ(""); setRole(""); setStatus(""); };

  const columns = [
    { key: "id", label: "ID", sortable: true, width: 80, render: (u) => <span className="mono cell-muted">{u.id}</span> },
    { key: "name", label: "Name", sortable: true, width: 220, sortValue: (u) => u.first, render: (u) => (
      <div className="row" style={{ gap: 11 }}>
        <div className="avatar avatar--sm">{u.first[0]}</div>
        <span className="cell-strong nowrap">{u.first} {u.last}</span>
      </div>
    ) },
    { key: "email", label: "Email", sortable: true, render: (u) => <span className="cell-muted">{u.email}</span> },
    { key: "role", label: "Role", sortable: true, render: (u) => <Badge tone={STATUS_TONE[u.role] || "neutral"}>{u.role}</Badge> },
    { key: "status", label: "Status", sortable: true, render: (u) => <StatusBadge value={u.status} dot /> },
  ];
  const rowActions = (u) => (
    <React.Fragment>
      <IconAction icon={u.status === "ACTIVE" ? "pause" : "play"} tone="warning" title={u.status === "ACTIVE" ? "Suspend" : "Activate"} onClick={() => toggleStatus(u)} />
      <IconAction icon="edit" tone="primary" title="Edit" onClick={() => setEditUser(u)} />
      <IconAction icon="trash" tone="danger" title="Delete" onClick={() => setDelUser(u)} />
    </React.Fragment>
  );

  return (
    <div className="page">
      <PageHeader title="Users" subtitle="Manage accounts, roles and access"
        actions={<Button variant="primary" icon="plus" onClick={() => setEditUser(emptyUser())}>New user</Button>} />

      <div className="grid cols-4" style={{ marginBottom: "var(--sp-5)" }}>
        {DB.usersKpis.map((k) => loading ? <KpiSkel key={k.key} /> : <Kpi key={k.key} data={k} />)}
      </div>

      <Card>
        <div className="toolbar">
          <div className="grow" style={{ maxWidth: 300 }}><Input icon="search" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div style={{ width: 180 }}><Select icon="filter" placeholder="All roles" value={role} onChange={setRole} options={DB.roles} /></div>
          <div style={{ width: 180 }}><Select placeholder="All statuses" value={status} onChange={setStatus} options={DB.statuses} /></div>
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
        <DataTable columns={columns} rows={filtered} getRowId={(u) => u.id} loading={loading}
          selectable rowActions={rowActions} initialSort={{ key: "id", dir: "desc" }}
          bulkActions={(rows, clear) => (
            <React.Fragment>
              <Button variant="secondary" size="sm" icon="pause" onClick={() => { rows.forEach(toggleStatus); clear(); }}>Suspend</Button>
              <Button variant="danger-soft" size="sm" icon="trash" onClick={() => { toast({ tone: "error", title: rows.length + " users deleted" }); setUsers((us) => us.filter((u) => !rows.find((r) => r.id === u.id))); clear(); }}>Delete</Button>
            </React.Fragment>
          )}
          emptyState={<StateFill icon="users" title="No users match your filters"
            action={<div style={{ marginTop: 12 }}><Button variant="secondary" onClick={clearAll}>Clear filters</Button></div>} />}
        />
      </Card>

      {editUser && <UserForm user={editUser} onClose={() => setEditUser(null)} onSave={saveUser} />}
      {delUser && <OrdersDeleteConfirm user={delUser} onClose={() => setDelUser(null)} onConfirm={doDelete} />}
    </div>
  );
}

Object.assign(window, { UsersPage });
