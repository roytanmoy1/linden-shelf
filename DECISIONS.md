# Decisions

## Gaps in the Acceptance Criteria

| What the brief leaves open | Decision and reason |
| --- | --- |
| Who chooses the five, and in what order? | "I have chosen" means editorial selection, not a numeric leaderboard. Server-owned IDs `[3, 5, 11, 18, 20]` define both membership and order. They cover all four current categories. A missing pick fails explicitly rather than silently changing the owner's choice. |
| What counts as top rated within a category? | Use the same editorial picks filtered to that category; show remaining products once each in ascending ID order. The two sections have explicit empty states. An unknown category is a 404. |
| Which text matches? What about whitespace or no term? | Submit by button or Enter, not on every keystroke. Trim the term and match case-insensitive substrings in title, description or category. Empty means browse all; no match is a successful empty list. No fuzzy ranking or ID/price matching. |
| What is a detail page? | A shareable `/products/:id` with photo, title, description, category, USD price and rating. Refresh works. A malformed ID is 400; a valid but absent ID is 404. USD is an assumption because the supplier has no currency field. |
| What contact details and what kind of delivery? | Require name and email; message is optional. No phone, account or stored contact history. Use the customer's email only as Reply-To and a fixed sales inbox as recipient. Confirm only after SMTP accepts that recipient. Local Mailpit is a genuine SMTP inbox for an account-free review, not evidence of external delivery. |
| Which external requests can the browser make? | All product fields, categories and photo URLs come from our backend. Only static photo bytes load from the supplier's HTTPS `/img/` directory. React never queries its product API. |

No required customer journey was cut. The omitted cart, checkout, authentication,
admin editor and database are not needed to browse or enquire. A feature branch
and public review are delivery requirements, not application features.

## Implementation Trade-offs

- **Source and currency:** Fake Store supplies every product/category field;
  assume USD. Validate source data and HTTPS images on `fakestoreapi.com`.
  Concurrent reads share one in-flight request for the same public dataset.
  Success or failure releases it; the next read fetches fresh prices. No stored
  cache, shared customer data or fixture fallback is needed.
- **Source bounds:** nonempty datasets have at most 1000 unique positive safe
  integer IDs. Title/description/category bounds are 300/10000/100 characters;
  image URLs are at most 2048. Malformed or duplicate records reject the entire
  response. Decoded bodies are limited to 1 MiB while streaming, before JSON
  parsing, regardless of length headers. Metadata uses a fixed HTTPS origin and refuses redirects;
  image URLs are validated against an explicit host allowlist.
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
  runtime. Native API work is possible; Docker and Compose verification are not.
- **Startup and coverage:** compiled shared-package exports are used at runtime,
  with source aliases only in tests. Process/browser bootstrap entries are outside
  unit coverage; compiled smoke and browser checks cover their wiring. Tests/setup
  are also excluded. Windows process cleanup is not proof of Linux signal handling.
- **Frontend ownership:** React Router loaders own cancellable reads; one typed
  same-origin API client validates all response bodies with shared Zod schemas.
  Page modules do not repeat server selection/search rules. Search is explicit
  form submission with URL/back/refresh support. No runtime fixtures or fallbacks.
- **Transient enquiries:** uncontrolled form fields keep failed values in the
  current page, not browser storage. A synchronous request guard prevents double
  submits; navigation aborts client observation and resets the form. It cannot
  undo server acceptance. Thank-you requires the validated API confirmation.
- **Design:** Fluent UI v9 primitives with native links/forms/grid, local Plex
  Sans 400/500/600 and Lucide icons. Photography remains white and contained;
  sections are unframed. React refs are anchored to native form/action elements
  because current Fluent ref inference conflicted with strict optional typing.
- **Testing:** shared synthetic fixtures stay under tests. DOM tests fake HTTP
  and browser layout APIs; Playwright intercepts only root `/api/` paths, never
  Vite source modules. Fixture image/sent responses are not live-delivery evidence.
  The JSX accessibility ESLint plugin does not support ESLint 10; compatible
  hooks linting and actual Axe/browser checks are used without forcing peers.
- **Containers:** three services only, loopback web/inbox publication, private
  API/SMTP ports, explicit maintained image versions, non-root and read-only
  runtimes. Mailpit writes only temporary local data. Compose derives allowed
  origins from its web port. Native SMTP uses loopback 1025 instead of the
  container DNS name. Runtime verification is pending because Docker is absent.
- **Security headers:** nginx API responses never enter the SPA fallback.
  `expires -1` on HTML preserves inherited security headers; location-level
  `add_header` would otherwise replace them. Fluent runtime styling needs inline
  CSS, so the CSP permits inline styles but not inline scripts. Framing the
  catalogue is unnecessary, so the CSP explicitly disallows all frame ancestors.
- **Performance ceiling:** the detail/enquiry route is split, but the initial
  production bundle still triggers Vite's 500 kB warning (552.33 kB, 162.85 kB
  estimated gzip on 22 November). React DOM, routing and validation are its
  largest contributors. Keep the validations and leave the warning visible.
  nginx negotiates gzip only for public static assets, not enquiry responses;
  actual transfer sizes through the container remain unmeasured.
- **Scope:** no datastore, auth, cart, queue, provider registry or cloud SDK.
  No customer journey was intentionally dropped. Native SMTP acceptance passes;
  Docker acceptance and human review are still required. CI runs checks only.
- **Publication:** the owner authorized renaming the original empty repository to
  `linden-shelf` and publishing the solution on `feature/catalogue`. The public
  `main` is a README-only review baseline. The feature push is separate from
  opening or merging the assessment PR, deploying, or emailing the reviewers.

## Growth Beyond the Proof of Concept

Replace `ProductSource` to introduce a database or another supplier without
changing catalogue selection/search or React pages. Validate the new source into
the existing contract, or deliberately version that contract when needs change.
The fixed source allowlist is specific to the current adapter, not a generic
user-supplied URL proxy. If a new supplier serves photos on a different host,
change the shared photo URL policy and nginx `img-src` together, or normalize its
photos onto an already approved asset host. The React tile still consumes `image`.

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

- First close the verification gaps: clean Docker startup timing, nginx forwarding/API isolation, Linux shutdown, container-image scanning and the same real SMTP journey through Compose.
- Review the code and accessibility with the candidate, run CI after authorized publication, and confirm the recorded model/time information before submission.
- Measure mobile loading and bundle composition, then reduce the initial Fluent/application payload based on those measurements rather than suppressing the bundle warning.
- Exercise an alternate product-source and email adapter with contract tests. Agree delivery guarantees and scaling needs before adding a database, outbox, shared limiter or administration UI.
