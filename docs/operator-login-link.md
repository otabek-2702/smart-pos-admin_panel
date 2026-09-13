# Operator login links

Date: 2026-09-13.

This is the frontend contract for the explicitly requested email/password
click-to-login convenience feature. It does not create an account, grant a role,
or replace backend authentication. Backend delivery and production deployment
must be verified separately.

## Link formats

For a new link, use the trusted frontend origin and put the credentials in the
fragment, not the query string:

```text
https://<panel-origin>/login#email=<encoded-email>&password=<encoded-password>
```

Encode the email and password separately with `encodeURIComponent` before
joining the parameters. This preserves characters such as `+`, `&`, `#`, `%`
and `?`; do not concatenate unencoded values or encode the completed URL.
Placeholders above are not working credentials. Never put an actual password
or credential-bearing link into source code, tests, documentation, screenshots,
analytics, error reports, command history, or public messages.

Compatibility input formats:

```text
/login?email=<encoded-email>&password=<encoded-password>
/login?email=<encoded-email>?password=<encoded-password>
```

The second form tolerates the previously supplied extra `?` separator. It is
not the format to generate. Do not treat arbitrary extra question marks as
parameter delimiters or modify characters inside a correctly encoded password.

## Frontend behavior

1. Capture a recognized login link into short-lived application memory before
   router initialization, restored-session hydration, or Sentry initialization.
   A statement in the body of `main.ts` is too late if earlier static imports
   already read the URL or restore authentication; bootstrap ordering matters.
2. Remove credential parameters immediately with `history.replaceState`.
   Do not put the original URL or password into `history.state`, route state,
   local storage, session storage, or a persistent store. A reload after removal
   must not repeat the automatic login.
3. A complete valid credential pair starts a fresh authentication attempt.
   Discard the previous cached token, user and abilities before that request.
   Never redirect from the link into a cached session. Invalid or email-only
   links show the manual form without automatically changing the existing
   session or issuing a login request.
4. Accept only an unambiguous, non-empty email/password pair. Incomplete,
   duplicate, conflicting or malformed credentials must not produce a guessed
   login. Do not combine one credential from the query with another from the
   fragment. Decode parameter values once.
5. Send one automatic `POST /api/admins/auth-login`, with credentials in its JSON
   body, through the existing configured API client. The link must not choose
   the API origin, replace host settings, provide a bearer token, or grant a
   role. A previous session's Authorization header must not accompany this
   fresh credential exchange.
6. Keep a visible signing-in state until the backend accepts the credentials
   and normal session initialization completes. Disable duplicate submission
   while pending. Do not flash the previously authenticated dashboard.
7. On success, use the authenticated server identity, not link-supplied role or
   destination fields. Per the 2026-09-13 decision, an email beginning with
   `operator` (trimmed and case-insensitive, from flat or nested user data)
   selects the effective OPERATOR workspace even when the backend role is
   ADMIN. Explicit OPERATOR remains compatible; USER alone does not select it.
   Effective operators enter only `/operator/calls`, do not restore `manage/all`,
   open the admin shell, or honor an admin destination from the link.
8. On rejection, network failure, or an invalid link, show an understandable
   error and an editable login form. Clear the password and release the
   application-held credential references. The email may remain editable.
   Do not automatically retry, restore the previous account, or loop through
   redirects. Normal manual login remains available.

The existing session-token storage behavior after successful login is separate
from this feature. The link handler adds no password persistence. This does not
claim that browsers, extensions or password managers cannot retain information.

Native same-tab fragment/history navigation is handled before router listeners:
a recognized login link triggers one reload, then the fresh bootstrap consumes
and scrubs it. Ordinary hash/history navigation is unchanged. Case-insensitive
login paths accepted by the router are normalized to `/login` as well.

If the backend reports `409 account_switch_requires_logout`, its HTTP-only
session cookie still belongs to another account. Show the explicit sign-out
action; do not bypass the server guard or silently revoke an account. After
signing out, reopen the link or enter the password manually. Bind both login and
sign-out requests/responses to the captured token and API host so an old response
cannot overwrite or sign out a newly established session. A failed `/auth-me`
authentication check must not proceed to the calling page.

## Exposure limits and safe operation

