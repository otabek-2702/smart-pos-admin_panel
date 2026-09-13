# Operator calling workspace: mobile UI options

2026-09-13. Design proposals, not a backend delivery claim.

## Current decision

The user selected option 2 (Order brief). Use a compact customer header,
separate order cards and a fixed bottom Call / Previous / Next dock, with
enough bottom padding to keep the final item clear. Each order includes its
received time and recorded preparation duration in rounded-up minutes.
Suppress the order comment only when it repeats the delivery address (ignoring
case and whitespace); keep differing comments and all original backend data.

Remove the repeated dialer explanation, question script, unsaved-feedback
warning and Next/progress warning. Keep truthful behavior: Call is a `tel:`
link, Next is navigation, and neither action records a completed conversation.
Show order type prominently, together with the available delivery address,
order comment and each item's comment. Missing data must not be invented.

When the operator starts loading a day, enter a
focused workspace: hide the full page header and date controls,
retain a compact way to change the day, and move focus into the loaded
customer content. Loading, empty and failure states must remain usable.

## Three UI directions

| Option | Structure | Best use |
| --- | --- | --- |
| 1. Focus card, initial recommendation | Compact day/back control and position, phone number, Call, order type/time, address/comments/items, Previous/Next | Quick sequential calls with minimum distraction |
| 2. Order brief, selected | Small customer header, detailed order receipt(s), bottom action dock | Customers with longer instructions or multiple orders |
| 3. Queue and detail | Compact customer list opens a focused detail view; Next continues without returning to the list | Revisiting a person or future callback workflows |

The preview uses synthetic customers, masked phone numbers and explicitly
labelled sample layouts. Its Call buttons are inert. Changing the sample date
does not imply that backend data was loaded. Next changes only the sample
customer; there are no saved outcomes or network requests.

The preview is outside the repository at
`C:/Users/Jason/Documents/Codex previews/operator-mobile-2026-09-13/operator-mobile-options.html`.
Do not copy sample customers into production application data.

## Interaction criteria

