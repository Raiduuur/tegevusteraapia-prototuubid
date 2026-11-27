import "./styles.css";
import "./prototype-styles.css";
import { CATEGORIES, TRAINING_AUDIENCES, type Course } from "./data/catalog";
import { AUDIENCES, TASKS, UNSURE } from "./data/finder";
import { findPlace, suggestPlaces } from "./data/places";
import type { County, Format } from "./data/types";
import {
  cartCount, courseById, data, FORMATS, helpline, live, localTimeNow, moveMonth, newFinder, presetCalendar, presetDirectory, productById, providerById,
  refreshPublicData, regionSlots, REGIONS, releaseLocally, request, reserveLocally, safelyNavigate, selectedFinderSlots, ServiceError, slotsFor, store, VIEWS, today,
  type Region, type Staff, type View, type VisitSlot,
} from "./model";
import { btn, euro, fullDate, h, nav, shortSlot } from "./ui";
import { calendarView, courseDetail } from "./views/calendar";
import { directoryView } from "./views/directory";
import { finderView } from "./views/finder";
import { mountPrototypeSwitcher } from "./views/prototype-switcher";
import { productDetail, shopCount, shopResults, shopView } from "./views/shop";
import { authStart, demoRegistry, staffView } from "./views/staff";
import { BANKS, bookingForm, bookingReceipt, bookingWho, CARRIERS, cartDrawer, drawerActions, formDrawer } from "./views/transactions";
import {
  activeLines, bookerFrom, contactError, demoReceipt, protectedDetail, read, sensitiveError, transactionKey,
  validEmail, validName, type Booker, type Receipt,
} from "./transactions";

function node<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing element ${selector}`);
  return found;
}

const main = node<HTMLElement>("#sisu");
const header = node<HTMLElement>("#header");
const footer = node<HTMLElement>("#footer");
const drawer = node<HTMLDialogElement>("#drawer");
const notice = node<HTMLElement>("#notice");
const layouts = {
  "leia-abi": finderView, terapeudid: directoryView, koolituskalender: calendarView, "e-pood": shopView, spetsialistile: staffView,
};
const route = (): View => {
  const hash = location.hash.slice(1);
  return Object.hasOwn(VIEWS, hash) ? hash as View : "leia-abi";
};
let previousFocus: Element | null = null;
let drawerMode = "";
let toastTimer: number | undefined;
let booking: { slot: VisitSlot; booker?: Booker; receipt?: Receipt; key: string } | undefined;
let demoChallenge: { method: string; plan: string; code: string; registry: boolean; expiresAt: number } | undefined;
let editing = false;
let withdrawal: { order: string; email: string; key: string } | undefined;

const tel = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;
const wordmark = '<span>Tegevusteraapia</span> <span>Keskus</span>';

function renderHeader(): void {
  const count = cartCount();
  const links = Object.entries(VIEWS).map(([view, title]) => `<a href="#${view}" data-nav="${view}"${store.view === view ? ' aria-current="page"' : ""}>${h(title)}</a>`).join("");
  const navPhone = helpline
    ? live
      ? `<a class="nav-phone num" href="${tel(helpline)}">Helista ${h(helpline)}</a>`
      : `<span class="nav-phone num">Nõu: ${h(helpline)} (näidis)</span>`
    : "";
  const headerPhone = helpline && live
    ? `<a class="header-phone num" href="${tel(helpline)}" aria-label="Helista ${h(helpline)}">${h(helpline)}</a>`
    : "";
  header.innerHTML = `<div class="wrap header-row">
    <a class="brand" href="#leia-abi" data-nav="leia-abi">${wordmark}</a>
    <nav id="navigation" class="main-nav ${store.menu ? "is-open" : ""}" aria-label="Peamenüü">${links}${navPhone}</nav>
    <div class="header-actions">
      ${headerPhone}
      <button class="cart-header${count ? " has-items" : ""}" type="button" data-action="cart" aria-label="Ostukorv (${count})"><b class="w-long">Ostukorv</b><b class="w-short">Korv</b> <span aria-hidden="true">(${count})</span></button>
      <button class="menu-toggle" type="button" data-action="menu" aria-label="${store.menu ? "Sulge menüü" : "Ava menüü"}" aria-expanded="${store.menu}" aria-controls="navigation">${store.menu ? "Sulge" : "Menüü"}</button>
    </div>
  </div>`;
}

function renderFooter(): void {
  const phoneItem = helpline
    ? live
      ? `<li><a class="footer-phone num" href="${tel(helpline)}">${h(helpline)}</a></li>`
      : `<li><span class="footer-phone num">${h(helpline)} (näidis)</span></li>`
    : "";
  footer.innerHTML = `<div class="wrap">
    <div class="footer-grid">
      <div class="footer-brandcol">
        <a class="brand" href="#leia-abi" data-nav="leia-abi">${wordmark}</a>
        <p class="footer-about">Tegevusterapeudid, koolitused ja igapäevased abivahendid üle Eesti. Keskuse asutasid tegevusterapeudid Terje ja Kristel.</p>
      </div>
      <nav class="footer-col" aria-label="Abiotsijale"><h3>Abiotsijale</h3><ul>
        <li>${nav("leia-abi", "Leia abi", "")}</li><li>${nav("terapeudid", "Terapeudid ja kaart", "")}</li><li>${nav("e-pood", "E-pood", "")}</li>
        ${phoneItem}
      </ul></nav>
      <nav class="footer-col" aria-label="Asutusele"><h3>Asutusele</h3><ul>
        <li>${nav("koolituskalender", "Koolituskalender", "")}</li>
        <li>${nav("koolituskalender", "Koolitus asutusele (e-arvega)", "")}</li>
        <li>${nav("e-pood", "Pakkumine asutusele (e-arvega)", "")}</li>
      </ul></nav>
      <div class="footer-col"><h3>Spetsialistile ja ostjale</h3><ul>
        <li>${nav("spetsialistile", "Liitu Smart-ID või Mobiil-ID-ga", "")}</li>
        <li>${btn("Andmete kasutamine", "privacy", "", "footer-link")}</li>
        <li>${btn("Taganemisavaldus", "withdraw", "", "footer-link")}</li>
      </ul></div>
    </div>
    ${live ? "" : '<p class="footer-note">Näidisandmed. Terapeutide nimed, kontaktid ja vastuvõtuajad on näidised. Broneeringuid, tellimusi ega registrikontrolle päriselt ei tehta.</p>'}
  </div>`;
}

function equivalent(element: Element | null, scope: ParentNode): HTMLElement | SVGElement | undefined {
  if (!element) return undefined;
  if (element.id) return scope.querySelector<HTMLElement>(`#${CSS.escape(element.id)}`) ?? undefined;
  for (const attribute of ["data-action", "data-filter", "data-nav", "data-finder-select"]) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const choices = [...scope.querySelectorAll<HTMLElement | SVGElement>(`[${attribute}="${CSS.escape(value)}"]`)];
    const matched = choices.find((candidate) => candidate.getAttribute("data-value") === element.getAttribute("data-value") && candidate.tagName === element.tagName);
    if (matched) return matched;
  }
  return undefined;
}

