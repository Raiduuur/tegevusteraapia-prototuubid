import assert from "node:assert/strict";
import { shopifyStorefront, StorefrontError } from "../server/shopify.ts";

const calls = [];
const variantId = "gid://shopify/ProductVariant/10";
const title = "Piltidega päevakava";
const metadata = {
  id: "piltidega-paevakava", category: "Päevakava ja rahu", art: "plan", reason: "Pildid saab järjekorda panna.",
  digital: true, featured: true, caution: "Kohandage pilte.", safety: "Prinditav PDF.", reviewer: "Tegevusterapeut",
};
const mockFetch = async (url, init) => {
  const { query, variables } = JSON.parse(init.body);
  calls.push({ url, init, query, variables });
  if (query.includes("query Catalog")) {
    const node = {
      title, ttk: { value: JSON.stringify(metadata) },
      variants: { nodes: [{ id: variantId, availableForSale: true, price: { amount: "6.90", currencyCode: "EUR" } }] },
    };
    return Response.json({ data: { collection: { products: {
      pageInfo: variables.after ? { hasNextPage: false, endCursor: null } : { hasNextPage: true, endCursor: "next" },
      nodes: variables.after ? [] : [node, { ...node, ttk: null }],
    } } } });
  }
  return Response.json({ data: { cartCreate: {
    cart: { checkoutUrl: "https://ttk-fixture.myshopify.com/checkouts/example" }, userErrors: [],
  } } });
};
const storefront = shopifyStorefront({
  shop: "ttk-fixture.myshopify.com", collection: "abivahendid", privateToken: "fixture",
  fetch: mockFetch,
});
const [first, second] = await Promise.all([storefront.catalog(), storefront.catalog()]);
assert.deepEqual(first, second);
assert.deepEqual(first, [{ ...metadata, name: title, cents: 690, variantId }]);
assert.equal(calls.length, 2);
const input = { lines: [{ variantId, quantity: 1 }], bank: "LHV" };
await assert.rejects(() => storefront.checkout({ ...input, sourceTask: "fixture" }), (error) => error instanceof StorefrontError && error.status === 400);
await assert.rejects(() => storefront.checkout(input), (error) => error instanceof StorefrontError && error.status === 400);
assert.equal(calls.length, 2);
const result = await storefront.checkout({ ...input, immediateDigitalDelivery: true });
assert.match(result.checkoutUrl, /^https:\/\/ttk-fixture\.myshopify\.com\/checkouts/);
assert.deepEqual(calls.at(-1).variables.input, {
  buyerIdentity: { countryCode: "EE" },
  lines: [{ merchandiseId: variantId, quantity: 1 }],
  attributes: [{ key: "ttk_payment_preference", value: "LHV" }, { key: "ttk_digital_delivery_consent", value: "v1:true" }],
});
assert.equal(calls.at(-1).init.headers["Shopify-Storefront-Private-Token"], "fixture");
console.log("Shopify Storefront adapter · catalog pagination, priced variants, checkout validation and cart creation passed");
