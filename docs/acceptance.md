# Assessment Checklist

All four pages of the private brief were checked on 22 November 2026. This is
evidence for the local product, not a claim that a submission email was sent.

## Customer Journeys

| Requirement | Observed Evidence | Still Pending |
| --- | --- | --- |
| Five editorial products | API count/order/missing-ID tests; five live linked tiles in `[3,5,11,18,20]` order with decoded photos | Final human review |
| Category ordering | API partition tests; DOM/browser navigation and featured/remainder/no-duplicate/empty states | Final live acceptance by reviewer |
| Explicit search | API matching/intersection/bounds; browser no-typing-request, button/Enter, URL/back/refresh and empty state | Final human review |
| Product detail | Invalid/absent/unknown route tests; deep-link refresh; live title, description, USD price, rating and image | Final human review |
| Enquiry UI and delivery | Validation/focus/error/duplicate tests; real SMTP-stopped 503 with retained fields; unchanged-form retry, thank-you and exactly one verified Mailpit email | External mailbox delivery is outside local acceptance; human review |
| Metadata boundary | Shared validation; no runtime fixtures; live browser requests only local `/api`, with direct allowlisted image requests | Containerized network inspection |
| Proxy limiter | Test-first independent client quotas in explicit one-hop mode; native spoofing still ignored; nginx sanitization statically checked | nginx/Docker runtime forwarding probe |
| Responsive/accessibility | Nine Playwright fixture journeys at 1440/390/320px, Axe scans, keyboard/focus, no overflow; live 390/320px layout and reduced motion checked | Human assistive-technology review |
| Local reproducibility | Node 24.22.3/npm 11.21.3, build and compiled smoke; native web/API/Mailpit verified; eight static container/CI checks; exact image tags exist for Linux amd64 and arm64 | Docker image build/startup, cold timing, Linux signals and image scan |
| Public delivery | README-only `main`; source, tests and project instructions belong on `feature/catalogue`, excluding the private brief and environment files | Candidate review, open unmerged PR and submission email |

## Technical and Delivery Rules