function renderContent(focus?: "page" | "wizard" | "restore"): void {
  const prior = document.activeElement;
  main.innerHTML = layouts[store.view]();
  document.title = store.view === "leia-abi" && store.finder.step > 1
    ? (store.finder.step === 4 ? "Sobivad võimalused" : `Abi leidmine, ${store.finder.step}. samm`) + " | Tegevusteraapia Keskus"
    : `${VIEWS[store.view]} | Tegevusteraapia Keskus`;
  if (focus === "wizard") document.querySelector<HTMLElement>("#wizard-question")?.focus();
  if (focus === "page") document.querySelector<HTMLElement>("#page-title")?.focus({ preventScroll: true });
  if (focus === "restore") equivalent(prior, main)?.focus({ preventScroll: true });
}

function announce(message: string): void {
  notice.innerHTML = `<span>${h(message)}</span>`;
  notice.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => notice.classList.remove("visible"), 3400);
}

function clearNotice(): void {
  window.clearTimeout(toastTimer);
  notice.classList.remove("visible");
  notice.replaceChildren();
}

function openDrawer(title: string, body: string, mode = ""): void {
  clearNotice();
  drawerMode = mode;
  if (!drawer.open) previousFocus = document.activeElement;
  drawer.innerHTML = `<div class="drawer-head"><h2 tabindex="-1" id="drawer-title">${h(title)}</h2><button type="button" class="button secondary small" data-action="close">Sulge</button></div><div class="drawer-body">${body}</div>`;
  if (!drawer.open) drawer.showModal();
  document.documentElement.classList.add("drawer-open");
  drawer.scrollTop = 0;
  node<HTMLElement>("#drawer-title").focus({ preventScroll: true });
}
function updateCartDrawer(): void {
  const active = document.activeElement;
  const top = drawer.scrollTop;
  openDrawer("Ostukorv", cartDrawer(), "cart");
  drawer.scrollTop = top;
  const supported = equivalent(active, drawer);
  if (supported) supported.focus({ preventScroll: true });
}

drawer.addEventListener("cancel", (event) => {
  if (editing) event.preventDefault();
});
drawer.addEventListener("close", () => {
  if (drawer.open) return;
  document.documentElement.classList.remove("drawer-open");
  const destination = (previousFocus?.isConnected ? previousFocus : equivalent(previousFocus, document))
    ?? document.querySelector<HTMLElement>("#page-title");
  if (destination instanceof HTMLElement || destination instanceof SVGElement) destination.focus({ preventScroll: true });
  previousFocus = null;
  booking = undefined;
  demoChallenge = undefined;
  withdrawal = undefined;
});

async function restoreSession(): Promise<void> {
  if (!live || store.staff) return;
  try {
    const response = await request<{ staff?: Staff; pending?: boolean }>("staff/session");
    if (response.staff?.clearance === "verified") store.staff = response.staff;
    if (store.view !== "spetsialistile") return;
    if (store.staff) renderContent("page");
    if (response.pending) openDrawer("Registrite kontroll", "<p>Teie isik on kinnitatud. Ootame Kutseregistri ja asutuse andmete kontrolli.</p>");
  } catch {
    // A guest can still browse plans. The explicit sign-in action can retry.
  }
}

let syncSwitcher: () => void = () => {};

function navigate(view: View, push = true): void {
  clearNotice();
  const changed = view !== store.view;
  if (drawer.open && !editing) drawer.close();
  if (changed) {
    if (store.view === "leia-abi") store.finder = newFinder();
    if (store.view === "e-pood") store.shop.query = "";
    store.view = view;
  }
  store.menu = false;
  document.body.dataset.view = store.view;
  if (push && location.hash !== `#${view}`) history.pushState(null, "", `#${view}`);
  renderHeader();
  renderContent("page");
  syncSwitcher();
  window.scrollTo(0, 0);
  if (view === "spetsialistile") void restoreSession();
}

function setFinderRegion(value: string): void {
  if (value !== "all" && !Object.hasOwn(REGIONS, value)) return;
  store.finder.region = value as County | "all";
  store.finder.place = "";
  renderContent("restore");
}

function changeFinderStep(step: number): void {
  store.finder.step = step;
  store.finder.error = "";
  renderContent(step === 4 ? "page" : "wizard");
  if (step === 4) window.scrollTo(0, 0);
}

function startBooking(slot: VisitSlot): void {
  booking = { slot, key: transactionKey() };
  openDrawer("Kontrollige aega ja jätke kontakt", bookingForm(slot), "booking");
}

function altSlots(message = ""): void {
  if (!booking) return;
  const slot = booking.slot;
  const alternatives = slotsFor(slot.providerId, slot.format).filter((candidate) => candidate.id !== slot.id);
  const times = alternatives.map((candidate) => `<button type="button" class="slot" data-action="pick-alternative" data-value="${h(candidate.id)}">${shortSlot(candidate.at)}<small>${FORMATS[candidate.format]} · ${euro(candidate.cents)}</small></button>`).join("");
  openDrawer("Valige teine aeg", `${message ? `<p role="alert">${h(message)}</p>` : ""}<div class="slot-list">${times || "Teisi sama kohtumisviisi aegu praegu veebis pole."}</div>
    ${slotsFor(slot.providerId, slot.format).some((candidate) => candidate.id === slot.id) ? btn("Tagasi valitud aja juurde", "pick-alternative", slot.id, "text-button") : ""}`, "alternatives");
}

