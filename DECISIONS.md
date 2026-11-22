# Decisions

## Gaps in the Acceptance Criteria

| What the brief leaves open | Decision and reason |
| --- | --- |
| Who chooses the five, and in what order? | The operator sets `FEATURED_PRODUCT_IDS`: exactly five distinct product IDs, in display order. Defaults `3,5,11,18,20` cover all four current categories. An environment setting avoids an admin UI or code edit. Invalid lists fail startup; a selected product absent from the supplier fails explicitly. |
| What counts as top rated within a category? | With Recommended sorting, show that category's editorial picks first and each remaining item once. Explicit price, rating or alphabetical sorting ranks the entire filtered set. An unknown category is 404. |
| Which text matches? What about whitespace or no term? | Submit by button or Enter, not on every keystroke. Trim the term and match case-insensitive substrings in title, description or category. Empty means browse all; no match is a successful empty list. No fuzzy ranking or ID/price matching. |
| What is a detail page? | A shareable `/products/:id` with photo, title, description, category, USD price and rating. Refresh works. A malformed ID is 400; a valid but absent ID is 404. USD is an assumption because the supplier has no currency field. |
| What contact details and what kind of delivery? | Require name and email; message is optional. No phone, account or stored contact history. Use the customer's email only as Reply-To and a fixed sales inbox as recipient. Confirm only after SMTP accepts that recipient. Local Mailpit is a genuine SMTP inbox for an account-free review, not evidence of external delivery. |
| Which external requests can the browser make? | None are needed. Product data and photo bytes come from our backend; a product ID identifies its photo. Only the server contacts the supplier. This satisfies the constraint even when photos count as product data. |

No required customer journey was cut. The omitted cart, checkout, authentication,
admin editor and database are not needed to browse or enquire. A feature branch
and public review are delivery requirements, not application features.

## Implementation Trade-offs

- **Source and currency:** Fake Store supplies every product/category field;
  assume USD. Validate source data and HTTPS images on `fakestoreapi.com`.
  Concurrent reads share one in-flight request. One validated dataset can be
  reused for 30 seconds; no stale fallback on expiry/failure. A sales enquiry
  bypasses the completed snapshot. Canonical public metadata GETs allow a
  private 15-second browser cache. Searches, errors and POSTs are never cached.
- **Source bounds:** nonempty datasets have at most 1000 unique positive safe
  integer IDs. Title/description/category bounds are 300/10000/100 characters;
  image URLs are at most 2048. Malformed or duplicate records reject the entire
  response. Decoded bodies are limited to 1 MiB while streaming, before JSON
  parsing, regardless of length headers. Metadata uses a fixed HTTPS origin and refuses redirects;
  image URLs are validated against an explicit host allowlist. Photos have a
  separate 4 MiB limit and must match an allowed raster file signature. No
  caller-supplied URL is fetched. This trades some API bandwidth for a single
  browser origin; a first-party image cache is a later scaling option.
- **Delivery failure:** a network failure can occur after SMTP acceptance. Keep
  the form values, do not show success and do not retry automatically. There is
  no durable outbox or exactly-once guarantee.
- **Abuse boundary:** JSON-only enquiries, 16 KiB bodies, explicit allowed origins
  and five attempts per IP per ten minutes. The limiter is single-instance memory;
  multi-instance operation would need shared state. Native forwarding is ignored.
  Explicit `TRUST_INGRESS_PROXY=true` trusts one hop only for protected ingress:
  no published API port, nginx replaces `X-Forwarded-For` with `$remote_addr`, and
  strips `Forwarded`. This is a topology boundary, not trust in arbitrary headers.
  Direct exposure, untrusted peer containers or a shorter ingress path invalidate
  the boundary. No static Docker IP/subnet or DNS-trust machinery is needed.
- **Toolchain:** isolated Node 24/npm 11 avoids changing the incompatible host
  runtime. Native checks run locally; the PR runs the Docker check on Linux.
- **Startup and coverage:** compiled shared-package exports are used at runtime,
  with source aliases only in tests. Process/browser bootstrap entries are outside
  unit coverage; compiled smoke and browser checks cover their wiring. Tests/setup
  are also excluded. Windows process cleanup is not proof of Linux signal handling.
- **Frontend ownership:** React Router loaders own cancellable reads; one typed
  same-origin API client validates all response bodies with shared Zod schemas.
  Page modules do not repeat server selection/search rules. Search is explicit
  form submission with URL/back/refresh support. Filters, sort and pagination
  belong in the URL. Only the five submitted recent searches persist locally;
  clearing also updates other tabs. The app does not store enquiry contact details.
