# End-to-end tests

Playwright journeys, grouped by area under [journeys/](journeys). Everything
here today is [journeys/auth/](journeys/auth) — the Defra ID integration, driven
against the real [cdp-defra-id-stub](https://github.com/DEFRA/cdp-defra-id-stub)
with nothing about auth mocked.

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
npm run test:e2e -- --project=default-app   # one app configuration
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
`playwright-report` artefact.

## Adding an area

Two things separate a journey from the others, and they are deliberately on
different axes:

- **What it is about** — the folder under `journeys/` and the tag on its
  `describe`. Registrations would be `journeys/registration/` tagged
  `@registration`, and `--grep @registration` would run just those.
- **Which app it runs against** — the Playwright project. `default-app` covers
  everything unless a spec needs an app configured differently, in which case it
  names itself in that project's `testMatch`.

So a new area needs a folder and a tag, and nothing in
[playwright.config.js](../playwright.config.js) unless it also needs its own app
configuration. Anything genuinely shared across areas belongs in
[support/](support); anything auth-specific stays with the auth journeys.

## How it is put together

Some journeys need the app configured differently from the others, so each
variant runs as its own instance on its own port and each project points at the
instance it needs — no restarting one app with different environment variables
part-way through a run.

| Project             | Port | Why it differs                                                              |
| ------------------- | ---- | --------------------------------------------------------------------------- |
| `default-app`       | 3100 | Defaults. Everything unless a spec opts out.                                |
| `redis-sessions`    | 3101 | Redis-backed sessions, so a test can read what is actually stored.          |
| `short-session-cap` | 3102 | Absolute session cap shrunk from four hours to 20 seconds.                  |
| `containerised-app` | 3000 | The Docker image, reached through `extra_hosts`. Not started by Playwright. |

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