function downloadVisit(slot: VisitSlot, receipt: Receipt): void {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const localStart = slot.at.replace(/[-:]/g, "") + "00";
  const minutes = new Date(`${slot.at}:00Z`);
  minutes.setUTCMinutes(minutes.getUTCMinutes() + slot.minutes);
  const localEnd = minutes.toISOString().slice(0, 19).replace(/[-:]/g, "");
  const ical = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tegevusteraapia Keskus//Kalender//ET", "CALSCALE:GREGORIAN",
    "BEGIN:VTIMEZONE","TZID:Europe/Tallinn",
    "BEGIN:STANDARD","DTSTART:19701025T040000","RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU","TZOFFSETFROM:+0300","TZOFFSETTO:+0200","TZNAME:EET","END:STANDARD",
    "BEGIN:DAYLIGHT","DTSTART:19700329T030000","RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU","TZOFFSETFROM:+0200","TZOFFSETTO:+0300","TZNAME:EEST","END:DAYLIGHT","END:VTIMEZONE",
    "BEGIN:VEVENT", `UID:${receipt.reference.replace(/[^a-zA-Z0-9_-]/g, "")}@tegevusteraapiakeskus.ee`, `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Tallinn:${localStart}`, `DTEND;TZID=Europe/Tallinn:${localEnd}`, "SUMMARY:Kohtumine",
    "CLASS:PRIVATE", "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ical], { type: "text/calendar;charset=utf-8" }));
  const download = document.createElement("a");
  download.href = url;
  download.download = "kohtumine.ics";
  download.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formProblem(form: HTMLFormElement, message: string, field?: string): void {
  const target = form.querySelector<HTMLElement>(".field-error");
  if (!target) return;
  target.textContent = message;
  target.hidden = false;
  const input = field ? form.elements.namedItem(field) : null;
  if (input instanceof HTMLElement) {
    if (!target.id) target.id = `${form.id}-error`;
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", target.id);
    input.focus();
  } else {
    target.tabIndex = -1;
    target.focus();
  }
}

async function runForm(form: HTMLFormElement, work: () => Promise<void>): Promise<void> {
  if (editing) return;
  editing = true;
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button) button.disabled = true;
  form.setAttribute("aria-busy", "true");
  try {
    await work();
  } catch {
    formProblem(form, "Teenusega ei õnnestunud ühendust saada. Proovige uuesti.");
  } finally {
    editing = false;
    form.removeAttribute("aria-busy");
    if (button) button.disabled = false;
  }
}

const drawerTitles = { inquiry: "Päring piirkonna terapeutidele", "training-inquiry": "Telli koolitus oma asutusele", quote: "Küsi pakkumist asutusele", register: "Registreeru koolitusele", withdraw: "Taganemisavaldus" } as const;
type FormKind = keyof typeof drawerTitles;
function openActionForm(kind: FormKind, value = ""): void {
  openDrawer(drawerTitles[kind], formDrawer(kind, value, kind === "register" ? courseById(value) : undefined, kind === "quote" ? productById(value) : undefined), kind);
}