- After Load, move focus to the current-customer heading and bring it into
  view. Hidden controls must not remain in keyboard navigation. Programmatic
  focus on static content is permitted when the resulting focus order stays
  meaningful. [W3C Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- Use generous touch targets, approximately 48px for frequently used controls.
  W3C's enhanced target-size criterion is 44 by 44 CSS pixels; larger targets
  help sequential tasks and one-handed use.
  [W3C Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
- Keep focused controls and the final item comment clear of sticky actions,
  including mobile safe areas. Reduce animated scrolling when the device
  requests reduced motion.
  [W3C Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html),
  [W3C Reduced Motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)
- Returning from the dialer must keep the current customer. Do not infer a
  conversation from a link click or returning to the browser. Apple's
  documented webpage phone-link flow asks for confirmation, and Android's
  dialer action leaves dialing to the user.
  [Apple Phone Links](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html),
  [Android Common Intents](https://developer.android.com/guide/components/intents-common#Phone)
- Test 320px through desktop widths, light/dark themes, long translated labels,
  long comments, keyboard focus, empty orders and retryable detail failures.

## Future features, in priority order

Only the selected layout and local resume position are approved and implemented
here; the remaining recommendations need later approval.

1. **Resume position — approved and implemented locally.** The browser remembers
   the selected day, an order-ID anchor, list-end flag and customer count per
   authenticated account/API origin. A fresh login link still authenticates;
   the calling page then reloads the authorized queue and restores the matching
   customer even if rows moved. No phone, name, address, comment, password or
   token is added to this bookmark. Previous is available; Copy number remains
   a proposal. This is not a saved call outcome or cross-operator coordination.
2. **Explicit call outcomes — backend persistence.** Connected, No answer,
   Busy and Wrong number. Store the operator, relevant customer/order, time and
   stable operation ID. Do not make Next silently record an outcome.
3. **Callbacks — backend persistence.** Chosen callback date/time and a due
   callback queue; record the customer's request without automatically dialing.
4. **Do not call and duplicate-contact protection — backend enforcement.**
   Suppression should apply across days and operators. Show the latest actual
   contact attempt so the same person is not repeatedly called unknowingly.
5. **Short feedback and manager follow-up — backend persistence.** If approved,
   capture taste/recommendation answers and an optional note, with a distinct
   escalation action. Do not reintroduce the removed long question script.
6. **Customer history — backend aggregation.** Last order date, order count and
   last call outcome, with expandable history. The source and reporting period
   must remain explicit; incomplete frontend pages are not lifetime totals.

Explicit outcomes, notes and scheduled follow-up tasks are established CRM
patterns, including on mobile.
[HubSpot activity logging](https://knowledge.hubspot.com/records/manually-log-activities-on-records)

No call recording, automatic dialing or personal-contact collection is proposed.
These suggestions make no legal compliance claim. The frontend-only effective
operator workspace does not reduce an actual ADMIN account's backend privileges.

## Implemented and checked locally

- Order brief layout is implemented in `/operator/calls`; other layouts remain
  proposals. The initial visual checks below were for the prior Focus layout.
- Requested helper sections are removed. Order type, delivery address, order
  comment and item comments use the existing authorized detail adapter; the
  dedicated queue supports the additive optional fields documented in the
  operator backend specification.
- 201 contract tests pass, including 39 operator service/page tests. Production
  build, TypeScript check and scoped lint pass. Build retains existing unrelated
  unresolved style-asset warnings.
- Browser checked against the signed-in local app with real read-only orders:
  390px Uzbek/light and 320px Russian/dark, plus desktop. Header/date controls
  disappear, focus moves to the customer, Next returns to the top, and Change
  day restores heading focus. Real delivery address and order comment render;
  item comments and stale-response handling are additionally covered by
  synthetic service/page tests and labelled previews. No horizontal overflow
  was observed at the checked widths.
- All three previews were exercised, including Next, queue/detail/return and
  day selection, in light/dark appearances. No phone call was initiated, no
  business record was changed, and these changes have not been deployed.

### Local progress behavior

- A valid saved day loads automatically after authentication on this same
  browser/origin. Switching to a different device/browser does not transfer it;
  clearing site data removes it.
- Next, Previous, initial successful loading, Finish and return from the list
  end save navigation immediately. Failed, canceled or empty loads leave the
  previous valid bookmark untouched. Changing day opens the picker without
  erasing the last working customer.
- Missing saved customer: start at the first customer with an explicit notice.
  A finished list stays finished only when the anchor is still last and the
  customer count is unchanged; otherwise resume the matching customer.
- Storage errors do not block calling; show a notice that progress cannot be
  saved. Corrupt/future/unsupported bookmarks are ignored without deleting
  other accounts' records. Host/account changes cannot save an old queue into
  another scope. Progress restoration does not bypass login or server access.

### Latest verification

- 232 contract tests pass, including 32 calling-page tests, 30 operator service
  tests and 8 bookmark-helper tests. Scoped lint and TypeScript check pass.
- The selected Order brief layout, single delivery-address rendering and
  recorded preparation minutes were verified with real read-only orders at
  390px. Timing labels align even when translations wrap; the two-row action
  dock has reserved bottom content space.
- Live bookmark/re-login browser verification remains pending: the original
  browser disconnected and the reconnected browser was at the login form.
  No credentials were entered or authentication bypassed. Automated tests
  verify remount/resume, fresh-link session cleanup, corrupt/unavailable storage,
  stale response/unmount protection and account/API-origin isolation.
- Release-scope contract checks: 213 tests pass, excluding unrelated untracked
  customer-analysis and design-control tests. Deployment status is tracked in
  the Vercel checks for the corresponding Git commit, not inferred from these
  local verification results.
