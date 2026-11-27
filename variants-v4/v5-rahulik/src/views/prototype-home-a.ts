// PROTOTYPE Variant A · Teatmik (Estonian Civic Activity Index)
// Tradition: Eesti telefoniraamat / Riigi Teataja reference print. Entry by WHAT is hard.
import { AUDIENCES, NEEDS_FITTING, SKA_AIDS_URL, TASKS, TOOL_TRY_NOTE, UNSURE, tasksFor } from "../data/finder";
import type { Course, Product } from "../data/catalog";
import type { AudienceId, Tag } from "../data/types";
import { findPlace } from "../data/places";
import {
  data, finderMatches, FORMATS, helpline, live, nextOpenProviders, providerCovers, regionSlots,
  selectedFinderSlots, store, upcomingCourses, type DirectoryProvider, type Region, type VisitSlot,
} from "../model";
import { btn, call, euro, fullDate, h, nav, shortSlot } from "../ui";
import { estoniaMapSvg } from "./directory";

export interface ActivityGroup {
  id: string;
  label: string;
  tags: readonly Tag[];
}

export const ACTIVITY_GROUPS: readonly ActivityGroup[] = [
  { id: "kirjutamine", label: "Kirjutamine ja käeosavus", tags: ["kirjutamine", "haare"] },
  { id: "soomine", label: "Söömine ja köögitoimingud", tags: ["soomine", "kook"] },
  { id: "pesemine", label: "Pesemine ja riietumine", tags: ["pesemine", "riietumine"] },
  { id: "kodu", label: "Kodu turvalisus ja liikumine", tags: ["kukkumine", "siirdumine", "kodu", "ruumid"] },
  { id: "paevakava", label: "Päevakava, mälu ja üleminekud", tags: ["paevakava", "uleminekud", "meelespea"] },
  { id: "sensoorne", label: "Müra, keskendumine ja rühmatöö", tags: ["sensoorne"] },
  { id: "too", label: "Tööasjad ja tööpäev", tags: ["too"] },
  { id: "asutus", label: "Koolitus asutusele ja abivahendite valik", tags: ["tootajad", "abivahendid"] },
];

const TOWNS: readonly [string, Region][] = [
  ["Tallinn ja Harjumaa", "Harjumaa"],
  ["Tartu ja Tartumaa", "Tartumaa"],
  ["Narva ja Ida-Virumaa", "Ida-Virumaa"],
  ["Pärnu ja Pärnumaa", "Pärnumaa"],
  ["Viljandi ja Viljandimaa", "Viljandimaa"],
  ["Rakvere ja Lääne-Virumaa", "Lääne-Virumaa"],
  ["Kuressaare ja Saaremaa", "Saaremaa"],
  ["Videokõne üle Eesti", "video"],
];

const MODES = [
  ["all", "Kõik"],
  ["kohal", "Kohapeal"],
  ["kodu", "Koduvisiit"],
  ["video", "Videokõne"],
] as const;

const MONTHS = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const hasLocal = (f: string) => f === "kohal" || f === "kodu";

export function initialsPlate(person: { id: string; name: string }): string {
  const letters = person.name.split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join("").toLocaleUpperCase("et");
  return `<span class="proto-initials" aria-hidden="true">${h(letters)}</span>`;
}

export function priceRangeLabel(person: DirectoryProvider, slots: VisitSlot[]): string {
  const prices = slots.length ? slots.map((s) => s.cents) : [person.visit.price * 100];
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? euro(low) : `${euro(low).replace(" €", "")}–${euro(high)}`;
}

/** Dynamic duration & price range computed from live/demo providers and published slots. */
export function firstVisitRangeText(): string {
  const minutes = data.providers.map((p) => p.visit.minutes);
  const slotCents = data.slots.map((s) => s.cents);
  const baseCents = data.providers.map((p) => p.visit.price * 100);
  const allCents = slotCents.length ? slotCents : baseCents;
  if (!minutes.length || !allCents.length) return "45–60 min · 45–80 €";
  const minM = Math.min(...minutes), maxM = Math.max(...minutes);
  const minE = Math.min(...allCents), maxE = Math.max(...allCents);
  const mText = minM === maxM ? `${minM} min` : `${minM}–${maxM} min`;
  const eText = minE === maxE ? euro(minE) : `${euro(minE).replace(" €", "")}–${euro(maxE)}`;
  return `${mText} · ${eText}`;
}

