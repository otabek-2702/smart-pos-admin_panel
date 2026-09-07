# Supplier invoice integration verification — 2026-09-07

The delivered backend source implements the direct supplier-invoice contract. Production deployment was not confirmed: the public service still exposed the previous release during verification.

## Source examined

- Server: `7ab4589`, branch `feature/direct-supplier-invoices`.
- Core: `6393830abfd9d19298a688fd45122b9d358216bf`, pinned by the server commit.
- Server handoff: `docs/supplier-invoice-implementation.md` and its synthetic request, response, replay, and validation evidence.
- Core source: `stock/views/purchase_invoice_views.py` and `stock/services/purchase_invoices/`.
- The backend working tree was not changed. Remote refs were fetched for inspection.

## Live production evidence

Origin: `https://pos.78.111.90.65.nip.io`

At approximately 2026-09-07 12:26 UTC / 17:26 Asia/Tashkent:

| Read-only check | Actual result |
| --- | --- |
| `GET /healthz` | `ok 229f53622dc29ca5c271f74124927c17a8b39a36` |
| `GET /api/admins/stock/purchase-invoices/` | HTTP 404, route not found |
| `GET /api/admins/stock/purchase-invoices/receive/` | HTTP 404, route not found |

The GET on the receive URL only checks route registration; it does not post an invoice. The delivered view requires POST, so a deployed copy would reject GET with method-not-allowed rather than route-not-found.

The authenticated local frontend also showed the unavailable-history state and loaded existing supplier products only in preview mode. No production invoice, supplier balance, price, or stock quantity was changed by verification.

## Frontend adjustments to the delivered contract

- Handle the actual price-warning response: one flat `details` object with `line_index`, `old_price_uzs`, `new_price_uzs`, `difference_uzs`, and `percentage`. Map it to the submitted line even when the server omits `supplier_item_id`.
- Preserve affected stock/batch IDs in errors even when no item name is included.
- Match backend creator/poster filter names, pagination, aggregate totals, action history, and reversal/replacement metadata.
- Add typed reverse transport and optional replacement linkage. Correction buttons are not part of this integration change.
- Use the new invoice permissions across navigation, supplier shortcuts, and editor commands.
- Enforce backend quantity and UZS limits before submitting, and preserve stable keys for identical retries.
- Ignore stale history responses and reset history after a successful post.
- Display saved invoice notes, free-product reasons, price-change reasons, and translated posted/reversed labels.

## Deployment request for the backend developer

> Please verify the production invoice rollout. The public `/healthz` reported server `229f53622dc29ca5c271f74124927c17a8b39a36`, while the invoice implementation is server `7ab4589` with core `6393830abfd9d19298a688fd45122b9d358216bf`. Both invoice list and receive URLs returned route-not-found. Deploy the invoice commit (or a later release containing it), including its pinned core, and apply `base.0065_direct_supplier_invoices`, `stock.0018_direct_supplier_invoices`, and `stock.0019_direct_invoice_backfill`. Then send the final server/core revisions, migration confirmation, and an authenticated successful read of `/api/admins/stock/purchase-invoices/` and `/api/admins/stock/suppliers/{id}/receivable-items/`. If production uses a different origin, provide that origin. Do not create test invoices in restaurant accounts.

## Verification scope

Checks executed for this integration:

- Both contract regression files: 21 tests passed, zero failures.
- `yarn typecheck`: passed.
- `yarn build`: passed; existing unresolved asset warnings remain.
- Focused ESLint on the invoice page, service, types, navigation access, and warehouse page: passed. A broader navigation check reported 13 existing template-formatting warnings, not a clean warning-free result.
- Browser inspection against real supplier catalog data: desktop and 390px mobile, light/dark themes, grouped money display, keyboard focus, unavailable/preview states, and disabled preview posting. No horizontal overflow or browser-console errors were observed during these checks.

Frontend contract regression tests exercise the delivered response shapes and numeric request/idempotency behavior with isolated test data. Backend test counts in the handoff are evidence supplied by the backend developer, not tests rerun against production by the frontend agent.

Live create/post, weighted-cost persistence, supplier-ledger posting, and replay verification remain dependent on the invoice deployment and an appropriate test environment or a real authorized receipt.
