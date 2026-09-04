# waste-batteries-reg-frontend

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_waste-batteries-reg-frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-batteries-reg-frontend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_waste-batteries-reg-frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-batteries-reg-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_waste-batteries-reg-frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-batteries-reg-frontend)

Core delivery platform Node.js Frontend Template

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd waste-batteries-reg-frontend
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run everything in docker, you can use:

```bash
docker compose up -d
```

To run the application in development mode without docker, you will need to have the following services running locally:

The app authenticates with Defra ID and fetches its OIDC configuration at
startup, so start the local [Defra ID stub](#defra-id-authentication) first:

```bash
docker compose up -d cdp-defra-id-stub
```

Then run the application in `development` mode:

```bash
npm run dev
```

### Defra ID (authentication)

This service signs users in with Defra ID (see [specs/defra-id.md](specs/defra-id.md)).
Locally it uses the [cdp-defra-id-stub](https://github.com/DEFRA/cdp-defra-id-stub),
which `docker compose up -d cdp-defra-id-stub` starts on port `3200` along with
its dependencies (Redis and DynamoDB via floci). All `defraId` config defaults
point at the stub — no environment setup needed.

Create a test user either through the stub's UI (you are redirected there on
sign-in) or via its API:

```bash
curl -H "Content-Type: application/json" -X POST \
  -d '{
    "userId": "86a7607c-a1e7-41e5-a0b6-a41680d05a2a",
    "email": "jo.bloggs@example.com",
    "firstName": "Jo",
    "lastName": "Bloggs",
    "loa": "1",
    "aal": "1",
    "enrolmentCount": 1,
    "enrolmentRequestCount": 1,
    "relationships": [
      {
        "organisationName": "Acme Waste Ltd",
        "relationshipRole": "Employee",
        "roleName": "user",
        "roleStatus": "3"
      }
    ]
  }' \
  http://localhost:3200/cdp-defra-id-stub/API/register
```

To test token refresh without waiting for expiry, force it:

```bash
curl -X POST http://localhost:3200/cdp-defra-id-stub/API/register/86a7607c-a1e7-41e5-a0b6-a41680d05a2a/expire
```

After auth changes, run the end-to-end journeys — they cover sign-in, redirect
preservation, route protection, sign-out, the failure pages, token refresh,
session storage, organisation switching and the absolute session cap, against
the real stub:

```bash
docker compose up -d cdp-defra-id-stub
npm run test:e2e
```

See [e2e/README.md](e2e/README.md) for what each journey covers and how the
suite is put together.

In deployed environments the identity provider is set per environment:
the CDP-hosted stub in `dev`, real Defra ID in `test`, `perf-test` and `prod` —
via the `DEFRA_ID_*` environment variables and CDP service secrets.

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag waste-batteries-reg-frontend`

Build:

```bash
docker build --target development --no-cache --tag waste-batteries-reg-frontend:development .
```

Run:

```bash
docker run -p 3000:3000 waste-batteries-reg-frontend:development
```

### Production image

Build:

```bash
docker build --no-cache --tag waste-batteries-reg-frontend .
```

Run:

```bash
docker run -p 3000:3000 waste-batteries-reg-frontend
```

### Docker Compose

A local environment with:

- Floci (replacing Localstack) for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out backend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Code quality and coverage are analysed by
[SonarCloud](https://sonarcloud.io/summary/new_code?id=DEFRA_waste-batteries-reg-frontend)
on every pull request and on every publish. The quality gate appears as a check
on the pull request; the badges at the top of this file track `main`.

What is analysed is set in [sonar-project.properties](./sonar-project.properties)
— `src/` is the production code, and the unit tests, the Playwright journeys and
[test-helpers/](./test-helpers) are all declared as test code. Coverage comes
from the `./coverage/lcov.info` that `npm test` writes, so the scan runs after
the tests in each workflow.

To run the same scan locally:

```bash
SONAR_TOKEN=your-token ./sonarCloudLocal.sh
```

The script runs `npm test`, uploads the analysis with `@sonar/scan`, then writes
unresolved issues to `sonar-issues.json` and, when `python3` is available, a
copy/paste friendly `sonar-issues.md`.

To match the SonarCloud pull request summary view, pass the pull request key:

```bash
SONAR_TOKEN=your-token SONAR_PULL_REQUEST=6 ./sonarCloudLocal.sh
```

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