function action(name: string, value: string, origin: Element): void {
  if (editing) return;
  switch (name) {
    case "menu":
      store.menu = !store.menu;
      renderHeader();
      equivalent(origin, header)?.focus();
      break;
    case "close": drawer.close(); break;
    case "wizard-back": changeFinderStep(store.finder.step - 1); break;
    case "wizard-step": {
      const step = Number(value);
      if (Number.isInteger(step) && step >= 1 && step < store.finder.step) changeFinderStep(step);
      break;
    }
    case "wizard-region": setFinderRegion(value); break;
    case "finder-video":
      store.finder.format = "video";
      store.finder.region = "all";
      changeFinderStep(4);
      break;
    case "map-region":
      if (value === "all" || value === "video" || Object.hasOwn(REGIONS, value)) {
        store.directory.region = value as Region;
        renderContent("restore");
      }
      break;
    case "finder-reset":
      store.finder = newFinder();
      renderContent();
      document.querySelector<HTMLElement>("#page-title")?.focus();
      break;
    case "home-region":
    case "directory-region":
      if (value === "all" || value === "video" || Object.hasOwn(REGIONS, value)) {
        presetDirectory(value as Region);
        navigate("terapeudid");
      }
      break;
    case "calendar-course": {
      const course = courseById(value);
      if (course) {
        presetCalendar(course);
        navigate("koolituskalender");
      }
      break;
    }
    case "clear-directory":
      store.directory = { region: "all", audience: "all", kind: "all", funding: "all", week: false };
      renderContent("page");
      break;
    case "book": {
      const slot = data.slots.find((candidate) => candidate.id === value);
      if (slot && slotsFor(slot.providerId, slot.format).some((candidate) => candidate.id === slot.id)) startBooking(slot);
      else announce("See aeg pole enam saadaval. Valige teine aeg.");
      break;
    }
    case "booking-alternatives": {
      const form = drawer.querySelector<HTMLFormElement>("#booking-form");
      if (booking && form) {
        const values = new FormData(form);
        const name = read(values, "name"), contact = read(values, "contact");
        if (!protectedDetail(name) && !protectedDetail(contact)) booking.booker = { name, contact, kind: read(values, "kind") === "email" ? "email" : "phone" };
      }
      altSlots();
      break;
    }
    case "pick-alternative": {
      const slot = data.slots.find((candidate) => candidate.id === value);
      if (booking && slot) {
        if (booking.slot.id !== slot.id) booking.key = transactionKey();
        booking.slot = slot;
        openDrawer("Kontrollige aega ja jätke kontakt", bookingForm(slot, booking.booker), "booking");
      }
      break;
    }
    case "withdraw-edit":
      if (withdrawal) openDrawer("Taganemisavaldus", formDrawer("withdraw", withdrawal.order, undefined, undefined, withdrawal.email), "withdraw");
      break;
    case "cancel-booking": void cancelBooking(); break;
    case "download-ics": if (booking?.receipt) downloadVisit(booking.slot, booking.receipt); break;
    case "provider-slots":
    case "provider-contact":
    case "credentials": openProviderInfo(name, value); break;
    case "month":
      store.calendar.month = moveMonth(store.calendar.month, value === "1" ? 1 : -1);
      store.calendar.selected = "";
      renderContent("restore");
      break;
    case "training-audience":
      if (TRAINING_AUDIENCES.includes(value as typeof store.calendar.audience)) {
        store.calendar.audience = value as typeof store.calendar.audience;
        renderContent("restore");
      }
      break;
    case "select-course":
    case "agenda-course":
      store.calendar.selected = value;
      renderContent("restore");
      if (window.matchMedia("(max-width: 980px)").matches) document.querySelector<HTMLElement>("#calendar-detail")?.focus();
      break;
    case "open-course": {
      const course = courseById(value);
      if (course) openDrawer("Koolituse üksikasjad", courseDetail(course));
      break;
    }
    case "category":
      if (CATEGORIES.includes(value as typeof store.shop.category)) {
        store.shop.category = value as typeof store.shop.category;
        store.shop.query = "";
        renderContent("restore");
      }
      break;
    case "shop-clear": {
      store.shop.query = "";
      const search = document.querySelector<HTMLInputElement>("#shop-search");
      if (search) search.value = "";
      updateShopResults();
      search?.focus();
      break;
    }
    case "more-products":
      store.shop.more = !store.shop.more;
      renderContent("restore");
      break;
    case "open-product": {
      const product = productById(value);
      if (product) openDrawer(product.name, productDetail(product), "product");
      break;
    }
    case "add-product":
    case "cart-increase":
    case "cart-decrease": changeQuantity(name, value, origin); break;
    case "cart": openDrawer("Ostukorv", cartDrawer(), "cart"); break;
    case "to-shop": navigate("e-pood"); break;
    case "register":
    case "inquiry":
    case "training-inquiry":
    case "quote":
    case "withdraw": openActionForm(name, value); break;
    case "privacy":
      openDrawer("Kuidas teie andmeid kasutame?", `<div class="prose"><p>Abiotsija valikuid hoitakse lehe mälus. Valikud kustuvad, kui sulgete lehe, lahkute abiotsijast või broneerite aja.</p><p>${live ? "Aja broneerimisel edastame valitud aja viite, nime ja ühe kontaktandme. Teenuseosutaja kasutab andmeid broneeringu ja kinnituse jaoks." : "Näidisvorme saab proovida väljamõeldud andmetega. Andmeid teenuseosutajale ei saadeta."}</p>${booking && !booking.receipt ? btn("Tagasi aja juurde", "back-to-booking", "", "button secondary") : ""}</div>`, "privacy");
      break;
    case "back-to-booking":
      if (booking) openDrawer("Kontrollige aega ja jätke kontakt", bookingForm(booking.slot, booking.booker), "booking");
      break;
    case "auth": openDrawer("Kinnitage oma isik", authStart(value), "auth"); break;
    case "auth-start": void beginIdentity(value); break;
    case "logout": void logOut(); break;
    case "retry-public": void refreshAndRender(); break;
  }
}

function openProviderInfo(name: string, id: string): void {
  const person = providerById(id);
  if (!person) return;
  if (name === "credentials") {
    openDrawer("Isiku ja kutse kinnitus", `${bookingWho(person)}<dl class="detail-list"><div><dt>Isiku kinnitus</dt><dd>${h(person.verifiedVia)}</dd></div><div><dt>Kutseregister</dt><dd>${h(person.kutse)}</dd></div>${person.licence ? `<div><dt>Terviseameti tegevusluba</dt><dd>${h(person.licence)}</dd></div>` : ""}</dl>
      ${live ? "<p>Oleme kontrollinud terapeudi isikut ja kutset.</p>" : "<p>Registripäringut ei tehtud.</p>"}`);
  } else if (name === "provider-slots") {
    const permitted = store.view === "leia-abi" ? selectedFinderSlots(person) : regionSlots(person, store.directory.region, store.directory.week);
    openDrawer("Vabad ajad", `${bookingWho(person)}<div class="slot-list">${permitted.map((candidate) => `<button type="button" class="slot" data-action="book" data-value="${h(candidate.id)}">${shortSlot(candidate.at)}<small>${FORMATS[candidate.format]} · ${euro(candidate.cents)}</small></button>`).join("")}</div>`);
  } else {
    openDrawer("Terapeudi kontaktid", `${bookingWho(person)}${live
      ? `<p>${h(person.contact.phone)}<br>${h(person.contact.email)}<br>${h(person.contact.hours)}</p>`
      : ""}${btn("Saada ajapäring", "inquiry")}`);
  }
}

function changeQuantity(name: string, value: string, origin: Element): void {
  const product = productById(value);
  if (!product) return;
  const count = store.cart.get(value) ?? 0;
  const next = Math.min(99, count + (name === "cart-decrease" ? -1 : 1));
  if (next <= 0) store.cart.delete(value);
  else store.cart.set(value, next);
  store.checkout.consent = false;
  const insideHeader = header.contains(origin);
  renderHeader();
  if (insideHeader) equivalent(origin, header)?.focus();
  if (drawerMode === "cart" && drawer.open) updateCartDrawer();
  if (name === "add-product") {
    if (drawer.open) {
      updateCartDrawer();
      return;
    }
    announce(next === count ? "Ostukorvis saab olla kuni 99 sama toodet." : `${product.name} lisatud ostukorvi.`);
  }
}

