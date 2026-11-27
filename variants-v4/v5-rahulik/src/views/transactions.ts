import type { Course, Product } from "../data/catalog";
import { portrait } from "../data/photos";
import { activeLines, type Booker, type CartLine, type Receipt } from "../transactions";
import { live, FORMATS, providerById, REGIONS, store, type DirectoryProvider, type VisitSlot } from "../model";
import { btn, euro, fullDate, h, option } from "../ui";

const error = '<p class="field-error" role="alert" tabindex="-1" hidden></p>';
const input = (name: string, label: string, attrs = "", value = "") =>
  `<label>${label}<input name="${name}" ${attrs} value="${h(value)}" required></label>`;
const contactInput = (initial?: Booker) => {
  const email = initial?.kind === "email";
  return `<label>Kuhu saadame kinnituse?<select name="kind" data-contact-kind>${option("phone", "Telefon", email ? "email" : "phone")}${option("email", "E-post", email ? "email" : "phone")}</select></label>
    <label><span data-contact-label>${email ? "E-posti aadress" : "Telefoninumber"}</span>
    <input name="contact" autocomplete="${email ? "email" : "tel"}" type="${email ? "email" : "tel"}" required maxlength="120" value="${h(initial?.contact)}"></label>`;
};
/** Every submit button sits in a sticky footer that is always the last child of its form. */
export const drawerActions = (buttons: string) => `<div class="drawer-actions">${buttons}</div>`;

const WEEKDAYS = ["P", "E", "T", "K", "N", "R", "L"];
const dayMonth = new Intl.DateTimeFormat("et-EE", { day: "numeric", month: "long", timeZone: "UTC" });
/** „N 26. november kell 11:00“ */
export function slotWhen(at: string): string {
  const day = new Date(`${at.slice(0, 10)}T12:00Z`);
  return `${WEEKDAYS[day.getUTCDay()]} ${dayMonth.format(day)} kell ${at.slice(11, 16)}`;
}

/** Face, name and organisation at the top of every therapist drawer. */
export function bookingWho(person: DirectoryProvider): string {
  return `<div class="booking-who">${portrait(person, 56)}<div><h3>${h(person.name)}</h3><p>Tegevusterapeut · ${h(person.org)}</p></div></div>`;
}

function slotSummary(person: DirectoryProvider, slot: VisitSlot, extra: string): string {
  return `<div class="transaction-summary">
    ${bookingWho(person)}
    <div class="booking-when"><strong class="num">${slotWhen(slot.at)}</strong>
      <p>${slot.minutes} min · ${h(FORMATS[slot.format])} · ${h(slot.location)}</p>${extra}</div>
  </div>`;
}

export function bookingForm(slot: VisitSlot, initial?: Booker, collision = ""): string {
  const person = providerById(slot.providerId);
  if (!person) return "<p>Seda aega ei leitud.</p>";
  return `${slotSummary(person, slot, `<p><strong class="num">${euro(slot.cents)}</strong> · ${h(slot.condition)}</p>`)}
  ${collision ? `<p class="field-error" role="alert">${h(collision)}</p>` : ""}
  ${btn("Muuda aega", "booking-alternatives", slot.id, "text-button")}
  <form id="booking-form" class="field-stack" novalidate>
    ${input("name", "Teie nimi", 'autocomplete="name" maxlength="90"', initial?.name)}
    ${contactInput(initial)}
    ${live
      ? `<p class="small-print">Kasutame teie nime ja kontakti aja broneerimiseks ja kinnituse saatmiseks. Andmed saab ${h(person.org)}. ${btn("Kuidas teie andmeid kasutame?", "privacy", "", "text-button")}</p>`
      : `<p class="small-print">Näidisbroneering: andmeid ei saadeta ega salvestata kuhugi. Kasutage prooviks väljamõeldud nime ja kontakti. ${btn("Kuidas andmeid pärislehel kasutame?", "privacy", "", "text-button")}</p>`}
    ${error}
    ${drawerActions(`<button class="button primary full" type="submit">${slot.requestOnly ? "Saada aja soov" : "Broneeri aeg"}</button>`)}
  </form>`;
}

export function bookingReceipt(slot: VisitSlot, receipt: Receipt): string {
  const person = providerById(slot.providerId);
  return `${person ? slotSummary(person, slot, `<p>Viide <strong class="num">${h(receipt.reference)}</strong></p>`) : `<div class="transaction-summary"><p>Viide ${h(receipt.reference)}</p></div>`}
  <p>${!live ? "Aeg eemaldati näidiskalendrist. Kinnitust välja ei saadetud."
    : receipt.status === "pending" ? "Oodake teenusepakkuja kinnitust."
      : "Kinnituse saadame teie antud kontaktile."}</p>
  ${drawerActions(`${receipt.status === "confirmed" ? btn("Laadi kalendrisse (.ics)", "download-ics", "", "button primary full") : ""}
    ${btn("Tühista aeg", "cancel-booking", "", "button secondary full")}
    ${btn("Sulge", "close", "", "text-button")}`)}`;
}

