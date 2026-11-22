# Linden Shelf

- Use Node 24, npm 11 and the root lockfile. Keep contracts in `packages/contracts`
  and API ownership in `services/catalogue-api`; React/Vite lives in
  `services/catalogue-web` with Fluent UI v9 and locally bundled IBM Plex Sans.
- Keep Express handlers thin. Inject `ProductSource` and `EnquiryMailer`; construct
  their live adapters only at startup. Do not introduce a registry or database.
- Editorial featured IDs are configurable; the defaults are `[3, 5, 11, 18, 20]`, not a rating sort. Never mask a
  source failure with fixture data. Browser product metadata must use our API.
- Share Zod schemas and limits. Email success requires acceptance of the fixed
  configured sales recipient; never log contact values or provider payloads.
- Keep frontend metadata behind the typed same-origin API client. Router loaders
  own cancellation; search is explicit URL-backed submission. No runtime fixtures,
  duplicate server selection logic or contact data in browser storage.
- Keep direct API proxy trust off. One-hop trust is opt-in only behind protected
  ingress with an unpublished API port and overwritten forwarding headers.
- Write failing tests first. Units use fake fetch/SMTP/time; Supertest HTTP tests
  are integration tests. Run a focused check after each substantive change.
- Reuse test fixtures. Browser interception must match root `/api/` paths, not
  source-module paths. Fixture confirmation is never actual SMTP evidence.
- Keep public documentation factual, including failed checks and pending human
  review. Never add the assessment PDF, local secrets or private workflow files.
- Do not publish, push, create a PR or deploy without separate authorization.
