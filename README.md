# Linden Shelf

Browse editorial picks and compare prices and ratings. Remove individual filters
above the results, or clear them from an empty result without losing the search
term or sort. Open a product to inspect its original photo or enquire; going
Back restores keyboard focus to that product when it is still listed. No account,
payment or email-provider credentials are needed. See the [interview guide and data-flow diagram](docs/interview.md).

The light storefront uses a white masthead, green actions, uncropped product
photos and full product titles. Native browse controls and the deferred contact
form share color tokens, focus treatment and touch-friendly dimensions.

Click the search field to see up to five recent searches. An empty magnifier
click also opens history without leaving the current results; a nonempty query
submits with the magnifier or Enter. Arrow keys move through recent terms,
Escape or an outside click closes the panel, and Clear history updates other tabs.
Drafts are not saved and focusing or typing does not request product data.

Category, rating and sort use customizable native pickers where the browser
supports `appearance: base-select`, with a standard native picker fallback.
The four-viewport regression suite uses Chromium. The real reviewer journey
can also run with Playwright's Firefox and WebKit engines.

| Directory | Responsibility |
| --- | --- |
| [services/catalogue-web](services/catalogue-web) | React routes, pages, forms and same-origin API client |
| [services/catalogue-api](services/catalogue-api) | HTTP endpoints, catalogue rules, supplier and SMTP adapters |
| [packages/contracts](packages/contracts) | Shared TypeScript types, runtime validation and limits |
| [tests](tests) | Shared fixtures, browser journeys, compiled-server smoke and configuration checks |
| [docs](docs) | Verification evidence, time log and a guided code walkthrough |

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

