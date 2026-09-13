# Customer feedback operator — backend implementation request

Updated: 2026-09-11. Status: requested contract, not a claim of deployed support.

Latest explicit product decision: use the existing `USER` role for the calling
page. This supersedes the earlier request to introduce an `OPERATOR` role. The
`operator` endpoint/permission namespace names the feature, not a new account
role. Backend authorization, password support and the dedicated queue are still
required; choosing an existing role does not prove those capabilities are deployed.

Backend ownership remains with the backend developer. Implement and deploy this
contract in the server/core repositories, then provide verification evidence for
frontend integration. This document does not authorize the frontend team to edit
backend files or provision a substitute privileged account.

## 1. Product scope

A mobile-first operator page selects one calendar date and shows one phone-linked
customer at a time: phone, optional name, that day's order times, order types,
optional hall/table label, and ordered item names/quantities. Previous and Next
navigate the queue. Include every eligible phone group for that day, not only
inactive customers; no retention threshold or historical-cadence filter applies.

The initial two static conversation prompts concern food taste and whether the
customer would recommend the restaurant. The frontend supplies EN/RU/UZ text.
V1 does not collect or persist questionnaire answers, call outcomes, call notes,
completion flags, or follow-up dates. **Next/Previous is navigation, not a saved
contact or completed call.** Do not imply successful contact from a page view,
phone-link activation, or navigation action.

No automatic calls/messages, bulk customer export, campaign management, financial
actions, or other back-office functions belong to this role.

## 2. Verified existing backend limitations

Read-only local inspection on 2026-09-11 found detached server `2c24860` and
detached core `4972f17`. The server has the pre-existing untracked `seed_orders.py`;
core is clean. No fetch, checkout or backend file changes were made for this check.

- Local `base/models.py:1025` already defines `USER`.
- Local `admins/services/auth_service.py:54,117` requires ADMIN for both login
  and `/auth-me`; USER is currently rejected.
- No dedicated `/api/admins/operator/call-queue` route or service exists in the
  inspected local source.

The earlier remote-ref inspection on 2026-09-10 used server `491c657` on
`origin/feature/cash-position-2026-09-08` and its pinned core `ec9769f`. Its
additional capabilities below must not be attributed to the older local checkout.
Neither local nor remote-ref hashes prove the revision deployed in production.

- The remote-ref `admins/services/auth_service.py:45,117` admits only ADMIN,
  MANAGER and WAREHOUSE to back-office login/current-user flows; USER is also
  excluded there.
- `POST /api/admins/users` is ADMIN/MANAGER authenticated. Its creation service
  supports a full password of at least eight characters for WAREHOUSE, but uses
  four-digit PIN validation for other login roles. Unknown roles are rejected
  (`admins/services/user_service.py:58`).
- General order list/detail routes require ADMIN
  (`admins/views/order_views.py:66,116`). ADMIN bypasses permission restrictions,
  including an empty permission list (`base/security/permissions.py`).
- The role editor cannot create arbitrary new role names. Hiding navigation or
  changing the label/permissions of an ADMIN, MANAGER, USER, CASHIER or WAREHOUSE
  account is not an operator-only security boundary.
- No dedicated operator queue, customer-call questionnaire, or saved call-outcome
  routes were found in the inspected server/core sources. Smartfood's OPERATOR
  support-message sender label is not an account role.

## 3. USER operator identity and server-side isolation

Use the existing canonical backend role `USER`; do not add OPERATOR, rename USER,
or substitute CASHIER, WAREHOUSE, MANAGER or ADMIN. Implement the required
serialization, session/authentication handling and tests for the intended
operator-enabled USER account. It must not appear in POS login pickers or inherit
another role's operational permissions. Preserve unrelated existing USER accounts
and their current customer-facing behavior.

The exact v1 capability key is `operator.call_queue.view`. Add it to the backend
permission catalog, explicitly grant it to the intended USER account, enforce it
on the dedicated queue, and include it in `user.permissions` from both login and
`/auth-me`. The integration contract requires both role USER and this capability;
the role alone must not grant access to customer calling data. Do not seed this
permission for every existing USER account or generally open back-office login
to that entire role. Require the explicit capability and confirmed operational
branch for the operator-enabled USER login/queue path.

