# Reviewer Verification

All four pages of the brief were checked against the feature branch on
22 November 2026. Start with the [quickstart](../README.md) and the
[open PR](https://github.com/roytanmoy1/linden-shelf/pull/1). `main` is the
README-only baseline; the implementation is on `feature/catalogue`.

## Customer Journeys

| Journey | What the checks establish |
| --- | --- |
| Home | Exactly the five operator-selected IDs appear in order. Changing the configuration changes both membership and order without editing the UI. |
| Category | Each department shows its editorial subset first, then other members without duplicates. The reviewer journey checks every category. |
| Search | A submitted mixed-case, padded query returns exactly the matching products. A no-match query is empty. Opening history and typing alone do not fetch results. |
| Product | A tile opens the correct detail URL; refresh and Back work. The live sweep opened all 20 products in four categories and decoded their photos with no external browser requests. A failed photo can be retried independently of a draft enquiry. |
| Enquiry | Invalid input does not submit. SMTP acceptance produces a focused thank-you and one uniquely marked Mailpit message with the correct recipient, Reply-To and server-resolved product/price. SMTP refusal retains the form and does not confirm. |

## Technical and Delivery Rules

| Brief item | Status and evidence |
| --- | --- |
| Interactive PoC that can evolve; use AI, own the result, document assumptions | A real web catalogue and local SMTP inbox run without credentials. Two injected provider interfaces and separate UI styling support change. The [decisions](../DECISIONS.md) record ambiguous requirements, cuts, growth and next-day work. Personal review cannot be automated. |
| Permitted client and backend; explain the choice | React/Vite/TypeScript and Node/Express/TypeScript. The [README](../README.md) explains why. No mobile client is claimed or required. |
| No client calls to the supplier | All categories, search results, details and photo bytes come from Express. Production CSP also restricts image and data requests to the application origin. |
| Infrastructure compatible with AWS | Portable Linux OCI containers, environment configuration and SMTP; no cloud-specific services. AWS deployment is neither required nor claimed. |
| Local in under ten minutes; low setup burden | Docker Compose has a one-command entry point. The native route needs Node/npm and a local Mailpit binary. See the measured results below; Docker itself is unavailable on this host. |
| No secrets; no paid services or reviewer accounts | The root example config contains local defaults. Git and image contexts exclude real env files, keys and private material. Public Fake Store plus local Mailpit require no registration. |
| Repository, source, tests, open feature PR into main | Review the [feature branch](https://github.com/roytanmoy1/linden-shelf/tree/feature/catalogue) against `main`. The review PR must stay open; sending the links is a separate candidate action. |
| Setup, build and test instructions | The root README has prerequisites, commands, URLs, configuration and a map of the workspaces. |
| AI notes, instructions, plan, 3-5 moments and an actual correction | [AI usage](../AI_USAGE.md) records the tool and editor model selections, links the instructions, and describes the plan, five decisions and mistakes caught during verification. |
| Time-box, actual time and interview ownership | [Time log](time-log.md) separates planning, building, testing and review, including follow-up work beyond the target. The [walkthrough](interview.md) prepares the 45-minute discussion and a small live change. Candidate review time is not claimed. |

## Clean Release Evidence

- **Setup:** 198.1 seconds from starting `npm ci` in a source-only export through building the app, displaying the five live picks and decoding a photo. Node 24, npm 11, Chrome, local Mailpit and the npm cache were already present. No prior build, `node_modules`, or real `.env` was copied. This is a native time, not a Docker time.
- **Code:** 340 unit/integration cases; 98.54% statements and 95.63% branches overall, with all four 80% per-file gates met. Lint, strict TypeScript, production build, compiled HTTP smoke and npm audit passed. The staged source tree was scanned for secrets separately.
- **Browser regression gate:** 32 Chromium scenarios at 1440/820/390/320px. These cover keyboard and touch flows, Axe, Back/Forward, filters, history, photo recovery and failure/confirmation states. The photo-outage fixture remains unavailable until an explicit user retry; it does not assume a particular number of browser preload requests.
- **Live acceptance:** the same reviewer-to-inbox journey passed in Chromium at all three reviewer widths, Firefox desktop, and mobile-sized WebKit. Each run verified its own Mailpit receipt. The local alternate-picks run used controlled supplier data and photos but the real API and SMTP transport.
- **Recovery:** one supplier photo needed an explicit retry during the final 20-product sweep; all 20 decoded, with zero external browser requests. A local SMTP service returning 421 produced HTTP 503, zero matching messages and no thank-you. After restoring Mailpit, one explicit retry from the same form produced exactly one matching message. No external email was sent.

## Hosted Verification

The [PR checks](https://github.com/roytanmoy1/linden-shelf/pull/1/checks) build
and start the documented Compose stack on Linux, validate nginx, enforce the
ten-minute budget and check graceful API shutdown. The `reviewer` job records
live supplier availability separately from its controlled supplier run on the
same images. A confirmed supplier refusal is **not** reported as a live pass;
production does not substitute fixture data. The full fixture browser suite
also runs against the built nginx frontend.

These checks are not a cloud deployment, external-mailbox test, physical-device
test, container-image audit or human assistive-technology certification.
