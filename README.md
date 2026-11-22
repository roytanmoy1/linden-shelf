# Linden Shelf

A customer can browse five editorial picks, explore a category, search, open a
product and send an enquiry to sales. No account, payment or email-provider
credentials are needed to try it locally.

| Directory | Responsibility |
| --- | --- |
| [services/catalogue-web](services/catalogue-web) | React routes, pages, forms and same-origin API client |
| [services/catalogue-api](services/catalogue-api) | HTTP endpoints, catalogue rules, supplier and SMTP adapters |
| [packages/contracts](packages/contracts) | Shared TypeScript types, runtime validation and limits |
| [tests](tests) | Shared fixtures, browser journeys, compiled-server smoke and configuration checks |
| [docs](docs) | Verification evidence, time log and a guided code walkthrough |

Unit tests stay beside the code they exercise. Start with the
[interview walkthrough](docs/interview.md) to trace a real search and enquiry.

## Stack and Rationale

The client is React with Vite and TypeScript; the backend is Node.js with Express
and TypeScript. Both are explicitly permitted by the assessment. Vite keeps this
small client-rendered catalogue straightforward; no server-rendering requirement
justifies another application framework. Express provides a small HTTP boundary,
while shared TypeScript/Zod contracts keep client and server validation aligned.

Product-source and email adapters stay behind the backend. This makes provider
changes testable without rewriting the UI, while a themed component layer and
CSS tokens keep the eventual creative design independent of catalogue rules.

## Run with Compose

Prerequisites: a running Docker engine with Compose v2 and internet access.
From the project root, no credentials or environment-file copy are required:

```sh
docker compose up --build
```

- Catalogue: `http://localhost:3000`
- Local sales inbox: `http://localhost:8025`
- API health through the web proxy: `http://localhost:3000/api/health`

Only web and inbox ports are published, both on loopback. API and SMTP are
internal. Mailpit is ephemeral local acceptance infrastructure; stopping its
container loses captured messages. Stop with `docker compose down`.

Alternate ports in PowerShell:

```powershell
$env:WEB_PORT='3100'
$env:MAILPIT_HTTP_PORT='8125'
docker compose up --build
```

Compose derives allowed browser origins from `WEB_PORT`, including both
`localhost` and `127.0.0.1`. It deliberately fixes SMTP to internal Mailpit.
Healthchecks make no public-source calls and send no email. The Dockerfiles use
Node 24.22.3, unprivileged nginx 1.31.7 and Mailpit 1.34.0 with non-root processes,
read-only filesystems, temporary writable directories and dropped capabilities.

**This path has static configuration tests, not runtime verification.** The three
exact image tags were confirmed in the public registry, including Linux amd64 and
arm64 variants. Docker is unavailable here. Image pulls/builds, Compose
startup, Linux shutdown and the under-ten-minute cold-start target are unverified.

## Native Development

Prerequisites: Node 24, npm 11 and an installed Mailpit binary for genuine local
SMTP. Validated application toolchain: Node 24.22.3/npm 11.21.3. With these
prerequisites and a populated npm cache, a clean source copy reached the real
browser catalogue in **3 minutes 47 seconds**, including install and build.
This was a native run, not a Docker timing. From the root:

```sh
npm ci
npm run build
```

Start Mailpit in one terminal:

```sh
mailpit --listen 127.0.0.1:8025 --smtp 127.0.0.1:1025
```

Start the API in a second terminal. A fresh checkout needs no `.env`:

```sh
npm run start:api
```

Start the web app in a third terminal:

```sh
npm run start:web
```

Open `http://127.0.0.1:5173`; `npm run dev` is the same web command. Vite proxies
`/api` to `127.0.0.1:3001`. For an occupied web port, use
`npm --prefix services/catalogue-web run dev -- --port 5180` and restart the API
with the matching `ALLOWED_ORIGINS`. Never stop an unrelated process to free a port.
API health is `http://127.0.0.1:3001/api/health`. Stop processes with Ctrl+C.
Startup and health do not contact FakeStore or SMTP. Product requests need internet.

An older host can use an isolated toolchain, without a global upgrade:

```sh
npm exec --yes --package=node@24.22.3 --package=npm@11.21.3 -- npm ci
```

Use the same prefix before other npm commands. On Windows, use canonical drive
casing (`C:/...`, not `c:/...`) if supplying npm's `--prefix`; otherwise Vitest can
load duplicate runner state. Do not treat a bootstrap warning alone as evidence
that the requested command completed.

[.env.example](.env.example) lists all server-only settings. Environment variables
take precedence over an optional, ignored root `.env`, loaded by `start:api`.
Native defaults bind `127.0.0.1:3001`, allow `localhost` and `127.0.0.1` on web
ports 3000 and 5173, and use SMTP `127.0.0.1:1025` without credentials. Do not
send test messages to an external provider.

SMTP sender/recipient default to `catalogue@lindenshelf.test`/`sales@lindenshelf.test`. Credentials
must be supplied as a pair; authenticated SMTP requires TLS. Connection/greeting
deadlines are at most 5 seconds and socket inactivity at most 10 seconds. The
product deadline is at most 5 seconds. Configuration values never reach clients.