Support the existing login shape:

```text
POST /api/admins/auth-login
Content-Type: application/json

{ "email": "<operator login>", "password": "<out-of-band credential>" }
```

Return the existing `{success:true,data:{token,user}}` envelope, with
`user.role="USER"` and the minimum identity/scope information needed by the
operator shell. `/auth-me` must accept an authorized operator-enabled USER without
widening any other business endpoint's role checks. Use full-password
authentication for this account, not a POS PIN;
accept the explicitly approved eight-character initial credential through a
secure provisioning handoff, never plaintext storage or logging. Preserve secure
hashing, login throttling, ACTIVE/deleted checks, expiry and revocation, credential
audience separation, and existing client/session protections.

The account is bound server-side to one explicitly authorized operational branch.
Derive that branch from the verified actor/session configuration. Never accept an
arbitrary branch, user ID, role, or permission list from an operator request.
Missing or ambiguous branch authorization fails closed, without cross-branch
customer enumeration. Do not silently use the old Orders endpoint's unscoped
account population.

### Required access matrix

| Surface | Operator-enabled USER | ADMIN |
| --- | --- | --- |
| Login; own `/auth-me`; own logout | Allowed, subject to session checks | Existing behavior |
| Own password change and own session revocation/listing | Allowed with existing ownership/auth checks | Existing behavior |
| `GET /api/admins/operator/call-queue` | Allowed, own authorized branch only | Allowed only with a resolved authorized branch |
| Future operator contact actions | Denied until separately implemented and authorized | No implied implementation |
| General `/api/admins/orders` and `/orders/{id}`, including every mutation | Denied | Existing behavior |
| Users, roles, permissions, customers, settings, dashboard, analytics and exports | Denied | Existing behavior |
| Stock, suppliers, purchasing, HR, payroll, shifts, treasury, cashbox, discounts, fiscalization and notifications | Denied | Existing behavior |
| Smartfood administration, broadcasts, AI/operations tools and licensing administration | Denied | Existing behavior |
| Desktop/POS, waiter, courier/mobile, sync/device and other business APIs, including legacy aliases | Denied with an operator credential | Existing behavior |

Use an explicit operator audience/role allowlist for its narrow routes; do not
make USER generally pass `admin_required`, `manager_required`, POS/courier
guards, or broad business permission checks. A manually supplied wildcard or
unrelated permission must not turn an operator-enabled USER session into an ADMIN/POS/mobile
session. Changing a role or suspending an account must invalidate or safely
re-evaluate existing sessions. Check actual backend routes, not only frontend
navigation or route guards. Public static assets remain public; they do not
grant authenticated business capabilities.

## 4. Dedicated complete one-day queue

```text
GET /api/admins/operator/call-queue?date=YYYY-MM-DD
```

`date` is required and strictly parsed. Use `Asia/Tashkent`, not the browser's
timezone. Earliest accepted date is `2026-08-01`; reject an earlier or future
calendar date. Do not substitute a default date for invalid input.

```text
from_at = selected date at 00:00:00 Asia/Tashkent
to_at   = next date at 00:00:00 Asia/Tashkent
today: to_at = min(next midnight, server now fixed at request start)
membership: from_at <= order.created_at < to_at
```

This is a continuous calendar-day interval. Do not use the 03:00 visit-day cutover,
07:00 opening, or a recurring quiet-hours exclusion. At the instant today's
interval has zero duration (`from_at == server now`), reject it as `INVALID_DATE`;
the caller can retry once time advances. Every successful response requires
`from_at < to_at`. This aligns with the current frontend's strict nonempty-window
validation; a zero-duration successful empty response would be rejected there.

Freeze the selected membership and projected fields consistently for this
response. `snapshot_id` is an opaque, unguessable identifier bound to actor scope,
date and snapshot revision; it is not a raw phone, source credential, or reversible
encoding of personal data. A date bound is not historical reconstruction of
payment/status: eligibility uses source state at the coherent queue read.

The endpoint returns the **entire** selected day's eligible contactable queue in
one response. Maximum: 2,000 phone groups and 5,000 qualifying contactable orders.
Check both limits before success. Exceeding either returns an explicit error and
no partial customers array. Never truncate, apply hidden first-page limits, or
present partial coverage as a complete queue. Bound source queries and payloads;
an additional documented source/payload safety limit must likewise fail explicitly.

