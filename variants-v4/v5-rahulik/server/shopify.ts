import type { Art, Product } from "../src/data/catalog";

interface ShopifyConfig {
  shop: string;
  privateToken: string;
  collection: string;
  checkoutHosts?: readonly string[];
  fetch?: typeof fetch;
}

export class StorefrontError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const catalogQuery = `query Catalog($handle: String!, $after: String) @inContext(country: EE) {
  collection(handle: $handle) {
    products(first: 40, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title
        ttk: metafield(namespace: "ttk", key: "frontend") { value }
        variants(first: 2) { nodes { id availableForSale price { amount currencyCode } } }
      }
    }
  }
}`;

const checkoutMutation = `mutation CreateCart($input: CartInput!) @inContext(country: EE) {
  cartCreate(input: $input) {
    cart { checkoutUrl }
    userErrors { code }
  }
}`;

interface Variant {
  id: string;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string };
}
interface Catalog {
  collection: null | { products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: { title: string; ttk: { value: string } | null; variants: { nodes: Variant[] } }[];
  } };
}

const categories = ["Söömine ja riietumine", "Käed ja kirjutamine", "Päevakava ja rahu", "Asutuste komplektid"];
const arts: Art[] = ["pencil", "scissors", "spoon", "jar", "mat", "lace", "plan", "timer", "home", "cards"];
const banks = ["Swedbank", "SEB", "LHV", "Coop", "Luminor", "Kaart"];
const carriers = ["Omniva", "SmartPosti", "DPD", "Venipak"];
const variantPattern = /^gid:\/\/shopify\/ProductVariant\/\d+$/;

function metaValue(value: string): Omit<Product, "variantId" | "name" | "cents"> | undefined {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const { id, category, art, reason, digital, featured, caution, safety, reviewer } = parsed;
    const fields = [id, category, art, reason, caution, safety, reviewer];
    if (fields.some((field) => typeof field !== "string" || !field.trim())
        || typeof digital !== "boolean" || typeof featured !== "boolean"
        || !categories.includes(String(category)) || !arts.includes(art as Art)
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(id))) return undefined;
    return { id, category, art, reason, digital, featured, caution, safety, reviewer } as Omit<Product, "variantId" | "name" | "cents">;
  } catch {
    return undefined;
  }
}

function centsOf(variant: Variant): number | undefined {
  if (!variant.availableForSale || !variantPattern.test(variant.id) || variant.price.currencyCode !== "EUR") return undefined;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(variant.price.amount);
  if (!match) return undefined;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : undefined;
}

interface CheckoutLine { variantId: string; quantity: number }
interface CheckoutInput { lines: CheckoutLine[]; bank: string; carrier?: string; immediateDigitalDelivery?: boolean }

function asCheckout(value: unknown): CheckoutInput {
  if (typeof value !== "object" || value === null) throw new StorefrontError("Ostukorv on vigane.", 400);
  const { lines, bank, carrier, immediateDigitalDelivery } = value as Record<string, unknown>;
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 50 || typeof bank !== "string" || !banks.includes(bank)
      || (carrier !== undefined && (typeof carrier !== "string" || !carriers.includes(carrier)))
      || (immediateDigitalDelivery !== undefined && immediateDigitalDelivery !== true)
      || Object.keys(value).some((key) => !["lines","bank","carrier","immediateDigitalDelivery"].includes(key))) {
    throw new StorefrontError("Kontrollige ostukorvi ja makseviisi.", 400);
  }
  const valid = lines.every((line: unknown) => {
    if (!line || typeof line !== "object") return false;
    const { variantId, quantity } = line as Record<string, unknown>;
    return typeof variantId === "string" && variantPattern.test(variantId) && typeof quantity === "number"
      && Number.isInteger(quantity) && quantity > 0 && quantity <= 99 && Object.keys(line).length === 2;
  });
  if (!valid || new Set(lines.map((line: CheckoutLine) => line.variantId)).size !== lines.length) {
    throw new StorefrontError("Kontrollige toodete koguseid.", 400);
  }
  return { lines, bank, carrier, immediateDigitalDelivery } as CheckoutInput;
}

