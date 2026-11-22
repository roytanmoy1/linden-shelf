# AI Usage

Tool: GitHub Copilot in VS Code, including planning/scaffolding agents, terminal
and file tools, and Playwright browser checks. The saved editor session records
two model selections: `copilot/gpt-6-astra` and `copilot/gpt-6.2-astra`.
These are the editor's recorded identifiers; individual subagent calls are not
attributed to a particular model. Project-specific directions are in
[.github/copilot-instructions.md](.github/copilot-instructions.md).

## Plan Used

1. Create a minimal `main` baseline; do the implementation on `feature/catalogue`.
2. Test the shared contracts, five editorial IDs, category/search rules, detail lookup and SMTP acceptance before implementing the backend.
3. Connect React routes to the real API. Use fixtures in tests only and keep visual design separate from catalogue rules.
4. Provide portable web, API and Mailpit containers, then verify the native browser journeys and inspect an actual local email. Do not equate static container checks with a Docker run.
5. Review source, tests, assumptions and time. Public submission and an open PR are a separate, authorized step. No database, account, cart or cloud deployment is needed.

## Actual Interactions

These are paraphrases of real directions and checkpoints, not invented quotations.

1. Read the brief and plan before building. The wording about five *chosen* products led to an explicit ordered list rather than an algorithm that silently changes the owner's picks.
2. Work through each journey locally; do not publish yet. The implementation uses portable containers and an account-free inbox. No hosting deployment was substituted for the requested open PR.
3. Prove email, not just a success screen. We stopped SMTP, observed a 503 with the form intact, restored Mailpit, retried and inspected the received message. The mocked UI tests alone could not establish this.
4. Review security, performance and duplication. A failing two-reader test exposed duplicate supplier reads. The later local browse redesign adds one short-lived validated snapshot; sending an enquiry bypasses it. A production-browser test traced a blocked code-generation probe to Zod; browser-only jitless validation fixed it without weakening CSP.
5. Audit all four pages against a fresh reviewer's journey. This caught a hardcoded pick list and a later assumption that supplier-hosted photo bytes were exempt from the backend constraint. Picks now come from configuration, and the real browser check requires same-origin photos and an actual Mailpit receipt. The [walkthrough](docs/interview.md) traces both paths.

## A Mistake We Caught

An early browser-test URL pattern matched both the API and the frontend's own
API-client **source module**. The page failed to load even though the backend
was healthy. Inspecting the intercepted URLs exposed the mistake. The test now
checks that the pathname starts with `/api/`; production code did not need a
mocking workaround. The [browser suite](tests/browser/catalogue.spec.ts) also
records unexpected supplier metadata requests.

Another review caught that proxying all enquiries through nginx would combine
client rate limits. An HTTP test demonstrated the effect; forwarding is now
trusted only in the protected one-hop configuration. This was tested at the API
boundary, not claimed as a Docker runtime result.

The first hosted browser check assumed that successful native supplier access
meant the runner could also fetch products. It saw zero tiles. A status-only
probe inside the unmodified API container showed the real cause: supplier 403,
API 502. The test now separates that observation from deterministic browser,
nginx and SMTP acceptance; it neither bypasses the refusal nor changes production data.

See [verification evidence](docs/acceptance.md) and the [time log](docs/time-log.md).
Project-specific instructions live in one file; no additional custom skill or
agent was needed. The private assessment, workstation settings and credentials
are excluded. Automated checks verify behavior; they do not substitute for the
candidate's own review and interview preparation.
