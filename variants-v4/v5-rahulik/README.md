# Tegevusteraapia Keskus · Põhjala

Run `npm ci`, `npx tsc --noEmit` and `npm run build`. Open `dist/index.html` directly. The file includes the county shapes and sample data. Lora and Public Sans load from Google Fonts, with local fallback fonts for offline use. `npm run dev` starts the Vite development environment.

The default build opens in Estonian with sample providers, times, training records and products flagged in the footer. Booking, checkout, identity checks and publishing work inside the open page with sample data. Use `TTK-1001` to try guest order withdrawal without placing a sample order.

## Live deployment

Build with `VITE_TTK_MODE=live`, `VITE_TTK_PHONE` (the staffed +372 number), `VITE_TTK_CHECKOUT_HOSTS` and `VITE_TTK_AUTH_HOSTS` (comma-separated HTTPS hostnames). Host `dist/index.html` on the same HTTPS origin as the API. The live build starts with an empty catalogue and directory and loads the national public snapshot. Ship the document with `Referrer-Policy: no-referrer` and an HTTP `Content-Security-Policy: frame-ancestors 'none'` header. The artifact already contains a hash-based inline script and style policy.

The Shopify Storefront adapter in `server/shopify.ts` reads products and prices and creates hosted checkout carts. Instantiate it on the server with the `*.myshopify.com` shop, private Storefront token, curated collection handle and checkout hostname allowlist. Enable Storefront read access for products, collections and checkout and publish the collection to that sales channel. Use the Storefront adapter’s `catalog()` to populate `public.products`. Use `checkout(body, trustedBuyerIp)` in the same-origin checkout route. Read the buyer IP only from the hosting platform’s trusted connection or proxy metadata.

Each product in the collection represents one sellable variant. Expose the JSON metafield `ttk.frontend` to Storefront and fill `id`, `category`, `art`, `reason`, `digital`, `featured`, `caution`, `safety` and `reviewer`. Shopify supplies the title, variant ID and EUR price. Use the exact Estonian finder tool name as the Shopify title for matching. Ten products are marked featured in the sample shop. Other exact tool matches sit in the extended catalogue. Fitted and load-bearing items appear as educational examples without purchasing actions.

Install and configure Maksekeskus, Tarne+ and digital fulfilment in the merchant’s Shopify checkout. The Storefront adapter adds preferences and versioned consent as cart attributes. The checkout and fulfilment configuration must use the authoritative payment choice, parcel locker selection, price and consent. The attributes alone do not control either app.

### Same-origin API

| Path | Contract |
| --- | --- |
| `GET /api/ttk/public` | A choice-independent national snapshot with `generatedAt`, verified `providers`, published `slots`, `courses` and Shopify `products`. Data types are in `src/model.ts` and `src/data/catalog.ts`. Slots are local Europe/Tallinn wall times with opaque IDs. Snapshot freshness limit is five minutes. |
| `POST /api/ttk/booking` | Accept exactly `slotId`, `bookerName`, one of `phone` or `email`, and `idempotencyKey`. Reserve atomically and reject conflicting availability with 409. Return `{reference, status: "confirmed" \| "pending"}`. |
| `POST /api/ttk/booking/status`, `booking/cancel` | Resolve retry state by idempotency key, returning the same receipt or `{status: "unresolved"}`. Cancel using an unguessable scoped reference or the governed provider channel. |
| `POST /api/ttk/register`, `inquiry`, `training-inquiry`, `quote` | Use purpose-specific requests. Register against a course ID with atomic seat checks. Organisation requests may include organisation name and registry number. Create Shopify draft orders for applicable confirmed quotes. Return `{reference}`. |
| `POST /api/ttk/checkout` | Invoke the Shopify Storefront adapter with variant IDs, quantities, payment preference, delivery preference if needed, and digital-delivery consent if needed. Return `{checkoutUrl}`. |
| `POST /api/ttk/withdraw` | Accept `order`, `email` and `idempotencyKey` from the explicit guest confirmation. Verify order access, record receipt durably and send timestamped acknowledgement. Return `{reference, receivedAt}` with an ISO date-time. |
| `POST /api/ttk/staff/authorise` | Create an SK Authentigate OIDC session for the chosen method and plan. Return `{authorizationUrl}`. The hosted flow displays the provider’s control code. Handle the callback server-side and redirect to `/#spetsialistile`. |
| `GET /api/ttk/staff/session` and `POST /api/ttk/staff/logout` | Return an authenticated staff profile with verified clearance or a pending registry-check state. Check Kutseregister and, where applicable, Äriregister and Terviseamet independently of the identity result. Clear the server session on logout. |
| `POST /api/ttk/staff/slots`, `staff/courses` | Authorise every publication against the current staff and organisation entitlement. Validate schedule overlaps, provider coverage and course data. Update the public snapshot before returning success. Return the assigned `{id}` for a course. |

Use the supplied research memo for provider review, data protection, release checks and the actual staffed helpline. The finder runs entirely in browser memory and uses a fixed public snapshot refresh schedule. Keep request bodies and contact information out of application, proxy and vendor logs.

## Verification

- `npm run check:browser` opens the built file in headless Chrome. It verifies the workflows at 1440×900 and 390×844, exercises all 25 activity prompts and five uncertainty routes at 320px, and checks SVGs and horizontal overflow, and writes five viewport PNGs under `qa-shots/`.
- `node scripts/check-live-contract.mjs` builds live mode temporarily and tests the public snapshot and transaction contract against intercepted HTTPS fixtures.
- `node scripts/check-shopify.mjs` verifies the Shopify Storefront adapter against GraphQL fixtures.
- `node scripts/check-acceptance.mjs` covers the remaining layout acceptance checks at 1440, 390 and 320: wordmark lockup, open menu, six drawers with sticky submit bars that never cover a focused field, tap targets, shadows, portraits, photo uniqueness and the 1.7 MB bundle limit. It writes review screenshots of the matched panel, menu, booking and cart drawers and the specialist page to `qa-shots/`.
- `scripts/make-photos.sh` re-cuts the 20 photos in `assets/derived/` from the originals with macOS `sips`.
- Use `CHROME_PATH` when Chrome is installed outside the standard macOS path.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0, via the [geoBoundaries Estonia ADM1 snapshot](https://www.geoboundaries.org/data/snapshots/1c423398df24ddf6e730b116567d2181c9782778d0459c3f3b76ca2f9f12b6bc/gbOpen/EST/ADM1/geoBoundaries-EST-ADM1_simplified.geojson). County geometry was projected and simplified for display. Place names are from the [GeoNames Estonia dump](https://download.geonames.org/export/dump/EE.zip), CC BY 4.0.