export function shopifyStorefront(config: ShopifyConfig) {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.shop) || !config.privateToken ||
      !/^[a-z0-9][a-z0-9-]*$/.test(config.collection)) throw new Error("Shopify Storefront configuration is incomplete.");
  const send = config.fetch ?? globalThis.fetch;
  const endpoint = `https://${config.shop}/api/2026-10/graphql.json`;
  const allowedHosts = new Set([config.shop, ...(config.checkoutHosts ?? [])]);
  let inventory: { validUntil: number; products: Product[] } | undefined;
  let pending: Promise<Product[]> | undefined;

  async function graphql<T>(query: string, variables: object, buyerIp?: string): Promise<T> {
    const response = await send(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Shopify-Storefront-Private-Token": config.privateToken,
        ...(buyerIp ? { "Shopify-Storefront-Buyer-IP": buyerIp } : {}),
      },
      body: JSON.stringify({ query, variables }),
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new StorefrontError("Shopify teenus ei vastanud.");
    const result = await response.json() as { data?: T; errors?: unknown };
    if (result.errors || !result.data) throw new StorefrontError("Shopify ei saanud päringut täita.");
    return result.data;
  }

  async function loadCatalog(): Promise<Product[]> {
    const records: Product[] = [];
    let after: string | null = null;
    do {
      const result: Catalog = await graphql<Catalog>(catalogQuery, { handle: config.collection, after });
      if (!result.collection) throw new StorefrontError("Shopify tootekogu ei leitud.");
      const { nodes, pageInfo } = result.collection.products;
      for (const node of nodes) {
        const variant = node.variants.nodes.length === 1 ? node.variants.nodes[0] : undefined;
        const meta = node.ttk && metaValue(node.ttk.value);
        const cents = variant && centsOf(variant);
        if (variant && meta && cents !== undefined) records.push({ ...meta, name: node.title, cents, variantId: variant.id });
      }
      if (pageInfo.hasNextPage && (!pageInfo.endCursor || pageInfo.endCursor === after)) throw new StorefrontError("Shopify tootekogu lehitsemine ei õnnestunud.");
      after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
    } while (after);
    if (new Set(records.map(({ id }) => id)).size !== records.length) throw new StorefrontError("Shopify toodete tunnused peavad olema erinevad.");
    return records;
  }

  async function catalog(): Promise<Product[]> {
    if (inventory && inventory.validUntil > Date.now()) return inventory.products;
    pending ??= loadCatalog().then((products) => {
      inventory = { validUntil: Date.now() + 60_000, products };
      return products;
    }).finally(() => { pending = undefined; });
    return pending;
  }

  async function checkout(raw: unknown, trustedBuyerIp?: string): Promise<{ checkoutUrl: string }> {
    const { lines, bank, carrier, immediateDigitalDelivery } = asCheckout(raw);
    const products = await catalog();
    const selected = lines.map((line) => products.find((item) => item.variantId === line.variantId));
    if (selected.some((item) => !item)) throw new StorefrontError("Mõni toode pole praegu saadaval.", 409);
    if (selected.some((item) => item && !item.digital) && !carrier) throw new StorefrontError("Valige tarneviis.", 400);
    if (selected.some((item) => item?.digital) && !immediateDigitalDelivery) throw new StorefrontError("Kinnitage PDF-i kohene kättetoimetamine.", 400);
    const attributes = [
      { key: "ttk_payment_preference", value: bank },
      ...(carrier ? [{ key: "ttk_delivery_preference", value: carrier }] : []),
      ...(immediateDigitalDelivery ? [{ key: "ttk_digital_delivery_consent", value: "v1:true" }] : []),
    ];
    const result = await graphql<{ cartCreate: { cart: { checkoutUrl: string } | null; userErrors: unknown[] } }>(
      checkoutMutation, { input: { buyerIdentity: { countryCode: "EE" }, lines: lines.map(({ variantId, quantity }) => ({ merchandiseId: variantId, quantity })), attributes } }, trustedBuyerIp,
    );
    const { cart, userErrors } = result.cartCreate;
    if (userErrors.length || !cart?.checkoutUrl) throw new StorefrontError("Shopify ei saanud ostukorvi luua.", 409);
    const url = new URL(cart.checkoutUrl);
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || url.username || url.password) throw new StorefrontError("Shopify kassa aadressi ei saadud kinnitada.");
    return { checkoutUrl: url.href };
  }

  return { catalog, checkout };
}