/** Non-callable plain text in demo mode so sample 5555 numbers are never misleading tel: links. */
export function helplineDisplay(): string {
  if (!helpline) return "";
  return live ? call(helpline) : `<span class="proto-demo-phone num">${h(helpline)} (näidis)</span>`;
}

export function honestSlotButton(person: DirectoryProvider, slot: VisitSlot): string {
  return `<button type="button" class="slot proto-slot" data-action="book" data-value="${h(slot.id)}"
    aria-label="Vali aeg, ${h(person.name)}, ${fullDate(slot.at)} kell ${slot.at.slice(11, 16)}, ${FORMATS[slot.format]}, ${euro(slot.cents)}">
    <span class="proto-slot-time num">${shortSlot(slot.at)}</span>
    <small class="proto-slot-meta">${FORMATS[slot.format]} · ${euro(slot.cents)}</small>
  </button>`;
}

function groupSummary(group: ActivityGroup): { providers: DirectoryProvider[]; formatsText: string } {
  const providers = data.providers.filter((p) => group.tags.some((t) => p.tags.includes(t)));
  const formatSet = new Set<string>();
  for (const p of providers) {
    for (const f of p.formats) formatSet.add(f === "kodu" ? "koduvisiit" : f === "video" ? "video" : "kohapeal");
  }
  return { providers, formatsText: [...formatSet].join(", ") };
}

/** Strict group-scoped task list: never leaks unrelated tasks from other activities. */
function groupTasks(group: ActivityGroup, audience: AudienceId | ""): typeof TASKS[number][] {
  const base = audience ? tasksFor(audience) : [...TASKS];
  return base.filter((t) => t.tags.some((tag) => group.tags.includes(tag)));
}

function slotTable(rows: { person: DirectoryProvider; slots: VisitSlot[] }[], emptyText: string): string {
  if (store.availability === "loading") return `<p class="proto-note">Laadime vabu aegu.</p>`;
  if (store.availability === "stale") {
    return `<div class="proto-note"><p>Vabu aegu ei õnnestunud laadida.</p>${btn("Proovi uuesti", "retry-public", "", "text-button")}</div>`;
  }
  if (!rows.length) return `<p class="proto-note">${h(emptyText)}</p>`;
  return `<div class="pa-ledger-rows">${rows.map(({ person, slots }) => `
    <article class="pa-person-row">
      <div class="pa-person-who">
        ${initialsPlate(person)}
        <div>
          <h4>${h(person.name)}</h4>
          <p class="pa-person-org">${h(person.city)} · ${h(person.org)}</p>
        </div>
      </div>
      <div class="pa-person-price num">
        <strong>${priceRangeLabel(person, slots)}</strong>
        <span>${person.visit.minutes} min</span>
      </div>
      <div class="pa-person-slots">
        ${slots.length
          ? `<div class="pa-slot-list">${slots.slice(0, 3).map((s) => honestSlotButton(person, s)).join("")}</div>
             ${slots.length > 3 ? btn("Vaata teisi aegu", "provider-slots", person.id, "text-button") : ""}`
          : `<p class="pa-empty-slot">Veebis vabu aegu pole.${person.contact?.phone ? ` ${btn("Kontaktid", "provider-contact", person.id, "text-button")}` : ""}</p>`}
      </div>
    </article>`).join("")}</div>`;
}

function dossierTools(tools: readonly string[]): string {
  return `<div class="pa-subblock">
    <div class="pa-subhead"><h4>Näiteid vahenditest</h4>${nav("e-pood", "Kõik vahendid e-poes")}</div>
    <ul class="pa-tool-list">${tools.map((name) => {
      const fitting = NEEDS_FITTING.has(name);
      const product = fitting ? undefined : data.products.find((p) => p.name === name);
      return `<li>
        <div><strong>${h(name)}</strong><span>${fitting ? "Küsige terapeudilt sobivuse ja paigalduse kohta." : h(product?.reason ?? "")}</span></div>
        ${product ? `<div class="pa-tool-act"><span class="num">${euro(product.cents)}</span>${btn("Vaata", "open-product", product.id, "text-button")}${btn("Lisa", "add-product", product.id, "text-button")}</div>` : ""}
      </li>`;
    }).join("")}</ul>
    <p class="pa-micro">${h(TOOL_TRY_NOTE)} <a class="text-link" href="${SKA_AIDS_URL}" target="_blank" rel="noreferrer">Kuidas saada vahendit soodsamalt?</a></p>
  </div>`;
}