## Verify

```sh
npm run test:unit
npm run test:integration
npm run test:coverage
npm run typecheck
npm run lint
npm run test:smoke
npm audit --audit-level=high
```

`npm test` runs the Node and jsdom projects. Units use synthetic data, fake
fetch/SMTP and controlled deadlines. Integration tests use local ephemeral HTTP,
isolated limiter state/time and read-only parsing of container/CI files.
`test:smoke` builds and starts the actual compiled API entry,
checks health and rejected input without upstream/mail IO, then stops it.
API process and browser bootstrap entries are outside unit coverage; compiled
smoke and browser checks verify their wiring. Tests/setup are excluded too.
Per-file coverage thresholds are 80% for statements, branches, functions and lines.

For deterministic browser acceptance, use installed Chromium (`npx playwright
install chromium` if needed), or select an existing Chrome executable:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
npm run test:browser
```

The browser suite owns a temporary Vite server on port 4173. Set
`BROWSER_TEST_PORT=4174` if occupied, or explicitly provide `BROWSER_BASE_URL`
for an already running local app. Tests cover 1440px, 390px and 320px widths,
keyboard/focus, deep links, search, enquiry states, Axe accessibility and overflow.
API and image responses in this suite are test-only fixtures, **not SMTP or live
image evidence**. Screenshots stay in ignored `test-results/`; tracing is disabled.

[CI](.github/workflows/ci.yml) has read-only repository permission and only runs
install, coverage, lint, typecheck, build, compiled smoke and dependency audit.
See [GitHub Actions](https://github.com/roytanmoy1/linden-shelf/actions) for the
status of a particular commit. There is no deployment job.

## API Contract

| Method | Path | Response Shape |
| --- | --- | --- |
| GET | `/api/health` | `{status: "ok", services: {api: "ready"}}` |
| GET | `/api/products/featured` | `{products: Product[5]}` |
| GET | `/api/categories` | `{categories: string[]}` |
| GET | `/api/products?category=...&q=...` | `{products: Product[], featuredIds: number[]}` |
| GET | `/api/products/:id` | `{product: Product}` |
| POST | `/api/enquiries` | `{status: "sent"}` only after SMTP acceptance |

Products use the shared [catalogue schema](packages/contracts/src/catalogue.ts).
Editorial IDs are exactly `[3, 5, 11, 18, 20]`, not a rating leaderboard. Missing
selections fail explicitly. Browse order is ascending ID; a category puts its
selected subset first, followed by remaining IDs once each. Category and query
intersect. Query matching trims input and searches title/description/category,
case-insensitively, up to 200 characters. Empty query browses all; unknown category
is 404. Duplicate, nonscalar or unknown query parameters are rejected.

Enquiry JSON is `{productId, name, email, message?}`. Name is trimmed, required and
limited to 100 characters; email is valid and at most 254; optional trimmed
message is at most 2000. Header control characters and extra fields are rejected.
JSON bodies are uncompressed and at most 16 KiB. Five POST attempts per IP per ten
minutes includes invalid input and blocked origins; excess attempts return 429
with `Retry-After`. Requests without an Origin header may use the API; this is an
origin policy, not authentication. Native/direct mode ignores forwarding headers.

`TRUST_INGRESS_PROXY=true` enables exactly one trusted hop **only behind protected
container ingress**. Compose never publishes the API port; nginx overwrites
`X-Forwarded-For` with `$remote_addr`, clears `Forwarded` and does not append caller
headers. Do not enable this mode for a directly reachable API, attach untrusted
containers to its network, or add a bypass path to the API. A directly exposed API
must keep the default `false`. A regression test proves two forwarded clients do
not share quota in ingress mode while spoofed forwarding remains ignored natively.

All application failures are `{error: {code, message, details}}`, with safe field
keys or `null` details. Statuses distinguish malformed input (400), origin (403),
not found (404), size (413), media type (415), validation (422), limits (429),
source failure/invalid data (502), mail failure (503), source timeout (504) and
unexpected failure (500). No raw provider data, submitted values or stacks are
returned. There is no automatic delivery retry or exactly-once guarantee.
Cancelling a browser request or navigating away does not undo possible SMTP
acceptance; after uncertain delivery, inspect the inbox before retrying.

Retrying a failed page restores its title and keyboard focus when the content
returns. A failed photo falls back independently of its tile; if the supplier
replaces the photo URL, the product renders the new image without a page reload.

## Review Materials

- [Acceptance and submission checklist](docs/acceptance.md): what was actually verified, and what is pending.
- [Decisions](DECISIONS.md): assumptions, deliberate cuts, provider replacement and next-day priorities.
- [AI usage](AI_USAGE.md): original plan, project instructions, five direction changes or checkpoints, and mistakes caught.
- [Time log](docs/time-log.md): actual checkpoints and approximate activity breakdown.
- [Interview walkthrough](docs/interview.md): follow a search, trace an enquiry and rehearse an editorial change.

The solution lives on `feature/catalogue`; the assessment PR is to remain open,
not merged into `main`. No deployment is required to evaluate it.
