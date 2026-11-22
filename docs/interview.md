# Explain Linden Shelf

Start with the product: a customer can find an item and contact sales. There is no purchase or account. The useful architectural distinction is **who decides**: React decides how to present results, Express and the catalogue service decide which records qualify, and adapters deal with suppliers and SMTP.

## Read the Code in This Order

| Open | Question to answer |
| --- | --- |
| [server.ts](../services/catalogue-api/src/server.ts) | Where are the real supplier and mailer constructed? This is the one place that wires them into the app. |
| [app.ts](../services/catalogue-api/src/app.ts) | What gets accepted over HTTP? Find the routes, allowed origins, request limit and JSON-only enquiry boundary. |
| [catalogue-service.ts](../services/catalogue-api/src/catalogue/catalogue-service.ts) | Where do the chosen IDs, category ordering and search matching live? Notice that this file never calls `fetch`. |
| [fake-store-source.ts](../services/catalogue-api/src/catalogue/fake-store-source.ts) | Where does network data become trusted product data? Follow the deadline, byte limit and [product schema](../packages/contracts/src/catalogue.ts). |
| [routes.tsx](../services/catalogue-web/src/app/routes.tsx) and [client.ts](../services/catalogue-web/src/api/client.ts) | How does a URL turn into a same-origin API call and then typed data for a page? |
| [enquiry.tsx](../services/catalogue-web/src/product/enquiry.tsx) and [smtp-mailer.ts](../services/catalogue-api/src/enquiries/smtp-mailer.ts) | Which component may display success, and what evidence does it wait for? |

## Follow One Search

1. Enter `SSD`. Typing alone makes no request. Submit the [search form](../services/catalogue-web/src/app/shell.tsx): the URL becomes `/search?q=SSD`. Refresh and Back work because the URL, not hidden component state, holds the search.
2. The search loader reads the URL. The API client calls `GET /api/products?q=SSD`. Product JSON never comes straight from the supplier to React.
3. Express passes the query to `CatalogueService.list`. It rejects malformed filters before fetching. The product source gets the catalogue, validates the external records, and returns products in the application's shape. TypeScript alone cannot validate network JSON at runtime.
4. The service compares the trimmed, lowercased term with each title, description and category, then returns only matches. A category filter intersects with the term. Editorial order applies inside categories; ordinary search results use ascending product ID.
5. The [page](../services/catalogue-web/src/catalogue/pages.tsx) renders the returned order using the shared [product grid](../services/catalogue-web/src/catalogue/products.tsx). A tile links to `/products/:id`; the detail loader fetches that ID, so opening the link directly works too. Only static photo bytes load from the supplier's `/img/` area; the API supplies and validates their URLs.

**Explain the trade-off:** for twenty products, a bounded list and substring search are easy to test and reason about. Concurrent reads share an unfinished fetch, but a finished result or error is not cached. A much larger catalogue would call for provider-side search and pagination, not more filtering in React.

## Follow One Enquiry

1. On a detail page, click **Enquire**. The browser collects name, email and an optional message. The [shared schema](../packages/contracts/src/enquiry.ts) gives fast feedback; it is applied again on the server because the browser is not a trust boundary.
2. `POST /api/enquiries` accepts a product ID and contact details, **not** a price, title, sender or sales recipient. The API resolves the product again. A customer cannot change the price in the sales email by changing their form.
3. The SMTP adapter sends plain text to the configured sales mailbox. The customer's address is `Reply-To`. It waits for the transport result and checks the intended recipient was accepted and none rejected.
4. Only a validated HTTP 200 with `{status: "sent"}` changes the form to **Thank you**. If SMTP is unavailable, the API returns 503 and the form retains the fields. The app does not retry automatically: a connection can fail after a server accepted a message, so delivery is not exactly-once.

**Show the evidence:** the [HTTP tests](../services/catalogue-api/src/app.integration.test.ts) prove a rejected or unfinished send cannot produce success. The [browser cases](../tests/browser/catalogue.spec.ts) prove the customer sees the right state. Neither proves a message arrived. Submit a synthetic enquiry and open the separate [local inbox](http://localhost:8025) to demonstrate actual local SMTP receipt.

## Rehearse a Live Change

**Request:** "Show the bracelet first on the home page; keep the same five products."

1. Predict the owner before using search: this is editorial order, not page layout or supplier ranking.
2. In the [catalogue service test](../services/catalogue-api/src/catalogue/catalogue-service.test.ts), change the expected featured order from `3, 5, 11, 18, 20` to `5, 3, 11, 18, 20`. Run `npm test -- services/catalogue-api/src/catalogue/catalogue-service.test.ts` and see it fail on order.
3. Reorder `FEATURED_IDS` in the service. Rerun the focused test, then `npm test`. Update expectations that deliberately pin that editorial choice; keep the independent checks for five items, filtering and no duplicates. The React rendering code should not need an edit.

This is a practice exercise, not a change applied to the submission. Try these questions without notes:

- **How would you replace SMTP with an HTTP email provider?** Implement `EnquiryMailer` and change the adapter constructed at startup. Keep the route and form unchanged if the provider can confirm acceptance.
- **What if an editorial pick disappears upstream?** Featured/list requests report invalid supplier data (502) rather than silently replacing the pick. A direct request for an absent product ID returns 404.
