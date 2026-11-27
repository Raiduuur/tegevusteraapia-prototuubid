import { AUDIENCES } from "../data/finder";
import { COUNTY_PATHS, PINS } from "../data/map";
import { portrait } from "../data/photos";
import {
  data, directoryProviders, FORMATS, KINDS, live, providerCovers, REGIONS, regionSlots, store,
  type DirectoryProvider, type Region, type VisitSlot,
} from "../model";
import { btn, call, euro, fullDate, h, nav, option, pageHead, shortSlot } from "../ui";

const OSM = "https://www.openstreetmap.org/copyright";
const geob = "https://www.geoboundaries.org/";
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

interface MapOptions {
  /** Click action on counties and pins. The overview uses „home-region“ so strict test locators stay unique. */
  action?: "map-region" | "home-region";
  /** „all“ counts every listed therapist and ignores directory filters. */
  counts?: "filtered" | "all";
}

function mapPin({ city, county, x, y }: typeof PINS[number], selected: Region, action: string, counts: "filtered" | "all"): string {
  const people = counts === "all" ? data.providers.filter((person) => providerCovers(person, county)) : directoryProviders(county);
  const open = people.reduce((sum, person) => sum + regionSlots(person, county, true).length, 0);
  const width = city.length * 9.4 + 46;
  const center = city === "Narva" ? -24 : city === "Tartu" ? 22 : 0;
  const top = city === "Pärnu" ? 16 : -41;
  const label = `${city}, ${plural(people.length, "terapeut", "terapeuti")}, ${plural(open, "vaba aeg", "vaba aega")} sel nädalal`;
  return `<g class="map-pin ${selected === county ? "is-selected" : ""}" data-pin="${county}" data-action="${action}" data-value="${county}"
      tabindex="0" role="button" aria-pressed="${selected === county}" aria-label="${h(label)}" transform="translate(${x} ${y})">
    <title>${h(label)}</title>
    <circle class="pin-hit" r="24" fill="transparent"/><circle r="13" class="pin-halo"/><circle r="6.6" class="pin-dot"/>
    <rect class="pin-label" x="${(center - width / 2).toFixed(1)}" y="${top}" width="${width.toFixed(1)}" height="27" rx="8"/>
    <text class="pin-text" text-anchor="middle" x="${center}" y="${top + 19}">${h(city)} ${people.length}</text>
  </g>`;
}

export function estoniaMapSvg(region: Region, { action = "map-region", counts = "filtered" }: MapOptions = {}): string {
  return `<svg class="estonia-map" viewBox="0 0 698 456" role="group" aria-label="Eesti maakondade kaart">
    ${COUNTY_PATHS.map(({ county, path }) => `<path class="county ${county === region ? "is-selected" : ""}" d="${path}" data-action="${action}" data-value="${county}" fill-rule="evenodd"><title>${h(REGIONS[county])}</title></path>`).join("")}
    <text class="water-label" x="92" y="95">Läänemeri</text>
    ${PINS.map((pin) => mapPin(pin, region, action, counts)).join("")}
  </svg>`;
}

function formatsLine(person: DirectoryProvider): string {
  return person.formats.map((format, index) => index ? FORMATS[format].toLocaleLowerCase("et") : FORMATS[format]).join(", ");
}

export function slotButton(person: DirectoryProvider, slot: VisitSlot): string {
  return `<button type="button" class="slot" data-action="book" data-value="${h(slot.id)}"
    aria-label="Vali see aeg, ${h(person.name)}, ${fullDate(slot.at)} kell ${slot.at.slice(11, 16)}, ${FORMATS[slot.format]}, ${euro(slot.cents)}">${shortSlot(slot.at)}<small>${FORMATS[slot.format]} · ${euro(slot.cents)}</small></button>`;
}

export function credentialsButton(person: DirectoryProvider): string {
  return `<button class="text-button credentials" type="button" data-action="credentials" data-value="${h(person.id)}"
    aria-label="Vaata ${h(person.name)} kutsetunnistust ja isiku kinnitust">${live ? "Kutsetunnistus ja isiku kinnitus" : "Kutse ja isiku kinnituse näidis"}</button>`;
}

export function providerRole(person: DirectoryProvider): string {
  const level = person.kutse.match(/tase (\d)/)?.[1];
  return level ? `Tegevusterapeut, kutsetase ${level}` : "Tegevusterapeut";
}

export function providerCard(person: DirectoryProvider, slots: VisitSlot[]): string {
  const from = person.id === "riin-saar" && !live ? " alates" : "";
  return `<article class="provider-card" data-provider-county="${person.county}">
    ${portrait(person, 88)}
    <div class="provider-head">
      <h3>${h(person.name)}</h3>
      <p class="provider-role">${h(providerRole(person))}</p>
      <p class="provider-meta">${h(person.city)} · ${h(person.org)}</p>
      ${credentialsButton(person)}
      ${person.licence ? `<p class="licence">Terviseameti tegevusluba ${h(person.licence)}</p>` : ""}
    </div>
    <dl class="provider-facts">
      <div><dt>Kohtumine</dt><dd>${h(formatsLine(person))}</dd></div>
      <div><dt>Esimene kord</dt><dd class="num">${person.visit.minutes} min · ${euro(person.visit.price * 100)}${from}</dd></div>
      <div><dt>Keeled</dt><dd>${h(person.languages.join(", "))}</dd></div>
      <div><dt>Rahastus</dt><dd>${h(person.funding)}</dd></div>
    </dl>
    <div class="provider-availability">
    ${slots.length ? `<p class="small-label">Valige vaba aeg</p><div class="slot-list">${slots.slice(0, 3).map((slot) => slotButton(person, slot)).join("")}</div>
      ${slots.length > 3 ? btn("Vaata teisi aegu", "provider-slots", person.id, "text-button") : ""}`
      : `<p>${store.availability === "stale" ? "Vabu aegu ei õnnestunud laadida." : store.availability === "loading" ? "Laadime vabu aegu." : "Veebis vabu aegu ei ole."}</p>${person.contact?.phone ? btn("Vaata terapeudi kontakte", "provider-contact", person.id, "text-button") : ""}`}
    </div>
  </article>`;
}