Credentials in a query string can reach web logs, browser history/cache and
referrers despite HTTPS. Removing them in frontend JavaScript cannot remove
copies already captured by a server, proxy, browser, link scanner or monitoring
system. This is why new links use a fragment; it is an exposure reduction, not
a claim that embedding passwords in links is secure. See
[OWASP: information exposure through query strings](https://community.owasp.org/vulnerabilities/Information_exposure_through_query_strings_in_url).

Set `<meta name="referrer" content="no-referrer">` before resource-loading
elements in the document head. A matching HTTP `Referrer-Policy: no-referrer`
header is useful deployment hardening. Never log the full location or raw
Axios error/config/body for this flow. Keep credentials out of application
storage; scripts running on the origin can read browser-accessible storage.
These controls follow the concerns in
[OWASP: HTML5 security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#storage-apis).

The fragment still contains the reusable password. Anyone who receives or
copies the link can try that account until the password is changed or the
account is disabled. Browser extensions, clipboard/history synchronization,
screenshots and the channel used to share the link remain exposure risks.
Share only through an approved private channel. A least-privilege backend account
remains the safer target. Under the current email-prefix policy an actual ADMIN
account still has ADMIN server privileges: hiding admin pages does not restrict
its token at the API. Rotate a password if its link has been exposed; editing the
link does not revoke it.

Clicking a link selects the account represented by that link, which may differ
from the person using the browser. Treat unknown senders and unexpected account
changes cautiously. Automatic account switching has a login-CSRF/account
confusion risk; clearing the old session does not establish the recipient's
identity. OWASP discusses this class of risk in
[its login-form CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#possible-csrf-vulnerabilities-in-login-forms).

## Backend requirement and future replacement

The backend must still authenticate the actual account and enforce its actual
permissions. Current email-prefix ADMIN accounts use their own existing ADMIN
session and the already-authorized read-only Orders collector/detail adapter on
the calling page. The frontend does not change the stored backend role, provision
an ADMIN account, substitute tokens, or confer ADMIN access from an email prefix.
Actual non-admin calling accounts use only the dedicated queue; they never fall
back to Orders. A frontend link cannot repair rejected login, a missing queue,
or missing permissions. See [the historical least-privilege backend target and
current policy notice](customer-operator-backend-spec.md).

This feature is not a magic link: it has no server-issued one-time token,
independent expiry, or one-use invalidation. A future replacement should use an
opaque, unpredictable, short-lived, single-use server token bound to the
intended account, with server-side validation and rate limiting. That is a
separate backend feature; these token properties are consistent with
[OWASP's recovery-token guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#general-security-practices),
not evidence that this application already provides them.

## Verification checklist

Use synthetic credentials and a mocked transport for automated checks. Never
copy an operator's actual password into a fixture or test report.

- Preferred fragment, legacy query, and the supported extra-`?` typo decode
  correctly; encoded special characters are preserved.
- Missing, empty, duplicate, conflicting and malformed parameters cause no
  automatic authentication request and leave a usable manual form.
- Credential removal precedes router/Sentry initialization and session
  hydration. Neither URL history state nor browser storage retains a password.
- A saved ADMIN token cannot bypass link login, accompany its request, or
  survive a failed automatic authentication as an authenticated fallback.
- Exactly one pending login request is possible. Failure clears the password;
  refresh/back navigation does not silently replay the credential attempt.
- URL parameters cannot change the configured API host or bypass role-based
  post-login navigation. The backend, not a link field, supplies the role.
- Success, failure, keyboard use, mobile layout and all three locales are
  checked without recording real credentials or credential-bearing URLs.

### Login-link checks before the email-prefix policy (2026-09-13)

- All 184 contract tests passed, including 19 bootstrap parsing/navigation
  cases and mocked fresh-login, rejection, logout, and token/host race cases.
- Focused ESLint, `yarn typecheck`, and `yarn build` passed. Build still reports
  existing unresolved stylesheet asset references; this change does not repair
  those unrelated assets.
- Browser checks used only invalid or email-only synthetic links: desktop and
  390-pixel mobile layouts, light/dark themes, Uzbek/Russian/English messages,
  URL cleanup, native same-tab repeat links, and keyboard focus. The existing
  signed-in administrator session was preserved; no real credential POST or
  operator queue authorization was claimed as verified by these UI checks.
- That original verification did not create an account, deploy the frontend or
  verify production operator authentication/queue authorization. It is not
  acceptance evidence for the later email-prefix policy or deployment.