| Brief item | Status and evidence |
| --- | --- |
| Interactive PoC that can evolve; use AI, own the result, document assumptions | A real web catalogue and local SMTP inbox run without credentials. Two injected provider interfaces and separate UI styling support change. The [decisions](../DECISIONS.md) record ambiguous requirements, cuts, growth and next-day work. Personal review cannot be automated. |
| Permitted client and backend; explain the choice | React/Vite/TypeScript and Node/Express/TypeScript. The [README](../README.md) explains why. No mobile client is claimed or required. |
| No client calls to the product API | All categories, queries, details and image URLs come from Express. The only direct supplier requests are static photos under `/img/`. Browser tests distinguish image and metadata requests. |
| Infrastructure compatible with AWS | Portable Linux OCI containers, environment configuration and SMTP; no cloud-specific services. AWS deployment is neither required nor claimed. |
| Local in under ten minutes; low setup burden | Docker Compose has a one-command entry point. The native route needs Node/npm and a local Mailpit binary. See the measured results below; Docker itself is unavailable on this host. |
| No secrets; no paid services or reviewer accounts | The root example config contains local defaults. Git and image contexts exclude real env files, keys and private material. Public Fake Store plus local Mailpit require no registration. |
| Repository, source, tests, open feature PR into main | Review the [feature branch](https://github.com/roytanmoy1/linden-shelf/tree/feature/catalogue) against the public README-only `main`. **Pending:** open the assessment PR, leave it unmerged, and send both links after candidate review. |
| Setup, build and test instructions | The root README has prerequisites, commands, URLs, configuration and a map of the workspaces. |
| AI notes, instructions, plan, 3-5 moments and an actual correction | [AI usage](../AI_USAGE.md) contains the plan and five actual moments, links the project-specific instructions, and explains a browser-test mistake and how it was caught. The assistant tool is recorded; the model selector was not observed. Do not invent a model identifier. |
| Time-box, actual time and interview ownership | [Time log](time-log.md) separates planning, building, testing and review, including follow-up work beyond the target. The [walkthrough](interview.md) prepares the 45-minute discussion and a small live change. Candidate review time is not claimed. |
| Submission deadline | The original email specified Saturday 21 November at noon; the brief requests a reply within three days. An extension to Monday was requested, not confirmed in the available evidence. Confirm the agreed deadline before sending. |

## Final Native Checks

A clean copy of the submission files had no `node_modules`, prior build output
or `.env`. With Node 24, npm 11, Chrome, local Mailpit and an existing npm cache,
`npm ci` finished at 178.7s, the build at 216.9s and the real five-product
browser home at **227.2s (3m47s)**. Isolated loopback ports used the same web/API
code and a matching proxy target. This measures the native path, not a cold npm
cache, installation of prerequisites or a Docker image build. An earlier timing
attempt recorded only installation and was not counted as a successful start.

The release checkout passed 289 unit/integration cases and all nine desktop/mobile
Playwright cases. Per-file coverage gates passed: 99.25% statements, 96.19%
branches, 100% lines/functions overall. Lint, strict TypeScript, production build,
compiled startup smoke and npm audit passed; the audit reported zero known
dependency vulnerabilities. These are not an image scan or a remote CI result.

Focused regressions cover title/focus after an in-place retry, a new photo URL
for a product whose original photo failed, and releasing an unread supplier
response without masking its error. Status and content-type failures both cancel
the response stream; valid responses retain the existing byte and time bounds.

The live browser showed `Top rated | Linden Shelf` with all five product links.
Submitting a synthetic enquiry for #3 returned 200 and displayed thank-you.
Mailpit independently contained exactly one matching message from
`catalogue@lindenshelf.test` to `sales@lindenshelf.test`, with the correct
Reply-To, marked message and USD 55.99 price. No external mail was sent.

The workspace rename preserved the original feature branch and commit. A scan
of the authored submission files found no legacy brand identifiers. Regenerating
the workspace links changed no third-party version, tarball URL or integrity
digest in the 481 locked external entries.

An offline `detect-secrets` scan of the 68 submission candidates reported three
findings. All three were inspected: two dummy URL credentials in rejection tests
and one synthetic SMTP setting in a configuration test. No real credential was
identified. No suppression rule was added; this check is not a security guarantee.

## Earlier 22 November Review

- On the native app, home showed IDs 3, 5, 11, 18 and 20. Electronics showed #11 first, then five different products. Explicit search for `SSD` with surrounding spaces returned #10 and #11.
- Clicking the #10 tile opened its actual details. A browser enquiry returned HTTP 200 and displayed thank-you. Exactly one matching local Mailpit email had the fixed sales recipient, synthetic Reply-To, correct title and USD 109.00 price. No external email was sent.
- 285 Vitest cases passed with no skips. Coverage: 99.25% statements, 96.16% branches, 100% lines/functions. The two interface-only modules have no executable counters. All nine desktop/mobile Playwright cases passed (no skips or retries).
- Lint, typecheck, production build and compiled health/validation smoke passed; npm audit reported zero known dependency advisories. The smoke timestamp was `2026-11-22T04:53:14.711Z`.
- Focused tests confirmed two simultaneous catalogue reads make one upstream call; subsequent reads fetch fresh data after success or failure. The adapter rejects decoded JSON above 1 MiB before parsing. The browser, HTTP endpoint and provider share the same JSON media-type check.
- A one-off TypeScript token scan of 22 production source files found no exact repeated 50-token windows spanning at least five lines within implementation statements. Imports, type-only declarations, generated output and tests were excluded. This does not detect shorter or semantically equivalent code and is not a CI gate.
- The nginx framing policy and static-only gzip configuration have static tests. Neither Windows nor the registered Ubuntu distribution provided an nginx or container runtime. This is not a Docker, image scan or timed cold-start pass.

## Earlier Live Evidence

- **Supplier and browser (20 November):** all 20 records validated; the five picks spanned all four categories. All five real photos decoded. Desktop, 390px and 320px checks showed no overflow; reduced motion disabled transitions. The proxied health endpoint returned 200 and an unknown API route returned JSON 404, not the SPA.
- **Failure first (20 November, 10:35:39 UTC):** with SMTP stopped, a real enquiry returned 503, preserved the form fields and did not show thank-you. At 10:36:07 UTC an unchanged-form retry succeeded after local Mailpit started. At 10:36:55 UTC its inbox contained one matching email with the configured addresses, synthetic Reply-To, server-resolved product #3 and USD 55.99 price. The Mailpit binary had been checked against its official SHA-256; no relay was configured.
- **Evidence limits:** mocked browser responses are not SMTP receipts. The Node, nginx and Mailpit image tags existed for Linux amd64/arm64; registry metadata and static configuration tests are not image builds or runtime checks. No hosted CI run or cloud deployment is claimed.

## Remaining Acceptance

1. Run Docker Compose, measure a cold start including downloads, verify nginx API/SPA isolation and sanitized client-IP forwarding, and test graceful Linux shutdown.
2. Repeat the now-passing native SMTP journey through the Compose web proxy when Docker is available.
3. Perform human code, accessibility and security review, including container image scanning and the remaining bundle warning.
4. After candidate review, open the feature PR, leave it unmerged and send the repository and PR links. The Monday extension request is not confirmed.

Docker is unavailable here. No external mailbox delivery, cloud deployment,
remote CI run or scheduled publication is claimed.

## When Opening the PR

Use a title such as **Add Linden Shelf catalogue and sales enquiries**. In the
description, explain why five editorial picks are not a ratings leaderboard;
give the run command and inbox URL; distinguish automated coverage from an
actual received message; and link the decisions, AI notes and time log. State
any checks still unverified at publication. The reviewer needs the feature diff
against `main`, so leave the PR open and send both public links only after review.
