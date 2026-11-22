# Linden Shelf

- Use Node 24, npm 11 and the root lockfile. Keep runtime contracts in `packages/contracts`.
- React owns presentation and URL-backed navigation. Express owns matching, sorting and paging. Keep the five editorial IDs distinct from numeric ratings.
- Inject `ProductSource` and `EnquiryMailer` at startup. No production fixtures, arbitrary upstream URLs or browser-to-supplier metadata requests.
- Cache validated public browse data only. Enquiries resolve fresh products and require acceptance of the configured sales recipient. Never persist or log contact fields.
- Trust forwarding headers only behind the protected single-hop ingress. Keep SMTP, credentials and real env files off the client and out of Git.
- Test behavior first, reuse fixtures, run the focused check, then the release gates in [the README](../README.md). Distinguish real SMTP receipts from UI fixtures and automated accessibility from human review.
- Do not publish, push, create a PR or deploy without separate authorization.
