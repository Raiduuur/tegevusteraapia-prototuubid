import { CATEGORIES, type Product } from "../data/catalog";
import { AUDIENCES, TASKS, UNSURE } from "../data/finder";
import { PHOTOS, productMedia } from "../data/photos";
import { data, live, store } from "../model";
import { btn, euro, h, pageHead } from "../ui";

type Shelf = Product["category"] | "Terapeutide valik";
const audienceNames = {
  laps: "lapsed", ise: "täiskasvanud", eakas: "eakad", hooldaja: "hooldajad", asutus: "asutused",
};
/** Shelf photos illustrate a category, never a single product. */
const SHELF_PHOTOS: Record<Shelf, string> = {
  "Terapeutide valik": PHOTOS.tileMug,
  "Söömine ja riietumine": PHOTOS.tileCeramic,
  "Käed ja kirjutamine": PHOTOS.tilePencilsA,
  "Päevakava ja rahu": PHOTOS.tileTea,
  "Asutuste komplektid": PHOTOS.wideWorkshop,
};
const SHELVES = CATEGORIES.filter((category): category is Product["category"] => category !== "Kõik");
const COMPLIANCE = "CE ja EN 71 info kinnitatakse enne müüki.";
const fold = (text: string) => text.toLocaleLowerCase("et").normalize("NFD").replace(/\p{Diacritic}/gu, "");
const countText = (count: number) => `${count} ${count === 1 ? "vahend" : "vahendit"}`;
const slug = (text: string) => fold(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function audienceLine(product: Product): string {
  const names = UNSURE.tools.some((tool) => tool === product.name) ? "kõik sihtrühmad" : AUDIENCES
    .filter(({ id }) => TASKS.some((task) => task.audience === id && task.tools.includes(product.name)))
    .map(({ id }) => audienceNames[id]).join(", ");
  return names ? names.charAt(0).toLocaleUpperCase("et") + names.slice(1) : "";
}

function productRow(product: Product): string {
  const spec = [product.digital ? "<span>Prinditav PDF</span>" : "", h(audienceLine(product)), live ? h(product.safety) : ""].filter(Boolean).join(" · ");
  return `<article class="product">
    <div class="product-body">
      <h3><button class="product-name" type="button" data-action="open-product" data-value="${h(product.id)}" aria-label="Vaata toodet ${h(product.name)}">${h(product.name)}</button></h3>
      <p>${h(product.reason)}</p>
      ${spec ? `<p class="product-spec">${spec}</p>` : ""}
    </div>
    <div class="product-buy"><strong class="num">${euro(product.cents)}</strong>
      ${btn("Lisa ostukorvi", "add-product", product.id, "button secondary small")}</div>
  </article>`;
}

/** Demo mode says the compliance line once per shelf, and only where physical goods are listed. */
function complianceNote(products: Product[]): string {
  return !live && products.some((product) => !product.digital) ? `<p class="shelf-note">${COMPLIANCE}</p>` : "";
}

function shelf(title: Shelf, products: Product[], caption = ""): string {
  const id = `shelf-${slug(title)}`;
  return `<section class="shelf" aria-labelledby="${id}">
    <figure class="shelf-lead"><img class="photo" src="${SHELF_PHOTOS[title]}" alt="" width="560" height="700">${caption ? `<figcaption class="caption">${h(caption)}</figcaption>` : ""}</figure>
    <div class="shelf-body">
      <header class="shelf-head"><h2 id="${id}">${h(title)}</h2><p class="num">${countText(products.length)}</p></header>
      ${complianceNote(products)}
      <div class="product-grid">${products.map(productRow).join("")}</div>
    </div>
  </section>`;
}

function matches(product: Product, terms: string[]): boolean {
  const text = fold([product.name, product.reason, product.category, audienceLine(product)].join(" "));
  return terms.every((term) => text.includes(term));
}

function visibleProducts(): Product[] {
  const { category, more, query, pdf } = store.shop;
  const terms = fold(query).split(/\s+/).filter(Boolean);
  return data.products.filter((product) => (!pdf || product.digital) && (terms.length
    ? matches(product, terms)
    : category !== "Kõik" ? product.category === category : more || product.featured));
}

export function shopCount(): string {
  const { category, more, query } = store.shop;
  const count = visibleProducts().length;
  if (query.trim()) return `Leitud ${countText(count)}`;
  if (category === "Kõik" && !more) return `${count} terapeutide valitud ${count === 1 ? "vahend" : "vahendit"} ${data.products.length}-st`;
  return countText(count);
}

export function shopResults(): string {
  const { category, more, query } = store.shop;
  const products = visibleProducts();
  if (query.trim()) {
    return products.length
      ? `<h2 class="visually-hidden">Otsingu tulemused</h2>${complianceNote(products)}<div class="product-grid flat">${products.map(productRow).join("")}</div>`
      : `<div class="shop-empty"><p>„${h(query.trim())}” ei andnud tulemusi. Proovige lühemat sõna, näiteks „lusikas” või „päevakava”.</p>${btn("Tühjenda otsing", "shop-clear", "", "text-button")}</div>`;
  }
  if (!products.length) {
    return `<p class="shop-empty">${live && store.availability === "loading" ? "Laadime tooteid." : "Selles valikus ei ole praegu tooteid."}</p>`;
  }
  const toggle = category === "Kõik" && data.products.some((item) => !item.featured)
    ? `<div class="show-products">${btn(more ? "Näita ainult terapeutide valikut" : `Näita kõiki ${data.products.length} vahendit`, "more-products")}</div>` : "";
  if (category !== "Kõik") return shelf(category, products);
  if (more) {
    const ordered = (list: Product[]) => [...list.filter((p) => p.featured), ...list.filter((p) => !p.featured)];
    return `${SHELVES.map((name) => products.filter((product) => product.category === name))
      .map((list, index) => list.length ? shelf(SHELVES[index]!, ordered(list)) : "").join("")}${toggle}`;
  }
  const tiles = `<div class="shelf-tiles">${SHELVES.map((name) => {
    const count = data.products.filter((product) => product.category === name).length;
    return `<button type="button" class="shelf-tile" data-action="category" data-value="${h(name)}">
      <img class="photo" src="${SHELF_PHOTOS[name]}" alt="" width="560" height="420">
      <span><strong>${h(name)}</strong><span class="num">${countText(count)}</span></span>
    </button>`;
  }).join("")}</div>`;
  return `${shelf("Terapeutide valik", products, "Fotod on illustreerivad. Iga vahendi juures on kirjas, miks seda soovitame.")}${tiles}${toggle}`;
}

export function productDetail(product: Product): string {
  const media = productMedia(product);
  return `<div class="product-detail">
    ${media ? `<div class="product-media">${media}</div>` : ""}
    <div class="product-price"><strong class="num">${euro(product.cents)}</strong>${product.digital ? "<span>Prinditav PDF</span>" : ""}</div>
    <section><h3>Miks soovitame</h3><p>${h(product.reason)}</p></section>
    <section><h3>Kellele see ei sobi</h3><p>${h(product.caution)}</p></section>
    <p class="signed">Soovituse kirjutas ${h(product.reviewer)}.</p>
    <section class="product-safety"><h3>Tooteohutus ja märgistus</h3><p>${h(product.safety)}</p></section>
    <div class="drawer-actions">
      ${btn("Lisa ostukorvi", "add-product", product.id, "button primary full")}
      ${btn("Küsi pakkumist asutusele (e-arvega)", "quote", product.id, "button secondary full")}
    </div>
  </div>`;
}

export function shopView(): string {
  const { category, query, pdf } = store.shop;
  return `<section class="page shop-page">
    <div class="wrap">
      ${pageHead("Abivahendite e-pood", "Vahendid ja prinditavad töölehed igapäevaste toimingute harjutamiseks.", btn("Küsi pakkumist asutusele (e-arvega)", "quote"))}
      <div class="shop-tools">
        <input type="search" id="shop-search" class="shop-search" value="${h(query)}" autocomplete="off" maxlength="60" placeholder="Otsi vahendit, näiteks lusikas" aria-label="Otsi vahendit">
        <div class="segmented" role="group" aria-label="Tootekategooria">${CATEGORIES.map((value) => `<button type="button" data-action="category" data-value="${h(value)}" aria-pressed="${category === value}">${h(value)}</button>`).join("")}</div>
        <label class="check-line"><input type="checkbox" data-shop-filter="pdf"${pdf ? " checked" : ""}> Ainult prinditavad PDF-id</label>
        <p class="shop-count" role="status">${h(shopCount())}</p>
      </div>
      <div id="shop-results">${shopResults()}</div>
    </div>
  </section>`;
}