function dossierCourses(courses: Course[]): string {
  if (!courses.length) return "";
  return `<div class="pa-subblock">
    <div class="pa-subhead"><h4>Sobiv koolitus</h4>${nav("koolituskalender", "Koolituskalender")}</div>
    <ul class="pa-tool-list">${courses.slice(0, 2).map((c) => `<li>
      <div><strong>${h(c.title)}</strong><span class="num">${fullDate(c.date)} · ${h(c.place)} · ${plural(c.seats, "vaba koht", "vaba kohta")}</span></div>
      <div class="pa-tool-act"><span class="num">${c.cents ? euro(c.cents) : "Tasuta"}</span>${btn("Vaata koolitust", "open-course", c.id, "text-button")}</div>
    </li>`).join("")}</ul>
  </div>`;
}

export function renderVariantADossierResults(group: ActivityGroup): string {
  const { audience, task } = store.finder;
  const matched = task ? finderMatches() : undefined;
  // Filter by audience immediately even before a specific task is picked.
  const baseProviders = matched
    ? matched.providers
    : groupSummary(group).providers.filter((p) => !audience || p.audiences.includes(audience));
  const rows = baseProviders
    .map((person) => ({ person, slots: selectedFinderSlots(person) }))
    .sort((a, b) => (a.slots[0]?.at ?? "9999").localeCompare(b.slots[0]?.at ?? "9999"))
    .slice(0, 4);

  const taskObj = matched?.task;
  const videoBlocked = taskObj && "videoOk" in taskObj && taskObj.videoOk === false;

  return `${videoBlocked ? `<p class="pa-alert">Selle tegevuse puhul vaatab terapeut üle tegeliku ruumi või liikumise — seepärast sobib kohtumine kohapeal või koduvisiidina, mitte videokõnena.</p>` : ""}
    ${matched ? `<p class="pa-guidance" id="wizard-preview-title" tabindex="-1"><strong>Mida tegevusteraapias tehakse:</strong> ${h(matched.task.result)}</p>` : `<h3 class="pa-results-title" id="wizard-preview-title" tabindex="-1">Terapeudid ja vabad ajad (${h(group.label.toLocaleLowerCase("et"))})</h3>`}
    <p class="pa-demo-bar">${live ? "Kõigil loetletud terapeutidel on Kutseregistris kehtiv kutsetunnistus ja isik kinnitatud." : "Näidisandmed · tegelikul lehel on iga terapeudi isik kinnitatud Smart-ID/Mobiil-ID-ga ja kutse kontrollitud Kutseregistrist."}</p>
    ${slotTable(rows, "Selle valikuga vabu aegu praegu ei leidu. Muutke sihtrühma, kohtumisviisi või piirkonda.")}
    ${matched ? `${dossierTools(matched.task.tools)}${dossierCourses(matched.courses)}` : ""}`;
}