export function formDrawer(kind: "inquiry" | "training-inquiry" | "quote" | "register" | "withdraw", value: string, course?: Course, product?: Product, withdrawalEmail = ""): string {
  const organisation = kind === "training-inquiry" || kind === "quote";
  const register = kind === "register";
  const withdraw = kind === "withdraw";
  const personFields = withdraw ? "" : input("name", "Teie nimi", 'autocomplete="name" maxlength="90"');
  const { region } = store.directory;
  const regionLabel = region === "video" ? "Veebikohtumised" : region === "all" ? "Kogu Eesti" : REGIONS[region];
  return `
    ${course ? `<div class="transaction-summary"><h3>${h(course.title)}</h3><p class="num">${fullDate(course.date)} · ${h(course.place)} · ${course.cents ? euro(course.cents) : "Tasuta"}</p></div>` : ""}
    ${product ? `<div class="transaction-summary"><h3>${h(product.name)}</h3></div>` : ""}
    ${kind === "inquiry" ? `<p>Piirkond: <strong>${h(regionLabel)}</strong>. Kirjutage, millal saaksite kohtuda.</p>` : ""}
    ${withdraw ? "<p>Sisestage tellimuse number ja sama e-posti aadress, mida kasutasite ostul.</p>" : ""}
    <form id="action-form" class="field-stack" data-kind="${kind}" data-value="${h(value)}" novalidate>
      ${withdraw ? input("order", "Tellimuse number", 'maxlength="30"', value) : ""}
      ${personFields}
      ${kind === "inquiry" ? contactInput() : input("contact", "E-posti aadress", 'type="email" autocomplete="email" maxlength="120"', withdrawalEmail)}
      ${register ? `<label>Registreerun<select name="buyer" data-buyer><option value="private">Eraisikuna</option><option value="institution">Asutusena (e-arvega)</option></select></label>` : ""}
      ${organisation || register ? `<div class="field-stack" data-organisation ${register ? "hidden" : ""}>
          ${input("organisation", "Asutuse nimi", 'autocomplete="organization" maxlength="120"')}
          <label>Registrikood<input name="registry" inputmode="numeric" maxlength="8" pattern="[0-9]{8}" required></label>
        </div>` : ""}
      ${kind === "inquiry" || kind === "training-inquiry" ? `<label>Eelistatud kuupäev <span class="optional">(soovi korral)</span><input name="date" type="date"></label>` : ""}
      ${error}
      ${drawerActions(`<button class="button primary full" type="submit">${register ? "Registreeru koolitusele" : withdraw ? "Edasi" : "Saada päring"}</button>`)}
    </form>`;
}

export const BANKS = ["Swedbank", "SEB", "LHV", "Coop", "Luminor", "Kaart"];
export const CARRIERS = ["Omniva", "SmartPosti", "DPD", "Venipak"];
const picker = (label: string, key: "bank" | "delivery", options: string[]) =>
  `<fieldset class="checkout-options"><legend>${label}</legend><div>${options.map((value) =>
    `<label><input type="radio" name="${key}" value="${value}"${store.checkout[key] === value ? " checked" : ""}><span>${value}</span></label>`).join("")}</div></fieldset>`;

const cartLine = ({ product, quantity }: CartLine) => `<div class="cart-line">
  <div><h3>${h(product.name)}</h3><p class="num">${euro(product.cents)}${product.digital ? " · PDF" : ""}</p>
  <div class="quantity"><button type="button" data-action="cart-decrease" data-value="${h(product.id)}" aria-label="Vähenda toote ${h(product.name)} kogust">−</button><span class="num">${quantity}</span><button type="button" data-action="cart-increase" data-value="${h(product.id)}" aria-label="Suurenda toote ${h(product.name)} kogust">+</button></div></div>
  <strong class="num">${euro(product.cents * quantity)}</strong>
</div>`;
export function cartDrawer(): string {
  const lines = activeLines();
  if (!lines.length) return `<div class="empty-cart"><h3>Ostukorv on tühi</h3>${btn("Sirvi e-poodi", "to-shop", "", "button primary")}</div>`;
  const digital = lines.some(({ product }) => product.digital);
  const physical = lines.some(({ product }) => !product.digital);
  return `<div class="cart-lines">${lines.map(cartLine).join("")}</div>
    <form id="checkout-form" class="field-stack" novalidate>
      ${picker("Maksekeskus · makseviis", "bank", BANKS)}
      ${physical ? picker("Tarne+ · pakiautomaat", "delivery", CARRIERS) : ""}
      ${digital ? `<label class="check-line consent"><input name="consent" type="checkbox" ${store.checkout.consent ? "checked" : ""}> <span>Soovin PDF-i kohe kätte saada. Nõustun, et pärast allalaadimise võimaldamist kaotan digitoote taganemisõiguse.</span></label>` : ""}
      <div class="cart-total"><span>Tooted kokku</span><strong class="num">${euro(lines.reduce((total, line) => total + line.product.cents * line.quantity, 0))}</strong></div>
      ${btn("Ostate asutusele? Küsi pakkumist (e-arvega)", "quote", "", "text-button cart-quote")}
      ${physical ? "<p class=\"small-print\">Pakiautomaadi ja lõpliku tarnehinna valite järgmises sammus.</p>" : ""}
      ${error}
      ${drawerActions(`<button class="button primary full" type="submit">${live ? "Edasi Shopify kassasse" : "Vormista näidistellimus"}</button>`)}
    </form>
    ${btn("Taganemisavaldus", "withdraw", "", "text-button")}`;
}