async function submitBooking(form: HTMLFormElement): Promise<void> {
  if (!booking || booking.receipt) return;
  const accepted = bookerFrom(new FormData(form));
  if (typeof accepted === "string") {
    formProblem(form, accepted, accepted === sensitiveError ? undefined : accepted === "Sisestage oma nimi." ? "name" : "contact");
    return;
  }
  const current = booking;
  const { slot } = current;
  current.booker = accepted;
  await runForm(form, async () => {
    let receipt: Receipt;
    try {
      if (live) {
        try {
          receipt = await request<Receipt>("booking", { slotId: slot.id, bookerName: accepted.name,
            [accepted.kind]: accepted.contact, idempotencyKey: current.key });
        } catch (error) {
          if (error instanceof ServiceError && error.status < 500) throw error;
          const status = await request<Receipt | { status: "unresolved" }>("booking/status", { idempotencyKey: current.key });
          if (status.status === "unresolved") {
            formProblem(form, "Aja kinnitust ei ole veel näha. Proovige sama aja broneerimist uuesti.");
            return;
          }
          receipt = status;
        }
        if (!["pending", "confirmed"].includes(receipt.status) || !receipt.reference) throw new ServiceError(502);
      } else {
        if (slot.demoTaken || !data.slots.some((candidate) => candidate.id === slot.id)) throw new ServiceError(409);
        receipt = { status: slot.requestOnly ? "pending" : "confirmed", reference: demoReceipt("AEG") };
      }
    } catch (error) {
      if (!(error instanceof ServiceError) || error.status !== 409) throw error;
      reserveLocally(slot.id);
      if (live) await refreshPublicData();
      renderContent();
      altSlots("See aeg on vahepeal broneeritud. Valige teine aeg.");
      return;
    }
    reserveLocally(slot.id);
    current.receipt = receipt;
    current.booker = undefined;
    store.finder = newFinder();
    renderContent();
    const title = receipt.status === "pending" ? "Ajasoov on saadetud" : live ? "Aeg on broneeritud" : "Näidisaeg on broneeritud";
    openDrawer(title, bookingReceipt(slot, receipt), "booking-receipt");
  });
}

async function cancelBooking(): Promise<void> {
  if (editing || !booking?.receipt) return;
  if (drawerMode !== "booking-cancel") {
    openDrawer("Kas soovite aja tühistada?", `<p>${fullDate(booking.slot.at)} kell ${booking.slot.at.slice(11,16)}</p>
      ${drawerActions(btn("Kinnita tühistamine", "cancel-booking", "", "button primary full"))}`, "booking-cancel");
    return;
  }
  editing = true;
  try {
    if (live) {
      await request("booking/cancel", { reference: booking.receipt.reference });
      releaseLocally(booking.slot.id);
      await refreshPublicData();
    } else {
      releaseLocally(booking.slot.id);
      data.slots = [...data.slots, booking.slot];
    }
    renderContent();
    booking = undefined;
    openDrawer("Aeg on tühistatud", `<p>Võite valida uue aja terapeutide lehelt.</p>${nav("terapeudid", "Vaata terapeute", "button primary")}`);
  } catch {
    openDrawer("Tühistamine ei õnnestunud", `<p>Teenusega ei õnnestunud ühendust saada.</p>${btn("Proovi uuesti", "cancel-booking", "", "button primary full")}`, "booking-cancel");
  } finally {
    editing = false;
  }
}

const demoOrders = new Set(["TTK-1001"]);
async function submitCheckout(form: HTMLFormElement): Promise<void> {
  const values = new FormData(form);
  const lines = activeLines();
  if (!lines.length) return;
  const bank = read(values, "bank"), carrier = read(values, "delivery");
  const physical = lines.some(({ product }) => !product.digital);
  const digital = lines.some(({ product }) => product.digital);
  if (!BANKS.includes(bank)) return formProblem(form, "Valige makseviis.");
  if (physical && !CARRIERS.includes(carrier)) return formProblem(form, "Valige pakiautomaadi teenusepakkuja.");
  if (digital && !values.has("consent")) return formProblem(form, "Märkige nõusolek PDF-i koheseks allalaadimiseks.", "consent");
  await runForm(form, async () => {
    if (live) {
      const variants = lines.map(({ product, quantity }) => ({ variantId: product.variantId, quantity }));
      if (variants.some(({ variantId }) => !variantId)) return formProblem(form, "Mõni toode pole praegu saadaval.");
      const response = await request<{ checkoutUrl: string }>("checkout", { lines: variants, bank, ...(physical ? { carrier } : {}), ...(digital ? { immediateDigitalDelivery: true } : {}) });
      const checkoutHosts = String(import.meta.env.VITE_TTK_CHECKOUT_HOSTS ?? "").split(",").map((host) => host.trim());
      safelyNavigate(response.checkoutUrl, checkoutHosts);
      return;
    }
    const reference = demoReceipt("TTK");
    demoOrders.add(reference);
    store.cart.clear();
    store.checkout = { bank: "", delivery: "", consent: false };
    renderHeader();
    openDrawer("Näidistellimus on vormistatud", `<div class="transaction-summary"><p>Tellimuse number <strong>${reference}</strong></p><p>Makset ei tehtud.</p></div>
      ${btn("Taganemisavaldus", "withdraw", reference, "button secondary")}`);
  });
}