### Qualification and identity

- Require `is_deleted=false`, `is_paid=true`, status other than `CANCELED`, and
  type HALL, DELIVERY or PICKUP. Do not require COMPLETED/READY: paid PREPARING
  orders also qualify. Exclude explicitly staff-linked customers.
- Resolve phone-bearing orders even when the customer FK is missing. Do not
  invent a phone/name, and do not exclude an otherwise usable phone-only order.
- Normalize valid Uzbek local/country-code forms and explicit international
  numbers to E.164. Reject invalid/all-zero placeholders rather than guessing a
  country or taking the final digits of arbitrary text.
- A populated valid historical order phone takes precedence. Only a missing,
  whitespace-only or unfilled `+998` order phone permits valid customer-phone
  fallback. A populated invalid order phone must not redirect contact to the
  customer's different number. Retain reconciliation evidence internally.
- Globally group by the resolved normalized phone over the entire selected
  authorized day, not by a page or channel. Return one queue customer per phone;
  several HALL/DELIVERY/PICKUP orders for it appear together. A phone group does
  not assert that a household/shared phone represents one verified person.
- Exclude existing do-not-contact, invalid-number and unresolved identity
  suppression from the queue. Look up the shared authoritative suppression state
  after normalization; formatting changes, new orders, date changes and phone-only
  grouping must not bypass it. Do not reinterpret Telegram marketing opt-in as
  general permission to call. V1 does not create or clear contact preferences.
- Do not merge unrelated call notes between conflicting verified identities.
  Keep a colliding/suppressed group out of routine contact pending reconciliation.

Within each customer, order by `created_at DESC, id DESC`; use that customer's
latest selected-day order for queue ordering, descending timestamp then ID, with
opaque key as final tie-breaker. All order IDs and customer keys are unique in
their appropriate response grain. Return no empty customer-order groups.

### Exact successful response

The following is a type contract, not sample customer data:

```ts
interface OperatorCallQueueResponse {
  success: true
  data: {
    date: string                 // YYYY-MM-DD
    time_zone: 'Asia/Tashkent'
    from_at: string              // ISO timestamp with explicit offset or Z
    to_at: string                // ISO timestamp with explicit offset or Z
    snapshot_id: string          // opaque, nonempty, maximum 200 code units
    total_customers: number      // exactly customers.length
    customers: Array<{
      key: string                // opaque scoped contact key, maximum 200 code units
      phone: string              // normalized valid E.164
      name: string | null        // maximum 200 code units; null when unavailable
      orders: Array<{
        id: number               // positive safe integer
        order_number: string | null // maximum 64 code units
        created_at: string       // ISO timestamp with explicit offset or Z
        order_type: 'HALL' | 'DELIVERY' | 'PICKUP'
        place_label: string | null // maximum 200 code units
        items: Array<{           // at most 500 live item lines per order
          name: string           // nonempty, maximum 200 code units
          quantity: number       // finite; 0 < quantity <= 100000
        }>
      }>
    }>
  }
}
```

