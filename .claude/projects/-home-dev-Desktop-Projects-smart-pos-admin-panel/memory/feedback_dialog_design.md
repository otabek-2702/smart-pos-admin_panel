---
name: Dialog design rules
description: Minimalist dialog design — no Cancel button (X is enough), no colored headers, integers only for prices, consistent sizing
type: feedback
---

Dialogs must follow these rules across the entire project:

1. **No Cancel button** — the X close button is sufficient, Cancel is redundant clutter.
2. **No colored/gradient headers** — keep dialogs clean and minimal. Use a small color indicator (like a rounded dot) instead of painting the whole header.
3. **Price inputs show integers only** — no decimals (.00) unless the business requires fractional prices.
4. **Consistent element sizing** — form inputs in dialogs should use the same density/sizing across the project.
5. **Design corrections apply globally** — when the user reports a UI issue, fix it everywhere in the project, not just the one page mentioned.

**Why:** User prioritizes minimalism and consistent UX. Too many colors and redundant buttons add visual noise.

**How to apply:** When building or modifying any dialog, check all these rules. When the user gives a correction for one page, scan and fix the same pattern across all pages.