function sendForm(form: HTMLFormElement): void {
  const kind = form.dataset.kind as FormKind;
  const value = form.dataset.value ?? "";
  if (!Object.hasOwn(drawerTitles, kind)) return;
  const values = new FormData(form);
  const name = read(values, "name"), contact = read(values, "contact"), date = read(values, "date");
  const email = kind !== "inquiry" || read(values, "kind") === "email";
  const organisationRequired = kind === "training-inquiry" || kind === "quote" || kind === "register" && read(values, "buyer") === "institution";
  const organisation = read(values, "organisation"), registry = read(values, "registry");
  if ([name, contact, organisation].some(protectedDetail)) return formProblem(form, sensitiveError);
  if (kind !== "withdraw" && !validName(name)) return formProblem(form, "Sisestage oma nimi.", "name");
  if (kind === "inquiry") {
    const accepted = bookerFrom(values);
    if (typeof accepted === "string") return formProblem(form, accepted, "contact");
  } else if (!validEmail(contact)) return formProblem(form, contactError("email"), "contact");
  if (organisationRequired && !organisation) return formProblem(form, "Sisestage asutuse nimi.", "organisation");
  if (organisationRequired && !/^\d{8}$/.test(registry)) return formProblem(form, "Registrikoodis on kaheksa numbrit.", "registry");
  if (date && date < today()) return formProblem(form, "Valige tänane või hilisem kuupäev.", "date");
  const order = read(values, "order").toUpperCase();
  if (kind === "withdraw" && !/^#?[A-Z0-9][A-Z0-9-]{1,29}$/.test(order)) return formProblem(form, "Kontrollige tellimuse numbrit.", "order");
  if (kind === "withdraw") {
    if (!live && !demoOrders.has(order)) return formProblem(form, "Näidistellimust ei leitud. Proovige numbrit TTK-1001 või oma näidistellimuse numbrit.", "order");
    const previous = withdrawal;
    const key = previous && previous.order === order && previous.email === contact ? previous.key : transactionKey();
    withdrawal = { order, email: contact, key };
    openDrawer("Kontrollige taganemisavaldust", `<div class="transaction-summary"><p>Tellimuse number <strong>${h(order)}</strong></p>
      <p>Kinnituse e-posti aadress ${h(contact)}</p></div><form class="field-stack" id="withdrawal-confirm"><p>Kinnitage, et soovite selle ostulepingu lõpetada.</p>
      <p class="field-error" role="alert" hidden></p>${drawerActions('<button class="button primary full">Kinnita taganemine</button>')}</form>
      ${btn("Tagasi", "withdraw-edit", "", "text-button")}`, "withdrawal-confirm");
    return;
  }
  const course = kind === "register" ? courseById(value) : undefined;
  if (kind === "register" && (!course || course.seats < 1)) return formProblem(form, "Sellele koolitusele pole vabu kohti.");

  void runForm(form, async () => {
    const actionKey = form.dataset.key || transactionKey();
    form.dataset.key = actionKey;
    let reference = demoReceipt("TTK");
    if (live) {
      const result = await request<{ reference: string }>(kind, {
        bookerName: name, [email ? "email" : "phone"]: contact,
        ...(kind === "inquiry" ? { region: store.directory.region } : {}),
        ...(kind === "register" ? { courseId: value } : {}),
        ...(kind === "quote" && value ? { productId: value } : {}),
        ...(organisationRequired ? { organisation, registry } : {}),
        ...(date ? { preferredDate: date } : {}), idempotencyKey: actionKey,
      });
      reference = result.reference;
      if (kind === "register") await refreshPublicData();
    } else {
      if (course) course.seats--;
    }
    renderContent();
    const title = kind === "register" ? (live ? "Olete koolitusele registreeritud" : "Näidisregistreerimine on tehtud")
      : live ? "Päring on saadetud" : "Näidispäring on tehtud";
    openDrawer(title, `<div class="transaction-summary"><p>Viide <strong>${h(reference)}</strong></p></div>
      <p>${live ? "Kinnitus saadetakse teie antud kontaktile." : "See toiming toimus selles brauseris. Teadet välja ei saadetud."}</p>${btn("Sulge", "close", "", "button primary")}`);
  });
}

async function confirmWithdrawal(form: HTMLFormElement): Promise<void> {
  if (!withdrawal) return;
  const { order, email, key } = withdrawal;
  await runForm(form, async () => {
    const receipt = live ? await request<{ reference: string; receivedAt: string }>("withdraw", { order, email, idempotencyKey: key })
      : { reference: demoReceipt("TTK"), receivedAt: new Date().toISOString() };
    if (!live) demoOrders.delete(order);
    withdrawal = undefined;
    const received = new Intl.DateTimeFormat("et-EE", { timeZone: "Europe/Tallinn", dateStyle: "long", timeStyle: "short" }).format(new Date(receipt.receivedAt));
    openDrawer(live ? "Taganemisavaldus on vastu võetud" : "Näidistaganemisavaldus on vastu võetud",
      `<div class="transaction-summary"><p>Viide <strong>${h(receipt.reference)}</strong></p><p>Vastu võetud ${h(received)}</p></div>
        <p>${live ? "Kinnitus saadetakse teie e-posti aadressile." : "Näidiskinnitust e-postiga ei saadetud."}</p>${btn("Sulge", "close", "", "button primary")}`);
  });
}

async function beginIdentity(value: string): Promise<void> {
  const [method, plan] = value.split(":");
  if ((method !== "smart-id" && method !== "mobile-id") || !plan || !["baas", "profi", "praksis", "kliinik"].includes(plan)) return;
  if (live) {
    editing = true;
    try {
      const result = await request<{ authorizationUrl: string }>("staff/authorise", { method, plan });
      const hosts = String(import.meta.env.VITE_TTK_AUTH_HOSTS ?? "").split(",").map((host) => host.trim());
      safelyNavigate(result.authorizationUrl, hosts);
    } catch {
      openDrawer("Isiku kinnitamine", `<p>Isiku kinnitamise teenust ei õnnestunud avada. Proovige uuesti.</p>${authStart(plan)}`, "auth");
    } finally { editing = false; }
    return;
  }
  const random = globalThis.crypto.getRandomValues(new Uint16Array(1))[0] ?? 0;
  const code = String(random % 9000 + 1000);
  demoChallenge = { method, plan, code, registry: false, expiresAt: Date.now() + 120_000 };
  openDrawer(method === "smart-id" ? "Smart-ID kontrollkood" : "Mobiil-ID kontrollkood", `<p>Võrrelge kontrollkoodi. Proovimiseks sisestage all kuvatud kood.</p>
    <div class="auth-code">${code}</div><form class="field-stack" id="identity-code">
      <label>Neljakohaline kood<input name="code" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required></label>
      <p class="field-error" role="alert" hidden></p>${drawerActions('<button class="button primary full" type="submit">Kinnita kood</button>')}
    </form>${btn("Alusta uuesti", "auth", plan, "text-button")}`, "identity");
}

const demoPerson = (plan: string) => providerById(plan === "kliinik" ? "helen-org" : plan === "praksis" ? "riin-saar" : "kadri-tamm");
const demoCertificate = (plan: string) => demoPerson(plan)?.kutse.match(/\d{6}/)?.[0] ?? "";

function verifyDemoCode(form: HTMLFormElement): void {
  if (live || !demoChallenge) return;
  const code = read(new FormData(form), "code");
  if (Date.now() > demoChallenge.expiresAt) return formProblem(form, "Kontrollkood aegus. Alustage uuesti.", "code");
  if (code !== demoChallenge.code) return formProblem(form, "Kontrollkood ei klapi. Kontrollige nelja numbrit.", "code");
  demoChallenge.registry = true;
  openDrawer("Kontrolli kutset ja asutust", demoRegistry(demoChallenge.plan, demoCertificate(demoChallenge.plan)), "registry");
}

function verifyDemoRegistry(form: HTMLFormElement): void {
  if (live || !demoChallenge?.registry) return;
  const values = new FormData(form);
  const certificate = demoCertificate(demoChallenge.plan);
  if (read(values, "certificate") !== certificate) return formProblem(form, `Kasutage näidiskutsetunnistust ${certificate}.`, "certificate");
  if (values.has("organisation") && read(values, "organisation") !== "12345678") return formProblem(form, "Kasutage näidisregistrikoodi 12345678.", "organisation");
  if (values.has("licence") && read(values, "licence") !== "L06231") return formProblem(form, "Kasutage näidistegevusluba L06231.", "licence");
  const provider = demoPerson(demoChallenge.plan);
  if (!provider) return;
  store.staff = { id: provider.id, name: provider.name, clearance: "verified", provider };
  drawer.close();
  renderContent("page");
}

async function logOut(): Promise<void> {
  if (editing) return;
  editing = true;
  try {
    if (live) await request("staff/logout", {});
    store.staff = undefined;
    renderContent("page");
    announce("Olete töölaualt välja loginud.");
  } catch {
    announce("Väljalogimine ei õnnestunud. Proovige uuesti.");
  } finally { editing = false; }
}

function publishSlot(form: HTMLFormElement): void {
  const provider = store.staff?.provider;
  if (!provider) return;
  const values = new FormData(form);
  const at = `${read(values, "date")}T${read(values, "time")}`;
  const format = read(values, "format") as Format;
  const minutes = Number(read(values, "minutes")), cents = Math.round(Number(read(values, "price")) * 100);
  const timestamp = Date.parse(`${at}:00Z`);
  if (!Number.isFinite(timestamp) || at <= localTimeNow()) return formProblem(form, "Valige tulevikus olev kuupäev ja kellaaeg.", "date");
  if (!provider.formats.includes(format)) return formProblem(form, "Valige pakutav kohtumisviis.", "format");
  const overlaps = data.slots.some((slot) => {
    if (slot.providerId !== provider.id) return false;
    const other = Date.parse(`${slot.at}:00Z`);
    return other < timestamp + minutes * 60_000 && timestamp < other + slot.minutes * 60_000;
  });
  if (overlaps) return formProblem(form, "See aeg kattub teise avaldatud ajaga.", "time");
  void runForm(form, async () => {
    if (live) {
      await request("staff/slots", { at, format, minutes, cents });
      await refreshPublicData();
    } else {
      data.slots.push({ id: transactionKey(), providerId: provider.id, at, format, minutes, cents,
        location: format === "video" ? "Veebis" : format === "kodu" ? "Teie juures" : provider.city, condition: provider.funding });
    }
    renderContent();
    document.querySelector<HTMLElement>("#new-slot input")?.focus({ preventScroll: true });
    announce("Vastuvõtuaeg on avaldatud.");
  });
}

function publishCourse(form: HTMLFormElement): void {
  if (!store.staff) return;
  const values = new FormData(form);
  const title = read(values, "title"), date = read(values, "date"), place = read(values, "place");
  const start = read(values, "time"), end = read(values, "end");
  const audience = TRAINING_AUDIENCES.find((entry) => entry === read(values, "audience") && entry !== "Kõik");
  const task = TASKS.find((item) => item.id === read(values, "topic"));
  const description = read(values, "description");
  if (!title || !place || !description || !audience || !task || audience === "Kõik") return formProblem(form, "Täitke koolituse andmed.");
  if (date < today()) return formProblem(form, "Valige tänane või hilisem kuupäev.", "date");
  if (end <= start) return formProblem(form, "Lõpuaeg peab olema algusajast hilisem.", "end");
  const online = place.toLocaleLowerCase("et") === "veebis";
  const matchingRegion = (Object.entries(REGIONS).find(([key, label]) => label.split(" ja ").concat(key, key === "Saaremaa" ? "Kuressaare" : "").filter(Boolean).some((location) => place.toLocaleLowerCase("et").startsWith(location.toLocaleLowerCase("et"))))?.[0]);
  const county = online ? undefined : (matchingRegion as County | undefined) ?? store.staff.provider.county;
  const course: Course = { id: transactionKey(), title, short: title.length > 22 ? `${title.slice(0, 21)}…` : title, date,
    time: `${start.replace(":", ".")}–${end.replace(":", ".")}`, place, county, audience,
    eligible: [...new Set([task.audience, "asutus"] as const)], tags: [...task.tags], hours: Number(read(values, "hours")),
    cents: Math.round(Number(read(values, "price")) * 100), ehis: read(values, "ehis") || "Andmed puuduvad",
    seats: Number(read(values, "seats")), teacher: store.staff.name, description,
  };
  void runForm(form, async () => {
    if (live) {
      const published = await request<{ id: string }>("staff/courses", course);
      course.id = published.id;
      await refreshPublicData();
    } else data.courses.push(course);
    store.calendar.month = date.slice(0, 7);
    store.calendar.audience = "Kõik";
    store.calendar.selected = course.id;
    renderContent();
    document.querySelector<HTMLElement>("#new-course input")?.focus({ preventScroll: true });
    announce("Koolitus on avaldatud.");
  });
}

async function refreshAndRender(): Promise<void> {
  await refreshPublicData();
  if ((store.view !== "leia-abi" || store.finder.step === 4) && !(store.view === "spetsialistile" && store.staff)) renderContent("restore");
}

/** Re-renders only the shop list and its count, so the search field keeps focus while typing. */
function updateShopResults(): void {
  const results = document.querySelector<HTMLElement>("#shop-results");
  const count = document.querySelector<HTMLElement>(".shop-count");
  if (results) results.innerHTML = shopResults();
  if (count) count.textContent = shopCount();
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLElement>("a[data-nav]");
  if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    if (!editing) navigate(link.dataset.nav as View);
    return;
  }
  const trigger = event.target.closest("[data-action]");
  if (trigger) action(trigger.getAttribute("data-action") ?? "", trigger.getAttribute("data-value") ?? "", trigger);
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof SVGElement && target.classList.contains("map-pin") && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    action(target.getAttribute("data-action") ?? "", target.getAttribute("data-value") ?? "", target);
  }
});