- **Transient enquiries:** uncontrolled form fields keep failed values in the
  current page, not browser storage. A synchronous request guard prevents double
  submits; navigation aborts client observation and resets the form. It cannot
  undo server acceptance. Thank-you requires the validated API confirmation.
- **Design:** a white masthead, restrained green actions and compact sans-serif
  headings keep the product photos prominent. Product text is unboxed and full
  titles remain visible; price and rating share an aligned row, stacked on
  narrow tiles. Detail and zoom photos retain their original color on white.
  Size the grid from its available width, not the viewport alone. Native
  controls and the deferred Fluent form share CSS tokens and 44px touch
  targets. Recent searches open directly from search and use the same popup
  treatment as category, rating and sort. Select styling progressively enhances
  native `base-select` pickers; unsupported browsers keep native behavior.
  Browse pages do not load the enquiry component library.
- **Testing:** shared synthetic fixtures stay under tests. DOM tests fake HTTP
  and browser layout APIs; Playwright intercepts only root `/api/` paths, never
  Vite source modules. Fixture image/sent responses are not live-delivery evidence.
  The JSX accessibility ESLint plugin does not support ESLint 10; compatible
  hooks linting and actual Axe/browser checks are used without forcing peers.
- **Containers:** three services only, loopback web/inbox publication, private
  API/SMTP ports, explicit maintained image versions, non-root and read-only
  runtimes. Mailpit writes only temporary local data. Compose derives allowed
  origins from its web port. Native SMTP uses loopback 1025 instead of the
  container DNS name. A separate PR check runs the production containers and
  verifies an SMTP receipt. It does not deploy the app or send external email.
- **Security headers:** nginx API responses never enter the SPA fallback.
  `expires -1` on HTML preserves inherited security headers; location-level
  `add_header` would otherwise replace them. Fluent runtime styling needs inline
  CSS, so the CSP permits inline styles but not inline scripts. Framing the
  catalogue is unnecessary, so the CSP explicitly disallows all frame ancestors.
- **Performance:** lazy browse/detail modules, on-demand form/theme and paged
  product reads keep work off the initial screen. Photo dimensions are reserved;
  below-the-fold images use native lazy loading. The initial JS decreased from
  about 552 kB to about 428 kB minified in the local build, without increasing
  the warning threshold. That is bundle size, not a measured LCP guarantee.
- **Scope:** no datastore, auth, cart, queue, provider registry or cloud SDK.
  No customer journey was intentionally dropped. Native SMTP acceptance passes;
  Native acceptance used the real supplier. The PR first probes the unmodified
  Compose stack: a confirmed supplier 403 is reported alongside the API's 502,
  not presented as a successful live journey. A separately named, test-only
  Compose run controls the supplier response and photo, not the app or SMTP.
  The same images are used for both. The application has no fixture fallback.
- **Publication:** the owner authorized renaming the original empty repository to
  `linden-shelf` and publishing the solution on `feature/catalogue`. The public
  `main` is a README-only review baseline. An open, unmerged PR is authorized
  for review; sending the email, merging and deploying are separate actions.

## Growth Beyond the Proof of Concept

Replace `ProductSource` to introduce a database or another supplier without
changing catalogue selection/search or React pages. Validate the new source into
the existing contract, or deliberately version that contract when needs change.
The fixed source allowlist is specific to the current adapter, not a generic
user-supplied URL proxy. If a new supplier serves photos on a different host,
update the supplier validation and its photo adapter. Browser `img-src` stays
`'self'`; React tiles and the zoom dialog still use the same product-ID route.

SMTP credentials, sender and sales recipient are backend configuration. Another
SMTP provider can reuse the adapter; an HTTP-based provider can implement
`EnquiryMailer`. The catalogue and UI still depend only on confirmed delivery
semantics. A future durable outbox and shared rate limiter would be explicit
infrastructure additions, not hidden requirements for this small local product.

Creative changes belong in CSS tokens, the Fluent theme and feature views, not
in provider adapters or catalogue rules. Editorial IDs are server-owned
configuration; an administration screen can later manage those selections
without changing their meaning or the customer-facing routes.

## With Another Day

- Review the latest Docker timing and local email evidence; exercise independent client quotas through nginx and scan the built container images before a production release.
- Review the code and accessibility with the candidate, run CI after authorized publication, and confirm the recorded model/time information before submission.
- Measure real-user mobile LCP and INP on representative devices; move catalogue search/paging into the provider if its dataset outgrows the bounded snapshot.
- Exercise an alternate product-source and email adapter with contract tests. Agree delivery guarantees and scaling needs before adding a database, outbox, shared limiter or administration UI.