function openDossier(group: ActivityGroup): string {
  const { audience, task, format, place } = store.finder;
  const tasks = groupTasks(group, audience);

  return `<div class="pa-dossier" role="region" aria-label="${h(group.label)}">
    <div class="pa-dossier-compact-top">
      <fieldset class="pa-who-strip">
        <legend>1. Kellele abi otsite?</legend>
        <div class="pa-who-chips">${AUDIENCES.map((a) => `
          <label class="pa-mode-opt${audience === a.id ? " is-active" : ""}">
            <input type="radio" name="audience" value="${h(a.id)}"${audience === a.id ? " checked" : ""}>
            <span>${h(a.label)}</span>
          </label>`).join("")}
        </div>
      </fieldset>
      <fieldset class="pa-task-compact">
        <legend>2. Täpsem olukord</legend>
        ${tasks.length ? `<div class="pa-task-grid">
          ${tasks.map((t) => `<label class="pa-radio">
            <input type="radio" name="task" value="${h(t.id)}"${task === t.id ? " checked" : ""}>
            <span>${h(t.label)}</span>
          </label>`).join("")}
          <label class="pa-radio">
            <input type="radio" name="task" value="${UNSURE.id}"${task === UNSURE.id ? " checked" : ""}>
            <span>${h(UNSURE.label)}</span>
          </label>
        </div>` : `<p class="pa-empty-task">Selles tegevuses valitud sihtrühmale eraldi olukorda ei ole. Valige muu sihtrühm või <label class="pa-inline-unsure"><input type="radio" name="task" value="${UNSURE.id}"${task === UNSURE.id ? " checked" : ""}> ${h(UNSURE.label)}</label>.</p>`}
        <p class="pa-privacy">Valikud jäävad ainult teie brauserisse. Neid ei salvestata ega saadeta kuhugi.
          ${audience || task ? `<button type="button" class="text-button" data-action="finder-reset">Alusta uuesti</button>` : ""}
        </p>
      </fieldset>
    </div>

    <div class="pa-results-zone">
      <div class="pa-results-bar">
        <fieldset class="pa-mode-row">
          <legend>Kohtumisviis</legend>
          <div class="pa-mode-list">${MODES.map(([id, label]) => `
            <label class="pa-mode-opt">
              <input type="radio" name="format" value="${id}"${(format || "all") === id ? " checked" : ""}>
              <span>${label}</span>
            </label>`).join("")}
          </div>
        </fieldset>
        <div class="pa-place-wrap"${hasLocal(format) ? "" : " hidden"}>
          <label for="wizard-place">Linn või vald</label>
          <input type="search" id="wizard-place" value="${h(place)}" list="wizard-places" autocomplete="off" placeholder="Näiteks Tartu" maxlength="80">
          <datalist id="wizard-places"></datalist>
          <p class="pa-micro" id="wizard-place-hint"${place.trim() && !findPlace(place) ? "" : " hidden"}>Valige loendist linn või vald. Seni näete vasteid üle Eesti.</p>
        </div>
      </div>

      <div data-proto-results>${renderVariantADossierResults(group)}</div>
    </div>
  </div>`;
}

function quickNextSlots(): string {
  const next = nextOpenProviders(3);
  return `<section class="pa-section" aria-labelledby="pa-next-title">
    <div class="pa-section-head">
      <div>
        <h2 id="pa-next-title">Lähimad vabad ajad üle Eesti</h2>
        <p class="pa-demo-bar">${live ? "Kõigil loetletud terapeutidel on kehtiv kutsetunnistus. Iga nupu juures on selle kohtumisviisi täpne hind." : "Näidisandmed · tegelikul lehel on terapeudi isik kinnitatud Smart-ID/Mobiil-ID-ga ja kutse kontrollitud Kutseregistrist. Iga nupu juures on selle kohtumisviisi täpne hind."}</p>
      </div>
      ${btn(`Kõik ${data.providers.length} terapeuti kaardil`, "directory-region", "all", "text-button")}
    </div>
    ${slotTable(next, "Praegu ei ole veebis vabu aegu.")}
    <p class="pa-first-visit-strip">
      <strong>Esimene kohtumine:</strong> räägite rahulikult, mis on igapäevaselt raske; proovite koos võtteid või vahendeid (midagi ei pea kohe ostma) ja lepite kokku ühe väikese sammu koduks. Kestus ja hind: <span class="num">${h(firstVisitRangeText())}</span>, tasulisele vastuvõtule saatekirjata. ${nav("terapeudid", "Vaata terapeute rahastuse järgi")}
    </p>
  </section>`;
}