document.addEventListener("input", (event) => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement)) return;
  if (field.form && field.form !== document.getElementById("finder-form")) {
    const formError = field.form.querySelector<HTMLElement>(".field-error");
    if (formError) formError.hidden = true;
    field.removeAttribute("aria-invalid");
  }
  if (field.id === "shop-search") {
    store.shop.query = field.value.slice(0, 60);
    updateShopResults();
    return;
  }
  if (field.id !== "finder-place") return;
  store.finder.place = field.value;
  const list = node<HTMLDataListElement>("#finder-places");
  list.replaceChildren(...suggestPlaces(field.value).map((value) => new Option(value)));
});

document.addEventListener("change", (event) => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
  field.removeAttribute("aria-invalid");
  const filter = field.dataset.filter;
  if (filter) {
    if (filter === "week" && field instanceof HTMLInputElement) store.directory.week = field.checked;
    if (filter === "region") store.directory.region = field.value as Region;
    if (filter === "audience") store.directory.audience = field.value as typeof store.directory.audience;
    if (filter === "kind") store.directory.kind = field.value as typeof store.directory.kind;
    if (filter === "funding") store.directory.funding = field.value as typeof store.directory.funding;
    renderContent("restore");
  } else if (field.dataset.shopFilter === "pdf" && field instanceof HTMLInputElement) {
    store.shop.pdf = field.checked;
    updateShopResults();
  } else if (field.dataset.finderSelect) {
    setFinderRegion(field.value);
  } else if (field.closest("#finder-form")) {
    const error = document.querySelector<HTMLElement>("#finder-error");
    if (error) error.hidden = true;
    store.finder.error = "";
    if (field.name === "audience") {
      if (store.finder.audience !== field.value) store.finder.task = "";
      store.finder.audience = field.value as typeof store.finder.audience;
    } else if (field.name === "task") store.finder.task = field.value;
    else if (field.name === "format") {
      store.finder.format = field.value as typeof store.finder.format;
      const regions = document.querySelector<HTMLElement>(".region-select");
      if (regions) regions.hidden = field.value === "video";
    }
  } else if (field.hasAttribute("data-contact-kind")) {
    const email = field.value === "email";
    const contact = field.form?.querySelector<HTMLInputElement>('[name="contact"]');
    const label = field.form?.querySelector<HTMLElement>("[data-contact-label]");
    if (contact && label) {
      contact.autocomplete = email ? "email" : "tel";
      contact.type = email ? "email" : "tel";
      label.textContent = email ? "E-posti aadress" : "Telefoninumber";
    }
  } else if (field.hasAttribute("data-buyer")) {
    const organisation = field.form?.querySelector<HTMLElement>("[data-organisation]");
    if (organisation) organisation.hidden = field.value !== "institution";
  } else if (field.form?.id === "checkout-form") {
    if (field.name === "bank" || field.name === "delivery") store.checkout[field.name] = field.value;
    if (field.name === "consent" && field instanceof HTMLInputElement) store.checkout.consent = field.checked;
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (editing) return;
  switch (form.id) {
    case "finder-form": {
      const { step, audience, task, format } = store.finder;
      if (step === 1 && !AUDIENCES.some(({ id }) => id === audience)
          || step === 2 && task !== UNSURE.id && !TASKS.some((item) => item.id === task && item.audience === audience)
          || step === 3 && !format) {
        const message = step === 2 ? "Valige üks vastus. Kui te ei tea, valige „Ei oska öelda, vajan nõu”." : "Valige üks vastus.";
        store.finder.error = message;
        const error = node<HTMLElement>("#finder-error");
        error.textContent = message;
        error.hidden = false;
        error.focus();
      } else if (step === 3 && format !== "video" && store.finder.place.trim() && !findPlace(store.finder.place)) {
        const message = "Seda kohta ei leidu. Proovige valla nime või valige „Näita kõiki võimalusi”.";
        store.finder.error = message;
        const error = node<HTMLElement>("#finder-error");
        error.textContent = message;
        error.hidden = false;
        node<HTMLInputElement>("#finder-place").focus();
      } else {
        changeFinderStep(step + 1);
      }
      break;
    }
    case "booking-form": void submitBooking(form); break;
    case "action-form": sendForm(form); break;
    case "withdrawal-confirm": void confirmWithdrawal(form); break;
    case "checkout-form": void submitCheckout(form); break;
    case "identity-code": verifyDemoCode(form); break;
    case "registry-form": verifyDemoRegistry(form); break;
    case "new-slot": publishSlot(form); break;
    case "new-course": publishCourse(form); break;
  }
});

