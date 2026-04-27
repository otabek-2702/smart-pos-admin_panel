# Backend API Changes Needed

This file lists API changes required by the frontend admin panel. These are features the frontend UI already supports but the backend doesn't yet.

---

## 1. CRITICAL: Date Filtering on Orders

### `GET /orders` (list) — add `date_from`, `date_to`, `search` params

**Current:** Accepts `page, per_page, statuses, payment_status, category_ids, user_id, cashier_id, order_by`
**Needed:** Add 3 new query params:

| Param | Type | Description |
|---|---|---|
| `date_from` | `string (YYYY-MM-DD)` | Filter orders created on or after this date |
| `date_to` | `string (YYYY-MM-DD)` | Filter orders created on or before this date |
| `search` | `string` | Search by display_id, phone_number, description, or order_type |

**Where to change:**
- `main/views/order_views.py` → `list_orders()` — read `date_from`, `date_to`, `search` from `request.GET` and pass to service
- `main/services/order_service.py` → `get_all_orders()` — add params to function signature, filter queryset:
  ```python
  if date_from:
      queryset = queryset.filter(created_at__date__gte=date_from)
  if date_to:
      queryset = queryset.filter(created_at__date__lte=date_to)
  if search:
      queryset = queryset.filter(
          Q(display_id__icontains=search) |
          Q(phone_number__icontains=search) |
          Q(description__icontains=search) |
          Q(order_type__icontains=search)
      )
  ```
  Note: `Q` needs to be imported from `django.db.models`

### `GET /orders/stats` — add `date_from`, `date_to` params

**Current:** `get_order_stats()` takes no arguments, aggregates ALL orders
**Needed:** Filter by date range

**Where to change:**
- `main/views/order_views.py` → `get_stats()` — read `date_from`, `date_to` from `request.GET`
- `main/services/order_service.py` → `get_order_stats()` — add params, filter base queryset before aggregation
  ```python
  def get_order_stats(date_from=None, date_to=None):
      queryset = Order.objects.all()
      if date_from:
          queryset = queryset.filter(created_at__date__gte=date_from)
      if date_to:
          queryset = queryset.filter(created_at__date__lte=date_to)
      stats = queryset.aggregate(...)  # instead of Order.objects.aggregate(...)
      completed_orders = queryset.filter(...)  # instead of Order.objects.filter(...)
  ```

---

## 2. CRITICAL: Date Filtering on Inkassa Stats

### `GET /inkassa/stats` — add `date_from`, `date_to` params

**Current:** Uses a fixed period from last inkassa timestamp
**Needed:** Accept date range to filter the stats period

The old Django admin dashboard (`main/utils/dashboard.py`) already has this logic with `date_from`/`date_to` params — the same filtering needs to be applied to the API endpoint.

---

## 3. MEDIUM: Missing Fields in Stock List Endpoints

These fields exist in the detail endpoint but are missing from the list endpoint:

### `GET /purchase-orders/` (list)
- **Missing:** `payment_status` field — exists in detail (`GET /purchase-orders/{id}/`) but not in list response
- **Fix:** Add `payment_status` to the list serialization

### `GET /transfers/` (list)
- **Missing:** `transfer_type` field — the header exists in the frontend but the list response doesn't include it
- **Fix:** Add `transfer_type` to the list serialization

---

## 4. LOW: Sessions & Delivery Person APIs

These models exist in Django admin but have no REST API endpoints:

### Session management
- `GET /sessions/` — list active user sessions
- No endpoint currently exists (returns 404)

### Delivery Person management
- `GET /delivery-persons/` — CRUD for delivery personnel
- No endpoint currently exists (returns 404)

---

## 5. REFERENCE: Endpoints That Already Work

These were verified and work correctly (no changes needed):

| Endpoint | Filters Working |
|---|---|
| `GET /items/` | `search`, `item_type`, `category_id` |
| `GET /suppliers/` | `search`, `is_active` |
| `GET /units/` | `search`, `unit_type` |
| `GET /locations/` | `search`, `type` |
| `GET /levels/` | `search`, `location_id`, `low_stock` |
| `GET /recipes/` | `search`, `recipe_type` |
| `GET /transfers/` | `status`, `search` |
| `GET /transactions/` | `movement_type`, `location_id`, `search`, `date_from`, `date_to` |
| `GET /purchase-orders/` | `status`, `payment_status`, `search`, `supplier_id` |
| `GET /production-orders/` | `status`, `priority`, `search` |
| `GET /counts/` | `status`, `location_id` |
| `GET /batches/` | `status`, `search`, `location_id`, `expiring_days`, `expired` |