function mapAndTable(): string {
  return `<section class="pa-section" aria-labelledby="pa-map-title">
    <div class="pa-section-head">
      <div>
        <h2 id="pa-map-title">Terapeudid maakondade ja linnade kaupa</h2>
        <p>Valige piirkond kaardilt või loendist. Mõni terapeut võtab vastu mitmes maakonnas või videokõne teel, seega võib piirkondade summa ületada terapeutide koguarvu (${data.providers.length}).</p>
      </div>
      ${btn(`Ava täiskaart (${data.providers.length} terapeuti)`, "directory-region", "all", "button secondary")}
    </div>
    <div class="pa-map-spread">
      <div class="pa-map-box">${estoniaMapSvg("all", { action: "home-region", counts: "all" })}</div>
      <table class="pa-table pa-table-stack">
        <thead><tr><th>Piirkond</th><th class="num">Terapeute</th><th class="num">Lähim aeg</th><th></th></tr></thead>
        <tbody>
          ${TOWNS.map(([label, region]) => {
            const people = data.providers.filter((p) => providerCovers(p, region));
            const slots = people.flatMap((p) => regionSlots(p, region)).sort((a, b) => a.at.localeCompare(b.at));
            return `<tr>
              <td data-col="Piirkond"><strong>${h(label)}</strong></td>
              <td data-col="Terapeute" class="num">${people.length}</td>
              <td data-col="Lähim aeg" class="num">${slots[0] ? shortSlot(slots[0].at) : "Päringuga"}</td>
              <td class="pa-td-act">${btn("Ava", "directory-region", region, "text-button")}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </section>`;
}

function trainingsTable(): string {
  const courses = upcomingCourses().slice(0, 4);
  return `<section class="pa-section" aria-labelledby="pa-courses-title">
    <div class="pa-section-head">
      <div>
        <h2 id="pa-courses-title">Koolitused lasteaedadele, koolidele, hooldekodudele ja lähedastele</h2>
        <p>Asutustele väljastame e-arve. Tellida saab ka koolituse oma meeskonnale kohapeal.</p>
      </div>
      <div class="pa-head-actions">
        ${btn("Telli koolitus asutusele (e-arvega)", "training-inquiry", "", "button primary")}
        ${nav("koolituskalender", "Kogu kalender")}
      </div>
    </div>
    <table class="pa-table pa-table-stack">
      <thead><tr><th>Kuupäev</th><th>Teema</th><th>Koht ja vabad kohad</th><th class="num">Hind</th><th></th></tr></thead>
      <tbody>
        ${courses.map((c) => {
          const m = MONTHS[Number(c.date.slice(5, 7)) - 1] ?? "";
          return `<tr>
            <td data-col="Kuupäev" class="pa-td-date"><strong>${Number(c.date.slice(8, 10))}. ${m}</strong></td>
            <td data-col="Teema"><strong>${h(c.title)}</strong></td>
            <td data-col="Koht">${h(c.place)} · <span class="num">${plural(c.seats, "vaba koht", "vaba kohta")}</span></td>
            <td data-col="Hind" class="num">${c.cents ? euro(c.cents) : "Tasuta"}</td>
            <td class="pa-td-act">${btn("Vaata", "calendar-course", c.id, "text-button")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </section>`;
}

function aidsIndex(): string {
  const picks: readonly [string, string][] = [
    ["Kirjutamine", "jame-pliiats"],
    ["Söömine", "libisemiskindel-lauamatt"],
    ["Päevakava (A4 PDF)", "piltidega-paevakava"],
  ];
  const items = picks.map(([cat, id]) => [cat, data.products.find((p) => p.id === id)] as const)
    .filter((pair): pair is readonly [string, Product] => Boolean(pair[1]));
  return `<section class="pa-section" aria-labelledby="pa-aids-title">
    <div class="pa-section-head">
      <div>
        <h2 id="pa-aids-title">Igapäevased abivahendid ja prinditavad lehed</h2>
        <p>Terapeutide valitud vahendid koos selgitusega, kellele vahend sobib ja kellele mitte.</p>
      </div>
      ${nav("e-pood", `Ava e-pood (${data.products.length})`, "button secondary")}
    </div>
    <ul class="pa-aids-list">
      ${items.map(([cat, product]) => `<li>
        <span class="pa-aid-cat">${h(cat)}</span>
        <div class="pa-aid-main">
          <strong><button type="button" class="text-button pa-aid-link" data-action="open-product" data-value="${h(product.id)}">${h(product.name)}</button></strong>
          <p>${h(product.reason)}</p>
        </div>
        <span class="pa-aid-price num">${euro(product.cents)}</span>
        <div class="pa-aid-act">${btn("Lisa ostukorvi", "add-product", product.id, "button secondary small")}</div>
      </li>`).join("")}
    </ul>
  </section>`;
}

export function renderVariantA(activeGroupId: string): string {
  const activeGroup = ACTIVITY_GROUPS.find((g) => g.id === activeGroupId);
  return `<div class="wrap proto-a">
    <header class="pa-masthead">
      <div>
        <p class="pa-kicker">Asutajad: tegevusterapeudid Terje ja Kristel</p>
        <h1 id="page-title" tabindex="-1">Mis on praegu raske?</h1>
        <p class="pa-lead">Valige alt igapäevane toiming. Näete kohe, kuidas tegevusterapeut aidata saab, kes sellega tegeleb ja millal on järgmine vaba aeg. <button type="button" class="text-button" data-proto-group="ei-tea">Ei oska öelda?</button></p>
      </div>
      <dl class="pa-spec-box">
        <div><dt>Esimene kohtumine</dt><dd class="num">${h(firstVisitRangeText())}</dd></div>
        <div><dt>Saatekiri</dt><dd>Tasulisele vastuvõtule ei ole vaja</dd></div>
        ${helpline ? `<div><dt>Nõu telefonil (E–R 9–17)</dt><dd>${helplineDisplay()}</dd></div>` : ""}
      </dl>
    </header>

    <section class="pa-index" aria-label="Igapäevaste toimingute indeks">
      <div class="pa-index-head">
        <span>Igapäevane toiming${live ? "" : " (näidisandmed)"}</span>
        <span>Terapeudid ja kohtumisviisid</span>
      </div>
      <div class="pa-index-list">
        ${ACTIVITY_GROUPS.map((group) => {
          const { providers, formatsText } = groupSummary(group);
          const open = activeGroup?.id === group.id;
          return `<div class="pa-index-item${open ? " is-open" : ""}">
            <button type="button" class="pa-index-trigger" data-proto-group="${h(group.id)}" aria-expanded="${open}">
              <span class="pa-index-name">${h(group.label)}</span>
              <span class="pa-index-meta">${plural(providers.length, "terapeut", "terapeuti")} · ${h(formatsText)}</span>
              <span class="pa-index-cue" aria-hidden="true">${open ? "Sulge −" : "Ava +"}</span>
            </button>
            ${open ? openDossier(group) : ""}
          </div>`;
        }).join("")}
        <div class="pa-index-item pa-index-unsure${activeGroupId === "ei-tea" ? " is-open" : ""}">
          <button type="button" class="pa-index-trigger" data-proto-group="ei-tea" aria-expanded="${activeGroupId === "ei-tea"}">
            <span class="pa-index-name">Ei oska öelda, vajan nõu</span>
            <span class="pa-index-meta">Aitame valida esimese sammu</span>
            <span class="pa-index-cue" aria-hidden="true">${activeGroupId === "ei-tea" ? "Sulge −" : "Ava +"}</span>
          </button>
          ${activeGroupId === "ei-tea" ? `<div class="pa-dossier pa-unsure-box">
            <p class="pa-guidance" id="wizard-preview-title" tabindex="-1">${h(UNSURE.result)}</p>
            ${helpline ? `<p>Võite ka helistada nõuandeliinile <strong>${helplineDisplay()}</strong> (E–R 9–17).</p>` : ""}
            ${slotTable(nextOpenProviders(3), "Praegu ei ole veebis vabu aegu.")}
          </div>` : ""}
        </div>
      </div>
    </section>

    ${activeGroup ? "" : quickNextSlots()}
    ${mapAndTable()}
    ${trainingsTable()}
    ${aidsIndex()}

    <section class="pa-colophon-strip" aria-labelledby="pa-founders-title">
      <div>
        <h2 id="pa-founders-title">Keskuse asutasid tegevusterapeudid Terje ja Kristel</h2>
        <p>Tegevusteraapia Keskus koondab Eesti tegevusterapeudid, praktilised koolitused ja igapäevased abivahendid ühte kohta. Tegelikul lehel saab iga terapeudi kutsetunnistust kontrollida Kutseregistrist.</p>
      </div>
      <div class="pa-specialist-box">
        <h3>Olete tegevusterapeut?</h3>
        <p>Kinnitage isik Smart-ID või Mobiil-ID-ga ja avaldage oma vastuvõtuajad ning koolitused Eesti kaardil.</p>
        ${nav("spetsialistile", "Liitu spetsialistina", "button primary")}
      </div>
    </section>
  </div>`;
}