Prerequisites: Git, a running Docker engine with Compose v2, and internet access
for product data. The implementation is on the [open feature PR](https://github.com/roytanmoy1/linden-shelf/pull/1);
`main` is the review baseline. From a new checkout:

```sh
git clone --branch feature/catalogue --single-branch https://github.com/roytanmoy1/linden-shelf.git
cd linden-shelf
docker compose up --build
```

- Catalogue: `http://localhost:3000`
- Local sales inbox: `http://localhost:8025`
- API health through the web proxy: `http://localhost:3000/api/health`

Only web and the ephemeral inbox are published on loopback. API and SMTP remain
internal. Override `WEB_PORT` or `MAILPIT_HTTP_PORT` if occupied. Stop with
`docker compose down`. Hosted supplier restrictions and measured timings are in
the [acceptance record](docs/acceptance.md), not a guarantee for every machine.

### Choose the five products

By default the home page shows IDs `3,5,11,18,20` in that order. To change them,
set `FEATURED_PRODUCT_IDS` in the shell or in a root `.env` (see [.env.example](.env.example)),
then run `docker compose up -d` again to recreate the API with the new setting.
For native development, restart the API instead. No image rebuild or frontend
change is needed. Example: `FEATURED_PRODUCT_IDS=2,11,1,5,18`.

Use exactly five **distinct positive product IDs** from `GET /api/products`.
Category pages use the same editorial order for their matching subset. Invalid
configuration stops startup; a valid ID missing from the supplier returns an
explicit catalogue error rather than silently substituting another product.

## Native Development

Prerequisites: Node 24, npm 11 and an installed Mailpit binary for genuine local
SMTP. Validated application toolchain: Node 24.22.3/npm 11.21.3. With these
prerequisites, Chrome and a populated npm cache, the release source tree went
from `npm ci` through a production build to five real browser tiles and a
decoded photo in **3 minutes 18 seconds**. No dependencies, build output or
real `.env` were copied into the checkout. This was a native measurement,
not a cold Docker timing. From the root:

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

Default web: `http://127.0.0.1:5173`; API: `http://127.0.0.1:3001/api/health`.
For alternate ports, set API `PORT` and `ALLOWED_ORIGINS`, then set the same
`CATALOGUE_API_PORT` in the **web process** and run
`npm --prefix services/catalogue-web run dev -- --port 5189`. The proxy host is
fixed to loopback. Stop processes with Ctrl+C. The API loads optional server
settings from the ignored root `.env`; see [.env.example](.env.example).
Health does not contact the supplier. Product reads need internet. Keep local
SMTP pointed at Mailpit on port 1025; do not use an external mailbox for tests.

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

`npm test` runs the isolated Node/jsdom suites. The four per-file coverage
thresholds are 80%. `test:smoke` builds the app and exercises the compiled API.

For deterministic browser acceptance, use installed Chromium (`npx playwright
install chromium` if needed), or select an existing Chrome executable:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
npm run test:browser
```

The browser suite uses port 4173 or `BROWSER_BASE_URL`. It exercises desktop,
tablet and phone layouts at 1440/820/390/320px, keyboard and Axe checks, price
correction, full sort-label visibility with active filters, consistent contact-form
styling, empty-result recovery, paging, Back/Forward focus, two-tab search history,
zoom and enquiry failures. Its fixtures do
not prove SMTP delivery. Screenshots stay in ignored `test-results/`.

For the **unmocked** run, start the local Compose stack above, install the locked
Node dependencies with `npm ci` and use Chromium as for `test:browser`. Then run:

```sh
npm run test:acceptance
```

Use **only local Mailpit**. Each invocation sends one synthetic enquiry and
checks its unique receipt without clearing the inbox. Set `WEB_PORT` to the
running frontend port (default 3000), `MAILPIT_HTTP_PORT` if different from 8025,
and `REVIEWER_WIDTH` to `1440`, `390` or `320`. To repeat the same journey in
another engine, run `npx playwright install firefox webkit` and set
`REVIEWER_BROWSER=firefox` (desktop width) or `REVIEWER_BROWSER=webkit`.
Chromium is the default; no extra engines are needed for the quickstart. Use the stack's editorial picks
and `SALES_EMAIL` if overridden. No credentials are needed.

[CI](.github/workflows/ci.yml) has read-only repository permission. Pushes run
coverage, lint, typecheck, build, smoke and dependency audit. Pull requests also
run the desktop, tablet and phone browser suite against the built nginx frontend,
the Docker browser-to-inbox journey and a graceful API shutdown check. The default stack always
tries the real supplier. A live browser pass is recorded only if it succeeds;
if the supplier independently returns 403 and the API returns `502/UPSTREAM_ERROR`,
CI reports that limitation explicitly. Other unexpected failures fail the job.

A separate CI step always runs the same browser journey using the same images
with the [test-only override](tests/compose.reviewer.yaml). It supplies synthetic
catalogue data and a matching raster photo at the API's outbound fetch boundary.
It does **not** mock the app's HTTP routes, catalogue
logic, nginx, email transport or Mailpit. This isolates our behavior from public
supplier availability. It is never loaded by the normal quickstart. There is no deployment job.

## API Contract

| Method | Path | Response Shape |
| --- | --- | --- |
| GET | `/api/health` | `{status: "ok", services: {api: "ready"}}` |
| GET | `/api/products/featured` | `{products: Product[5]}` |
| GET | `/api/categories` | `{categories: string[]}` |
| GET | `/api/products` | `{products, featuredIds}`; with `page`, also `{pagination: {page, pageCount, pageSize, total}}` |
| GET | `/api/products/:id` | `{product: Product}` |
| GET | `/api/products/:id/photo` | Photo bytes (PNG, JPEG or WebP) for a known product; 404 for an unknown ID |
| POST | `/api/enquiries` | `{status: "sent"}` only after SMTP acceptance |

List selectors: `q` (trimmed, case-insensitive title/description/category),
`category`, inclusive `minPrice`/`maxPrice` (USD), `minRating` (1-5), `featured=1`,
`sort` (`price-asc`, `price-desc`, `rating-desc`, `title-asc`) and `page` (1-999).
The server filters, orders with an ID tie-breaker, then slices eight per page.
Absent `page` preserves legacy API behavior. Unknown categories are 404;
invalid ranges, duplicates, arrays and unknown fields are rejected. Example:
`GET /api/products?q=SSD&maxPrice=150&minRating=4&sort=price-asc&page=1`.

Enquiry JSON is `{productId, name, email, message?}`. Name is trimmed, required and
limited to 100 characters; email is valid and at most 254; optional trimmed
message is at most 2000. Header control characters and extra fields are rejected.
JSON bodies are uncompressed and at most 16 KiB. Five POST attempts per IP per ten
minutes includes invalid input and blocked origins; excess attempts return 429
with `Retry-After`. Requests without an Origin header may use the API; this is an
origin policy, not authentication. Native/direct mode ignores forwarding headers.

Use one-hop proxy trust **only** behind the unpublished Compose API with nginx
overwriting the forwarding headers. Errors are `{error: {code, message, details}}`
without submitted values or provider payloads. A 503 does not confirm an email;
there is no automatic retry or exactly-once delivery guarantee.

The browser fetches **all** product data, including image bytes, from this API.
The photo route accepts a product ID, not an upstream URL. The backend resolves
the catalogue image, forbids redirects, checks its media type and signature,
and limits the decoded body to 4 MiB. A successful photo may be cached privately
for 15 seconds. A failed photo does not prevent opening a product or enquiring;
**Retry photo** in detail or zoom retries just the image without losing a draft.

Only validated public products enter the 30-second server snapshot. Canonical
detail/featured/category GET successes allow 15s private browser caching;
lists, searches, errors, health and all enquiries are `no-store`. Sending an
enquiry bypasses the completed snapshot to resolve its product and price.
Only the five most recent submitted search terms persist on the device. They
can be cleared and are never populated from contact fields.

## Review Materials

- [Acceptance and submission checklist](docs/acceptance.md): what was actually verified, and what is pending.
- [Decisions](DECISIONS.md): assumptions, deliberate cuts, provider replacement and next-day priorities.
- [AI usage](AI_USAGE.md): original plan, project instructions, five direction changes or checkpoints, and mistakes caught.
- [Time log](docs/time-log.md): actual checkpoints and approximate activity breakdown.
- [Interview walkthrough](docs/interview.md): follow a search, trace an enquiry and rehearse an editorial change.

The solution lives on `feature/catalogue`; the assessment PR is to remain open,
not merged into `main`. No deployment is required to evaluate it.
