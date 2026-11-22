# AI Usage

Assistant: GitHub Copilot. No underlying model identity is asserted. Human code
review is pending; automated checks are not a substitute for that review.

Tools used: GitHub Copilot in VS Code, planning/scaffolding agents, local terminal
and file tools, and browser/Playwright checks. GitHub access during implementation
was read-only; the owner separately authorized the final feature-branch push.
Project-specific direction
is retained in [.github/copilot-instructions.md](.github/copilot-instructions.md).
The selected underlying model
identifier was not recorded; confirm it from the tool UI before submission rather
than inventing one.

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
4. Review security, performance and duplication. A failing two-reader test showed the home page could fetch the same supplier dataset twice. Sharing only an unfinished read fixed it without caching a stale price or a failure.
5. Use neutral branding and make the code explainable. A failing UI test exposed the old loading header; the brand link is now shared. An audit of all four PDF pages and a code-linked [walkthrough](docs/interview.md) distinguish requirements, choices and pending work.

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

See [verification evidence](docs/acceptance.md) and the [time log](docs/time-log.md).
The private assessment, workstation settings and any credentials are excluded.