export function directoryView(): string {
  const { region, audience, kind, funding, week } = store.directory;
  const filtered = region !== "all" || audience !== "all" || kind !== "all" || funding !== "all" || week;
  const providers = directoryProviders()
    .map((person) => ({ person, slots: regionSlots(person, region, week) }))
    .sort((a, b) => (a.slots[0]?.at ?? "9999").localeCompare(b.slots[0]?.at ?? "9999") || a.person.name.localeCompare(b.person.name, "et"));
  const open = providers.reduce((sum, { person }) => sum + regionSlots(person, region, true).length, 0);
  const regionLabel = region === "video" ? "Veebikohtumised" : region === "all" ? "Kogu Eesti" : REGIONS[region];
  return `<section class="page directory-page">
    <div class="wrap">${pageHead("Terapeudid ja Eesti kaart", "Valige kaardilt piirkond või vaadake, kes pakub videokohtumist.", nav("leia-abi", "Aita mul leida õige abi", "button secondary"))}</div>
    <div class="wrap filter-panel" role="group" aria-label="Terapeutide filtrid">
      <label>Piirkond<select data-filter="region">${option("all", "Kogu Eesti", region)}${option("video", "Veebikohtumised", region)}${Object.entries(REGIONS).map(([id, label]) => option(id, label, region)).join("")}</select></label>
      <label>Sihtrühm<select data-filter="audience">${option("all", "Kõik sihtrühmad", audience)}${AUDIENCES.map((a) => option(a.id, a.label, audience)).join("")}</select></label>
      <label>Pakkuja tüüp<select data-filter="kind">${option("all", "Kõik pakkujad", kind)}${Object.entries(KINDS).map(([id, value]) => option(id, value, kind)).join("")}</select></label>
      <label>Rahastus<select data-filter="funding">${option("all", "Kõik rahastused", funding)}${["Tasuline", "Tervisekassa", "SKA"].map((value) => option(value, value, funding)).join("")}</select></label>
      <label class="check-line week"><input type="checkbox" data-filter="week" ${week ? "checked" : ""}> Vabad ajad sel nädalal</label>
      ${filtered ? btn("Tühjenda filtrid", "clear-directory", "", "text-button clear-filters") : ""}
    </div>
    <div class="wrap">
      <div class="directory-layout">
        <div class="map-panel">
          <div class="map-top"><div><h2>Eesti kaart</h2><p>Valige maakond või linn.</p></div>
            <button type="button" class="map-video" data-action="map-region" data-value="video" aria-pressed="${region === "video"}">Veebikohtumised</button>
          </div>
          <div class="map-frame">${estoniaMapSvg(region)}</div>
          <div class="map-summary"><strong>${h(regionLabel)}</strong><span class="num">${plural(providers.length, "terapeut", "terapeuti")} · ${plural(open, "vaba aeg", "vaba aega")} sel nädalal</span></div>
          <p class="map-legend">Number linna juures näitab terapeutide arvu. ${btn("Näita kogu Eestit", "map-region", "all", "text-button")}</p>
          <p class="map-source">Kaardiandmed © <a href="${OSM}" target="_blank" rel="noreferrer">OpenStreetMapi kaastöötajad</a> · <a href="${geob}" target="_blank" rel="noreferrer">geoBoundaries</a> · <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></p>
        </div>
        <section class="directory-list" aria-labelledby="directory-list-title">
          <div class="section-title"><h2 id="directory-list-title">${plural(providers.length, "terapeut", "terapeuti")}</h2><span>${h(regionLabel)} · lähim vaba aeg ees</span></div>
          ${store.availability === "stale" ? `<div class="message"><p>Vabu aegu ei õnnestunud laadida.</p>${btn("Proovi uuesti", "retry-public", "", "text-button")}</div>` : ""}
          ${providers.length ? providers.map(({ person, slots }) => providerCard(person, slots)).join("") : `<div class="empty"><p>Selle valikuga terapeuti ei leidu.</p>${btn("Tühjenda filtrid", "clear-directory")}</div>`}
        </section>
      </div>
      <aside class="help-panel"><div><h2>Ei leidnud sobivat aega?</h2><p>Saatke valitud piirkonna terapeutidele ajapäring.</p></div>${btn("Saada päring piirkonna terapeutidele", "inquiry")}</aside>
      ${live && !providers.length && !week ? `<p>${call()}</p>` : ""}
    </div>
  </section>`;
}
