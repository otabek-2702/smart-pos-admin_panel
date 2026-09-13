# Customer calls frontend verification — 10 September 2026

## 11 September follow-up — current role/UI decision

The administrator/new-backend-role notice has been removed, including its three
translation entries. Logged-in USER (including normalized lowercase/nested
`user`) now opens only the full `/operator/calls` page. This supersedes the
OPERATOR-only UI described in the original verification below; OPERATOR remains
compatible. USER receives only the frontend calling-page capability, not admin
abilities, settings requests, other navigation or general Orders access. The
backend must still authorize the specific USER account and dedicated queue.

133 contract tests pass, covering USER redirects, cached ability restriction,
wildcard denial, dedicated-queue loading/no fallback and page navigation without
the notice. Focused lint, type-checking (119.15 seconds) and production build
(90.05 seconds) passed. Real ADMIN data for 10 September showed 43 phone groups;
banner-free mobile/dark and desktop/light layouts had no horizontal overflow.
USER behavior was verified with source-based contract tests, not a provisioned
live USER login. The backend request was revised to use existing
USER rather than creating a new role; its login/queue delivery is still pending.

## Original 10 September implementation/verification

- `/operator/calls`: mobile-first, blank-layout daily calling queue, with EN/RU/UZ text, theme control and logout.
- One normalized phone group at a time; the selected calendar day's orders appear together with time, channel, actual item names and quantities. Missing names/place labels are not invented.
- `tel:` dialer link, Previous/Next, date reset, loading/cancel/retry/error/empty/end states. Navigation does not initiate calls or record contact completion.
- Static taste/recommendation prompts. Answers, call outcomes and refresh-resume progress are not persisted in this version.
- Dedicated future OPERATOR permission and route isolation. OPERATOR uses only `/operator/call-queue`; it never falls back to general Orders endpoints. Cached wildcard abilities do not grant operator access to administrator pages.
- ADMIN-only preview uses existing read-only Orders endpoints. It is visibly marked as a preview; item details load only for the currently displayed customer.
- Shared language switcher now has a translated accessible name; shared icon set includes a phone glyph.

## Checks actually executed

- 130 contract tests passed, including operator service/access/page regression coverage, requests spanning midnight, actionable backend date/limit/readiness errors, and existing invoice/settlement regressions.
- Final `yarn typecheck` passed (146.86 seconds).
- Production build passed. Existing unresolved stylesheet asset warnings remain.
- Focused operator/access/router/login/navigation lint passed. The existing sidebar has 11 baseline formatting warnings; the shared static icon registry retains its existing `v-html` warning. No newly introduced lint errors remain.
- Real Chrome ADMIN preview for 9 September: 41 phone groups. Actual dish names/quantities rendered through order detail requests.
- Previous/Next changed and restored the customer; focus returned to the customer heading. Verified a correctly formed `tel:` link without activating it or calling anyone.
- Mobile widths 390px and 320px, desktop width 1440px, light/dark themes, and Uzbek/Russian/English labels checked. No horizontal overflow in inspected states.
- Invalid pre-August date displayed a localized error and removed the previous customer. Race, cancellation, permissions and local-navigation behavior also have contract tests; no real OPERATOR session was available for live role testing.

## Backend/account status

The inspected backend does not yet support the OPERATOR account role, its full-password back-office login or dedicated daily call queue. No operator account, substitute administrator account, production write, push or deployment was made for this feature.

Send `docs/customer-operator-backend-spec.md` to the backend developer. Secure operator rollout is pending its implementation, deployed endpoint verification and account provisioning.

## Private contact export

The saved customer snapshot covers 1 August 2026 at 00:00 through 10 September 2026 at 12:39:34, Asia/Tashkent (exclusive cutoff). It is not live and is not a transactional database snapshot. Its 1,354 phone groups include 866 one-time inactive, 154 repeat inactive and 334 active groups under the documented retention rules; they are phone groups, not verified unique people.

The snapshot includes 2,163 eligible phone-linked orders. It does not contain product lines; the private workbook explicitly labels them unavailable. The mobile preview obtains actual item details separately. Personal contact files remain in the Git-ignored `.private/customer-retention/` directory and must not be committed or publicly hosted.

The delivered compatibility workbook was opened and saved successfully in native Excel, then rechecked for exact text phones, dates, all row counts and AutoFilter ranges. Its totals and classifications are fixed snapshot values, not formulas that recalculate when filtered. Native PDF rendering was unavailable; all four final sheets were inspected using explicitly labeled, privacy-redacted Pillow layout previews.
