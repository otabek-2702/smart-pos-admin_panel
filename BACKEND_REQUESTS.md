# Backend API Changes Needed

Single source of truth for backend changes the admin panel needs.
Old items cleared — only active asks below.

---

## 1. User create — role-based email + status

**Endpoint:** `POST /api/admins/users`

**Current behavior:** `email` is optional. When absent, backend generates
`firstname.lastname@local`. `status` defaults to `'ACTIVE'`. Service in
`admins/services/user_service.py:55` (`create_user`).

**Required change:**

- **ADMIN role:** `email` is **required** from the frontend. If missing →
  422 `{ errors: { email: 'email is required for ADMIN' } }`.
- **Any other role** (`MANAGER`, `CASHIER`, `WAITER`, `USER`):
  - Frontend does NOT send `email`.
  - Backend always auto-generates (`firstname.lastname[N]@local` per
    existing collision loop).
- **`status` field:** drop from create contract entirely. Backend hardcodes
  `'ACTIVE'` on creation. Status changes only via `PATCH /users/<id>`.
  Frontend will stop sending it.

**Rationale:** non-admin users (cashier / waiter) don't have real emails —
forcing one is friction. Only the admin account ever logs into the email
field (others use other identifiers / kiosk login). Status toggle on a
fresh user makes no sense; create is always ACTIVE.

**Acceptance:**
```
POST /api/admins/users { first_name, last_name, role: 'ADMIN', email, password }
→ 201, email persisted as given.

POST /api/admins/users { first_name, last_name, role: 'CASHIER', password }
→ 201, email = "first.last@local" auto-assigned.

POST /api/admins/users { first_name, last_name, role: 'ADMIN', password }
→ 422 errors.email = "email is required for ADMIN".
```

Same rule applies if a similar role-based contract is later added for
employee / customer creation — keep it consistent.