function highlightCard(target: EventTarget | null): void {
  const person = target instanceof Element ? target.closest<HTMLElement>("[data-provider-county]") : null;
  const county = person?.dataset.providerCounty;
  document.querySelectorAll(".map-pin").forEach((pin) => pin.classList.toggle("is-highlighted", Boolean(county) && pin.getAttribute("data-pin") === county));
}
main.addEventListener("mouseover", (event) => highlightCard(event.target));
main.addEventListener("mouseleave", () => highlightCard(document.activeElement));
main.addEventListener("focusin", (event) => highlightCard(event.target));
main.addEventListener("focusout", (event) => highlightCard(event.relatedTarget));

function exitFinder(): void {
  store.finder = newFinder();
  booking = undefined;
  withdrawal = undefined;
  if (drawer.open) drawer.close();
  if (store.view === "leia-abi") main.replaceChildren();
}
window.addEventListener("pagehide", exitFinder);
window.addEventListener("pageshow", (event) => { if (event.persisted) navigate(route(), false); });
window.addEventListener("popstate", () => navigate(route(), false));
window.addEventListener("hashchange", () => { if (route() !== store.view) navigate(route(), false); });
renderFooter();
syncSwitcher = mountPrototypeSwitcher(() => {
  renderHeader();
  renderFooter();
  if (store.view === "leia-abi") renderContent();
});
navigate(route(), false);
if (live) {
  void refreshAndRender();
  window.setInterval(() => void refreshAndRender(), 60_000);
}