These string limits are JavaScript UTF-16 code units (`string.length`), matching
`src/services/operatorCalls.ts`; supplementary Unicode characters count as two.
Keep opaque keys/IDs ASCII where practical. The backend must emit canonical
number quantities, although the adapter tolerates numeric strings from existing
admin detail responses. Booleans, zero, negative, nonfinite and over-limit
quantities are invalid. Empty `items:[]` is allowed for genuinely unavailable
detail; `items:null` is not a dedicated queue response (it is reserved for the
ADMIN preview's not-yet-loaded local state).

Return every required property, using null for unavailable optional display
strings. Item names, keys and snapshot IDs must be meaningful nonempty strings,
not whitespace placeholders. Emit canonical E.164 without display separators;
the adapter rejects even a normalizable phone if its supplied form differs from
the normalized result. Timestamps must include date, `T`, hours/minutes/seconds,
optional fractional seconds, and `Z` or an explicit `+HH:MM`/`-HH:MM` offset.

Do not silently truncate items, order numbers, names or labels to satisfy these
bounds. If the source cannot produce a complete compatible payload, return an
explicit safe contract/resource error rather than an incomplete successful queue.

`order_number` uses the public `order_number`, then `display_id` when appropriate,
serialized as a string; null means neither public label is available. `place_label`
is an authorized hall/place/table display label when genuinely available; otherwise
null. Never substitute a delivery address, customer note or guessed room name.
Only non-deleted item lines belong in `items`. Use the actual product/order-line
name and positive quantity; unavailable source detail must produce an honest
empty/detail-unavailable state or explicit error, not invented menu items.

Do not add payment breakdowns, amounts, cashier/employee profiles, addresses,
coordinates, private descriptions, other-day history, unrelated customer fields,
tokens or internal permission details to queue rows. Personal data must not be
embedded in `key`, `snapshot_id`, URLs, logs or analytics. Send private/no-store
caching headers and no shared cache entry containing a queue.

An empty valid selection returns success with `total_customers:0, customers:[]`.
Permission failure, invalid dates, suppression-service failure, missing source
data and resource limits must never masquerade as that successful empty state.

### Errors

Use `{success:false,code,message,errors?}` and safe localized/translation-ready
messages. Minimum stable codes:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 401 | `AUTHENTICATION_REQUIRED` / `AUTHENTICATION_INVALID` | Missing/invalid session |
| 403 | `PERMISSION_DENIED` / `ACCOUNT_SUSPENDED` | Role, audience, scope or account denial |
| 422 | `INVALID_DATE` / `OBSERVATION_BEFORE_CUTOFF` / `FUTURE_DATE` | Invalid requested day |
| 422 | `OPERATOR_SCOPE_REQUIRED` | No single authorized branch can be resolved |
| 422 | `OPERATOR_QUEUE_LIMIT_EXCEEDED` | More than 2,000 groups or 5,000 qualifying orders |
| 429 | `RATE_LIMITED` | Bounded request rate exceeded; include retry guidance |
| 503 | `OPERATOR_QUEUE_NOT_READY` / `SOURCE_UNAVAILABLE` | Feature/source unavailable |

## 5. Frontend-only ADMIN preview

Before the dedicated endpoint is deployed, an authenticated **ADMIN only** may
explicitly preview the mobile layout from the existing read-only one-day Orders
collector. Preserve its nontransactional coverage warnings. Load item detail
lazily for the current customer rather than fetching details for an entire month.

The current frontend always selects this preview branch for ADMIN; it does not
automatically switch ADMIN to the dedicated endpoint after deployment. Its
5,000-order guard counts all collected day headers before eligibility/phone
filtering, a deliberately more conservative preview limit than the dedicated
endpoint's qualifying-contactable-order limit. Do not silently copy that preview
restriction into the production operator contract.

The actual existing detail contract at server `491c657` is:

```text
GET /api/admins/orders/{id}
response body: {success:true,data:{order:{...,items:[...]}}}
item name:     data.order.items[].product.name
item quantity: data.order.items[].quantity
order time:    data.order.created_at
order type:    data.order.order_type
```

For an Axios response the leading body is `response.data`. Detail items use a
nested `product`; list items use flat `product__name`, so do not confuse their
paths. Source: `admins/services/order_service.py:441-507,882`.

The existing detail serializer exposes neither `place_label`, `place`, nor `table`.
Set preview `place_label=null` and hide the missing label. Do not mine description
or delivery address for a substitute. Its generic payload includes more sensitive
fields; the preview adapter must retain/render only the required display fields.

**The USER operator must never fall back to `/orders` or `/orders/{id}`**, including on 404,
403, 503, malformed payload, missing items, timeout or feature-not-ready errors.
The USER operator path exclusively uses the dedicated queue, which already embeds
items. Show the explicit unavailable/error state without retries against broader
APIs. Do not auto-export or persist the full queue/contact records locally.

## 6. Future contact/answer persistence — not v1

No call-outcome/questionnaire routes exist in the inspected source. The existing
`customer-retention-backend-spec.md` is also a request, not implemented storage.
Its inactivity-episode workflow must not be reused unchanged for this all-customer
daily feedback queue. Share authoritative identity and suppression state, but
model general feedback independently of inactivity episodes.

A later reviewed contract may add:

```text
POST /api/admins/operator/customers/{key}/calls
Idempotency-Key: <stable per-operation UUID>
```

Proposed shared contact-state shape:

```ts
interface OperatorContactState {
  customer_key: string
  version: number
  do_not_contact: boolean
  invalid_number: boolean
  next_follow_up_at: string | null
  last_call: {
    id: string
    created_at: string
    outcome: 'REACHED' | 'NO_ANSWER' | 'CALL_BACK' | 'WRONG_NUMBER' | 'DO_NOT_CONTACT'
  } | null
}
```

Future writes require a server-owned actor/time, expected contact version, stable
idempotency key, append-only audit/history, rechecked branch/identity/suppression,
atomic state/version updates and explicit replay/conflict semantics. Questionnaire
answers need separately agreed typed question IDs, language-independent values
and a questionnaire version; the two static v1 prompts are not a storage schema.
Do not silently accept unsupported answers or fabricate local successful saves.

DO_NOT_CONTACT and WRONG_NUMBER must suppress future routine contact and clear
scheduled follow-up. They survive new orders, new snapshots, date changes,
ordinary outcomes and phone normalization. An operator cannot clear suppression.
Any future clearing route requires a separately authorized administrative action,
recorded reason/evidence and audit; it must not erase old calls. Snapshot age must
not bypass current suppression when future contact writes are checked.

## 7. Provisioning and acceptance handoff

Only after implementation/deployment and backend authorization tests pass, the
backend developer provisions `operator@smartfood.local` as ACTIVE USER with
`operator.call_queue.view` for the confirmed branch. The initial user-approved
password is supplied separately by a
secure handoff; **do not put its value in this document, source, examples, tests,
logs, commits or exported artifacts**. Do not change an existing account's role,
password or permissions without first checking whether the login already exists
and confirming the intended target. Do not create a substitute role account.

Required acceptance evidence:

1. The intended USER account logs in using the agreed full-password flow and
   `/auth-me` returns USER with `operator.call_queue.view`; it is absent from
   cashier/manager/POS/courier login surfaces. Missing or revoked capability denies
   queue access. An unrelated USER account must not gain operator login or queue
   access merely because it shares the role.
2. Exercise the access matrix with actual requests, including legacy/mobile/POS
   routes, guessed IDs, foreign branch keys, wildcard grants, expired/revoked
   sessions, suspension and role changes. Every unauthorized path fails closed.
3. Calendar bounds include midnight, exclude next midnight, preserve 00:00-03:00
   and quiet hours, reject pre-August/future/invalid dates, and cap today at fixed
   server time. Equivalent offset timestamps behave consistently.
4. Paid non-canceled/non-staff HALL/DELIVERY/PICKUP orders qualify, including paid
   PREPARING orders. No inactivity threshold applies. Unpaid/canceled/deleted and
   explicitly staff orders do not enter the queue.
5. Phone-only/null-customer orders, format variants, placeholder/invalid numbers,
   historical/current phone differences, shared-phone collisions and existing
   suppression obey the rules without cross-scope leaks.
6. Whole-day grouping combines cross-channel orders once per normalized phone;
   every returned order is within bounds and unique. Counts and complete items
   reconcile across source pagination and concurrent source changes.
7. Exactly 2,000 groups/5,000 orders succeed; exceeding either limit fails with
   `OPERATOR_QUEUE_LIMIT_EXCEEDED` and no truncated result. Empty, outage,
   permission, scope and rate-limit states remain distinguishable.
8. Minimal response fields match the schema; source item names/quantities are
   honest, missing place/name labels remain null, and logs contain no credentials
   or customer contact details. DNC state is not cleared by queue reads.
9. Previous/Next and phone-link activation perform no completion/answer/outcome
   mutation. The USER operator never calls the generic admin Orders API; ADMIN preview is
   explicitly separate.

Provide server/core/deployed commit hashes, any required migrations, the explicit
USER account permission grant, exact
routes, focused test command/count/results, redacted success/empty/error examples,
branch-scope evidence and confirmed account provisioning. Account creation and
operator security are not complete until this backend evidence is reviewed.
