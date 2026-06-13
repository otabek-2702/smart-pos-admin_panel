# Backend feedback — Shift list serializer

**Endpoint:** `GET /api/admins/shifts`
**Serializer:** `admins/services/shift_service.py::ShiftService._serialize_shift` (list path, `detail=False`)

The frontend manager dashboard at `/shifts-analytics` shows shifts as cards. Each card already needs more detail than the current list serializer returns. The FE has been built with graceful fallback (shows `0` / `—` for missing fields), so adding these fields is non-breaking — wiring up is "fill the blanks".

## Fields needed on the LIST serializer (currently missing)

| Field | Type | How to compute | Already in detail? |
|-------|------|----------------|---------------------|
| `net_revenue` | string decimal | `total_revenue − expenses_total − cancelled_orders_value` | no (FE can derive if others present) |
| `expenses_total` | string decimal | Sum of cashbox/shift expenses linked to this shift (you already use this inside `cash_collected`) | no |
| `cancelled_orders_count` | int | `Order.objects.filter(shift=shift, status='CANCELLED').count()` | no |
| `cancelled_orders_value` | string decimal | Sum of `total_amount` of cancelled orders for this shift | no |
| `payment_mix` | `{ METHOD: { amount: str, count: int } }` | Already computed in `_shift_stats.payment_mix` | yes — promote to list |
| `items_sold` | int | Already `_shift_stats.units_sold` | yes — promote to list |
| `avg_prep_seconds` | int / null | Already `_shift_stats.avg_prep_seconds` | yes — promote to list |
| `peak_hour` | `{ hour: int (0-23), orders: int } / null` | Already `_shift_stats.peak_hour` | yes — promote to list |

### Payment methods to include

The FE recognises these keys (uppercase) and falls back to raw label for anything else:
`CASH`, `UZCARD`, `HUMO`, `PAYME`, `CLICK`, `MIXED`

### Field-naming notes

- Keep all amounts as **string decimals** (consistent with current `total_revenue`, `cash_collected`)
- `payment_mix.METHOD.amount` should be a string decimal too
- `peak_hour.hour` is the 24h integer (e.g. `13` for 13:00), `peak_hour.orders` is order count in that hour
- If `payment_mix` has no data (no paid orders), return `{}` not `null`

## Performance concern

`_shift_stats` currently runs 4 separate aggregates per shift. Calling it per-row on a list paged to 12 cards = 48 extra queries per page.

Two acceptable options:

**(A)** Add a lighter `_list_stats(shift)` that does only the 4 things we surface (cancellations, expenses, payment_mix, items_sold, avg_prep, peak_hour) in **one** query each, with `Prefetch`/`annotate` so the list endpoint does a single batched query across all shifts in the page.

**(B)** Do per-shift compute but ensure `.select_related('user', 'shift_template', 'reconciliation')` + a single `Order.objects.filter(shift__in=shifts).values('shift_id', 'payment_method', 'status').annotate(...)` aggregate, then attach to each shift dict before returning. Single round-trip.

Prefer **(B)** — same code path as detail, just batched.

## Response shape after this change (list item)

```json
{
  "id": 42,
  "uuid": "...",
  "user": { "id": 7, "uuid": "...", "name": "Karim Sodiqov" },
  "shift_template": { "id": 2, "uuid": "...", "name": "Morning" },
  "start_time": "2026-06-09T10:50:00+05:00",
  "end_time": "2026-06-09T16:36:00+05:00",
  "status": "COMPLETED",
  "total_orders": 42,
  "total_revenue": "1850000.00",
  "cash_collected": "820000.00",
  "is_live_stats": false,
  "duration_minutes": 346,
  "net_revenue": "1605000.00",
  "expenses_total": "245000.00",
  "cancelled_orders_count": 3,
  "cancelled_orders_value": "180000.00",
  "items_sold": 187,
  "avg_prep_seconds": 215,
  "peak_hour": { "hour": 13, "orders": 12 },
  "payment_mix": {
    "CASH":   { "amount": "820000.00", "count": 18 },
    "UZCARD": { "amount": "640000.00", "count": 14 },
    "CLICK":  { "amount": "290000.00", "count": 7 },
    "PAYME":  { "amount": "100000.00", "count": 3 }
  },
  "reconciliation": null
}
```

## Verification checklist (for BE dev after change)

- [ ] List endpoint responds in < 300ms with 50 shifts paged to 12 (Postman)
- [ ] `payment_mix` totals match `total_revenue` (± rounding)
- [ ] `cancelled_orders_count + total_orders == Order.objects.filter(shift=shift).exclude(status='DRAFT').count()`
- [ ] Live (ACTIVE) shifts return live numbers same way as current `total_revenue` is computed live
- [ ] Empty shifts (no orders) return `payment_mix: {}`, `items_sold: 0`, `peak_hour: null`, `avg_prep_seconds: null`
- [ ] N+1 sanity: total queries for one paged response should be O(1) not O(rows)

## Out of scope (already on frontend with `—`)

These are nice-to-haves that the FE will hide gracefully if you don't ship them:
- Avg ticket — FE derives from `total_revenue / total_orders`
- Reconciled-by name — already on `reconciliation` payload in current serializer

## Where the FE renders each field

| FE element | BE field |
|------------|----------|
| Big datetime row | `start_time`, `end_time`, `duration_minutes` |
| KPI: Orders | `total_orders` |
| KPI: Gross | `total_revenue` |
| KPI: Net | `net_revenue` (fallback: `total_revenue − expenses_total − cancelled_orders_value`) |
| Payment mix bar + rows | `payment_mix` |
| Cancelled tile | `cancelled_orders_count`, `cancelled_orders_value` |
| Expenses tile | `expenses_total` |
| Avg ticket | derived from `total_revenue / total_orders` |
| Items | `items_sold` |
| Avg prep | `avg_prep_seconds` |
| Peak | `peak_hour` |
| Variance footer | `reconciliation.difference`, `reconciliation.reconciled_by.name` |
