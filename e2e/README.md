# End-to-end tests

Playwright journeys, grouped by area under [journeys/](journeys). Everything
here today is [journeys/auth/](journeys/auth) — the Defra ID integration, driven
against the real [cdp-defra-id-stub](https://github.com/DEFRA/cdp-defra-id-stub)
with nothing about auth mocked — and [journeys/zap/](journeys/zap), a post-suite
assertion against OWASP ZAP when the proxy is on.

## Running them

```bash
docker compose up -d cdp-defra-id-stub   # also starts redis, which phase 8 needs
npm run test:e2e
```

Other entry points:

```bash
npm run test:e2e:ui                         # Playwright's watch mode
npm run test:e2e -- --grep @auth            # one area
npm run test:e2e -- --grep-invert @slow     # skip the journeys that wait out a session cap
npm run test:e2e -- sign-in                 # one spec
npm run test:e2e:report                     # last HTML report
```

Playwright starts the app itself, so `npm run dev` does not need to be running.
The containerised journey is the exception — it drives the compose `frontend`
service and skips itself when that is not up (`docker compose up -d`).

Every pull request runs the whole suite in the `e2e` job of
[check-pull-request.yml](../.github/workflows/check-pull-request.yml), which
brings the same compose stack up first so the containerised journey runs there
too. The HTML report and the app logs from a run are uploaded as the
`playwright-report` artefact. The same job proxies Chromium through ZAP and
uploads `zap-test-report` — see [OWASP ZAP](#owasp-zap).

## Adding an area

Two things separate a journey from the others, and they are deliberately on
different axes:

- **What it is about** — the folder under `journeys/` and the tag on its
  `describe`. Registrations would be `journeys/registration/` tagged
  `@registration`, and `--grep @registration` would run just those.
- **Which app it runs against** — the `baseURL`. Specs use relative paths and
  get the default instance; one that needs a differently configured app says so
  itself, with `test.use({ baseURL: appInstances.sessionStore.url })` at the top
  of the file.

So a new area needs a folder and a tag, and nothing in
[playwright.config.js](../playwright.config.js) unless it also needs its own app
configuration. Anything genuinely shared across areas belongs in
[support/](support); anything auth-specific stays with the auth journeys. The
ZAP gate is the exception — it is a project that depends on the journeys, not
another product area.

## How it is put together

Some journeys need the app configured differently from the others, so each
variant runs as its own instance on its own port and the spec that needs one
points itself at it — no restarting one app with different environment variables
part-way through a run. The instances are defined in
[support/app-instances.js](support/app-instances.js).

| Instance              | Port | Why it differs                                                              | Claimed by                     |
| --------------------- | ---- | --------------------------------------------------------------------------- | ------------------------------ |
| `app`                 | 3100 | Defaults. Everything that does not ask for another.                         | —                              |
| `sessionStore`        | 3101 | Redis-backed sessions, so a test can read what is actually stored.          | `session-store.spec.js`        |
| `shortAbsoluteTtl`    | 3102 | Absolute session cap shrunk from four hours to 20 seconds.                  | `absolute-session-ttl.spec.js` |
| `containerisedAppUrl` | 3000 | The Docker image, reached through `extra_hosts`. Not started by Playwright. | `containerised.spec.js`        |

Two routes exist only for these tests: `/e2e/protected`, which takes the
server-wide auth default, and `/e2e/role-protected`, which also requires a role
scope. The application's own pages are all deliberately public today, so without
them nothing would exercise route protection or the no-access page. They are
registered in [support/test-server.js](support/test-server.js) behind
`E2E_PROTECTED_ROUTES` and are never registered by `src/index.js`.

Each instance's stdout is captured to `e2e/.logs/app-<port>.log`, which is how
tests assert both the lines the app should write and the token contents it must
never write.

## Coverage of the manual checklist

| Phase                                 | Spec                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| 0 Environment up, 12 registered users | [environment.spec.js](journeys/auth/environment.spec.js)                       |
| 1 Signed-out state                    | [signed-out.spec.js](journeys/auth/signed-out.spec.js)                         |
| 2 Sign-in journey                     | [sign-in.spec.js](journeys/auth/sign-in.spec.js)                               |
| 3 Redirect preservation               | [redirect-preservation.spec.js](journeys/auth/redirect-preservation.spec.js)   |
| 4 Route protection default            | [route-protection.spec.js](journeys/auth/route-protection.spec.js)             |
| 5 Sign-out journey                    | [sign-out.spec.js](journeys/auth/sign-out.spec.js)                             |
| 6 Failure pages                       | [failure-pages.spec.js](journeys/auth/failure-pages.spec.js)                   |
| 7 Token refresh                       | **Not automated — see below**                                                  |
| 8 Sessions in Redis                   | [session-store.spec.js](journeys/auth/session-store.spec.js)                   |
| 9 Organisation switching              | [organisation-switching.spec.js](journeys/auth/organisation-switching.spec.js) |
| 10 Absolute session TTL               | [absolute-session-ttl.spec.js](journeys/auth/absolute-session-ttl.spec.js)     |
| 11 Containerised app                  | [containerised.spec.js](journeys/auth/containerised.spec.js)                   |

**Phase 7 (token refresh) is the one gap.** The app only refreshes within 60
seconds of an access token expiring, and tokens live an hour, so an end-to-end
test would have to either wait most of an hour or make the app behave
differently for the test's benefit. Neither was judged worth it: the refresh and
refresh-failure paths are both unit tested in
[get-cookie-options.test.js](../src/server/auth/get-cookie-options.test.js), and
phase 7 of the manual checklist still covers the round trip to the real stub.

The four "must never see" invariants — a JWT in a cookie, anything auth-related
in web storage, OIDC error detail on an error page, token contents in the app
logs — are in [support/invariants.js](support/invariants.js) and are asserted
from several journeys rather than from one place, because a leak is more likely
to arrive as a side effect of an unrelated change than as a failure of the thing
under test.

## Test users

[support/users.js](support/users.js) defines one user per situation (an
everyday operator, a user whose role is still pending, a user with two
organisations, and so on). Each has a fixed `userId`, so a run overwrites its
registrations rather than accumulating them, and a distinct email, so a spec can
pick its own row out of the stub's user table and its own session out of Redis.

They are registered by [support/global-setup.js](support/global-setup.js) before
the suite starts, which is also where an unreachable stub is turned into a clear
message rather than a screenful of timeouts.

## Things worth knowing before adding a journey

- **Defra ID keeps its own sign-in session.** After the app drops a session, a
  browser sent to `/auth/sign-in` can be signed straight back in without the
  stub showing anything. Assert the app's own 302 (`expectRedirectToSignIn`)
  rather than following the redirect and looking for the stub's page.
- **Sessions outlive tests.** A Redis session lives for four hours, so specs that
  read the store clear their user's previous sessions first.
- **Expiring a stub user is not reversible within a run**, so anything that uses
  the stub's `/expire` endpoint needs a fixture of its own and a re-registration
  afterwards.

## OWASP ZAP

Every pull request proxies Playwright Chromium through a ZAP daemon and then
runs [journeys/zap/alerts.spec.js](journeys/zap/alerts.spec.js) (`@zap`). That
spec waits until ZAP's passive scan queue is empty, writes HTML and JSON
reports to `zap-reports/`, and fails if any **High** alert was raised against
the batteries apps (ports 3000, 3100–3102). Medium and
Low stay in the report. The Defra ID stub on port 3200 is also proxied, but
its findings are excluded from the High gate.

Without the ZAP env vars, `npm run test:e2e` is unchanged — the zap project is
not registered, so the spec is ignored.

### Running locally

Start the same named services CI uses, then start ZAP. Do not
`up -d --wait` the whole compose file — that also waits on mongodb, and
`--wait` on ZAP hangs because the image healthcheck probes `localhost`
(remapped to the host by `extra_hosts`).

```bash
docker compose -f compose.yml -f compose-github.override-zap.yml \
  up -d --wait floci redis cdp-defra-id-stub frontend
docker compose -f compose.yml -f compose-github.override-zap.yml up -d zap
```

Wait until the daemon answers on the **host** URL, not `http://zap:8080` —
that hostname only resolves inside the Compose network:

```bash
curl -fsS http://127.0.0.1:8080/OTHER/core/other/rootcert/ -o /tmp/zap-root-ca.pem
export NODE_EXTRA_CA_CERTS=/tmp/zap-root-ca.pem
export ZAP_PROXY_URL=http://127.0.0.1:8080
export ZAP_PROXY_API_URL=http://127.0.0.1:8080
npm run test:e2e
docker compose -f compose.yml -f compose-github.override-zap.yml down
```

On PowerShell:

```powershell
curl.exe -fsS http://127.0.0.1:8080/OTHER/core/other/rootcert/ -o "$env:TEMP\zap-root-ca.pem"
$env:NODE_EXTRA_CA_CERTS = "$env:TEMP\zap-root-ca.pem"
$env:ZAP_PROXY_URL = 'http://127.0.0.1:8080'
$env:ZAP_PROXY_API_URL = 'http://127.0.0.1:8080'
npm run test:e2e
docker compose -f compose.yml -f compose-github.override-zap.yml down
```

Run the **full** suite, not `--grep @zap` on its own. The zap project depends on
the journeys so there is traffic to inspect; grep would filter those journeys
out and the scan would be empty.

Always bring the overlay stack down afterwards, including when the suite fails.

### Chromium and localhost

Chrome skips the proxy for loopback addresses unless it is launched with
`--proxy-bypass-list=<-loopback>`. [playwright.config.js](../playwright.config.js)
adds that flag whenever `ZAP_PROXY_URL` is set. Every batteries origin is
localhost, so without it the report would be empty and `@zap` would pass for
the wrong reason. The spec treats "ZAP saw no app origin" as a failure.

### Reading the reports

After a run, open `zap-reports/zap-report.html` (or the JSON next to it). CI
uploads that directory as the `zap-test-report` artefact and comments the
download link on the pull request.

`zap-reports/` is gitignored. Compose bind-mounts it into the daemon as
`/home/zap/reports`.
