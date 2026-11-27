// PROTOTYPE Variant B · Vastuvõtt (Nordic Founders' Monograph & Guided Care Sheet)
// Tradition: Nordic practice handbook. Entry by WHO founded it & WHO needs help.
import { AUDIENCES, NEEDS_FITTING, SKA_AIDS_URL, TASKS, TOOL_TRY_NOTE, UNSURE, tasksFor } from "../data/finder";
import type { Course, Product } from "../data/catalog";
import { findPlace } from "../data/places";
import {
  data, finderMatches, helpline, live, nextOpenProviders, providerCovers,
  selectedFinderSlots, store, upcomingCourses, type DirectoryProvider, type Region, type VisitSlot,
} from "../model";
import { btn, euro, fullDate, h, nav } from "../ui";
import { estoniaMapSvg } from "./directory";
import { firstVisitRangeText, helplineDisplay, honestSlotButton, initialsPlate, priceRangeLabel } from "./prototype-home-a";

const STARTERS = ["laps-pliiats", "ise-pesemine", "eakas-vannituba", "hooldaja-vahend", "asutus-koolitus"] as const;
const MODES = [
  ["all", "ükskõik kuidas"],
  ["kohal", "kohapeal"],
  ["kodu", "koduvisiidina"],
  ["video", "video teel"],
] as const;
const TOWNS: readonly [string, Region][] = [
  ["Tallinn", "Harjumaa"], ["Tartu", "Tartumaa"], ["Narva", "Ida-Virumaa"], ["Pärnu", "Pärnumaa"],
  ["Viljandi", "Viljandimaa"], ["Rakvere", "Lääne-Virumaa"], ["Kuressaare", "Saaremaa"], ["Videokõne", "video"],
];
const MONTHS = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const hasLocal = (f: string) => f === "kohal" || f === "kodu";

function appointmentBookRow(person: DirectoryProvider, slots: VisitSlot[]): string {
  return `<article class="pb-appt-row">
    <div class="pb-appt-who">
      ${initialsPlate(person)}
      <div>
        <h4>${h(person.name)}</h4>
        <p>${h(person.city)} · ${h(person.org)} · <span class="num">${priceRangeLabel(person, slots)} / ${person.visit.minutes} min</span></p>
      </div>
    </div>
    <div class="pb-appt-slots">
      ${slots.length
        ? `<div class="pb-slot-strip">${slots.slice(0, 3).map((s) => honestSlotButton(person, s)).join("")}</div>
           ${slots.length > 3 ? btn("Vaata teisi aegu", "provider-slots", person.id, "text-button") : ""}`
        : `<p class="pb-muted">Veebis vabu aegu ei ole.${person.contact?.phone ? ` ${btn("Kontaktid", "provider-contact", person.id, "text-button")}` : ""}</p>`}
    </div>
  </article>`;
}

function careSheetTools(tools: readonly string[]): string {
  return `<div class="pb-care-sub">
    <div class="pb-sub-head"><h4>Näiteid vahenditest</h4>${nav("e-pood", "Kõik e-poes")}</div>
    <ul class="pb-inline-list">${tools.map((name) => {
      const fitting = NEEDS_FITTING.has(name);
      const product = fitting ? undefined : data.products.find((p) => p.name === name);
      return `<li>
        <div><strong>${h(name)}</strong><span>${fitting ? "Küsige terapeudilt sobivuse ja paigalduse kohta." : h(product?.reason ?? "")}</span></div>
        ${product ? `<div class="pb-inline-act"><span class="num">${euro(product.cents)}</span>${btn("Vaata", "open-product", product.id, "text-button")}${btn("Lisa", "add-product", product.id, "text-button")}</div>` : ""}
      </li>`;
    }).join("")}</ul>
    <p class="pb-footnote">${h(TOOL_TRY_NOTE)} <a class="text-link" href="${SKA_AIDS_URL}" target="_blank" rel="noreferrer">Kuidas saada vahendit soodsamalt?</a></p>
  </div>`;
}

function careSheetCourses(courses: Course[]): string {
  if (!courses.length) return "";
  return `<div class="pb-care-sub">
    <div class="pb-sub-head"><h4>Sobiv koolitus</h4>${nav("koolituskalender", "Koolituskalender")}</div>
    <ul class="pb-inline-list">${courses.slice(0, 2).map((c) => `<li>
      <div><strong>${h(c.title)}</strong><span class="num">${fullDate(c.date)} · ${h(c.place)} · ${plural(c.seats, "vaba koht", "vaba kohta")}</span></div>
      <div class="pb-inline-act"><span class="num">${c.cents ? euro(c.cents) : "Tasuta"}</span>${btn("Vaata", "open-course", c.id, "text-button")}</div>
    </li>`).join("")}</ul>
  </div>`;
}

export function renderVariantBResults(): string {
  const { audience, task } = store.finder;
  const matched = task ? finderMatches() : undefined;
  // Filter by audience immediately even before a specific task is selected.
  const rows = matched
    ? matched.providers.slice(0, 4).map((person) => ({ person, slots: selectedFinderSlots(person) }))
    : audience
      ? data.providers
          .filter((p) => p.audiences.includes(audience))
          .map((person) => ({ person, slots: selectedFinderSlots(person) }))
          .sort((a, b) => (a.slots[0]?.at ?? "9999").localeCompare(b.slots[0]?.at ?? "9999"))
          .slice(0, 4)
      : nextOpenProviders(3);

  const taskObj = matched?.task;
  const videoBlocked = taskObj && "videoOk" in taskObj && taskObj.videoOk === false;

  return `${videoBlocked ? `<p class="pb-callout">Selle toimingu puhul peab terapeut nägema tegelikku ruumi või liikumist — seetõttu pakume kohtumist kohapeal või koduvisiidina.</p>` : ""}
    ${matched ? `<blockquote class="pb-pullquote"><p>${h(matched.task.result)}</p></blockquote>` : ""}
    <p class="pb-demo-note">${live ? "Kõigil loetletud tegevusterapeutidel on kehtiv kutsetunnistus Kutseregistrist ja isik kinnitatud." : "Näidisandmed · tegelikul lehel on terapeudi isik kinnitatud Smart-ID/Mobiil-ID-ga ja kutse kontrollitud Kutseregistrist. Iga aja juures on selle kohtumisviisi täpne hind."}</p>

    ${store.availability === "loading" ? `<p class="pb-muted">Laadime vabu aegu.</p>`
      : store.availability === "stale" ? `<p class="pb-muted">Vabu aegu ei õnnestunud laadida. ${btn("Proovi uuesti", "retry-public", "", "text-button")}</p>`
      : rows.length
        ? `<div class="pb-appt-list">${rows.map(({ person, slots }) => appointmentBookRow(person, slots)).join("")}</div>`
        : `<p class="pb-muted">Selle valikuga vabu aegu praegu ei leidu. Muutke sihtrühma, kohtumisviisi või piirkonda.</p>`}

    ${matched ? `<div class="pb-care-extras">${careSheetTools(matched.task.tools)}${careSheetCourses(matched.courses)}</div>` : ""}`;
}

function appointmentBook(): string {
  const { audience, task, format, place } = store.finder;
  const activeAudience = AUDIENCES.find((a) => a.id === audience);

  return `<section class="pb-book" id="pb-vastuvotud" aria-labelledby="wizard-preview-title">
    <div class="pb-book-top">
      <div>
        <p class="pb-chapter-tag">Vastuvõtuajad</p>
        <h2 id="wizard-preview-title" tabindex="-1">${task ? "Teie olukorrale sobiv abi" : activeAudience ? `Terapeudid (${h(activeAudience.label.toLocaleLowerCase("et"))})` : "Lähimad vabad vastuvõtuajad"}</h2>
      </div>
      <fieldset class="pb-sentence-filter">
        <legend>Kohtun meelsamini:</legend>
        <div class="pb-mode-inline">${MODES.map(([id, label]) => `
          <label class="pb-mode-chip">
            <input type="radio" name="format" value="${id}"${(format || "all") === id ? " checked" : ""}>
            <span>${label}</span>
          </label>`).join("")}
        </div>
      </fieldset>
    </div>

    <div class="pb-place-row"${hasLocal(format) ? "" : " hidden"}>
      <label for="wizard-place">Linn või vald</label>
      <input type="search" id="wizard-place" value="${h(place)}" list="wizard-places" autocomplete="off" placeholder="Näiteks Tartu" maxlength="80">
      <datalist id="wizard-places"></datalist>
      <p class="pb-footnote" id="wizard-place-hint"${place.trim() && !findPlace(place) ? "" : " hidden"}>Valige loendist linn või vald. Seni näete vasteid üle Eesti.</p>
    </div>

    <div data-proto-results>${renderVariantBResults()}</div>

    <div class="pb-book-foot">
      ${btn(`Vaata kõiki ${data.providers.length} terapeuti Eesti kaardil`, "directory-region", "all", "text-button")}
    </div>
  </section>`;
}

export function renderVariantB(): string {
  const { audience, task } = store.finder;
  const activeAudience = AUDIENCES.find((a) => a.id === audience);
  const taskList = audience
    ? tasksFor(audience)
    : STARTERS.map((id) => TASKS.find((t) => t.id === id)!);
  const activeTask = task === UNSURE.id ? UNSURE : TASKS.find((t) => t.id === task);
  const courses = upcomingCourses().slice(0, 4);
  const aidsPicks = ["jame-pliiats", "libisemiskindel-lauamatt", "piltidega-paevakava"]
    .map((id) => data.products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

  return `<div class="wrap proto-b">
    <section class="pb-foreword" aria-labelledby="page-title">
      <div class="pb-letter">
        <p class="pb-kicker">Tegevusteraapia Keskus · Terje ja Kristel</p>
        <h1 id="page-title" tabindex="-1">Kui igapäevane toiming on raske, <em>aitab tegevusterapeut.</em></h1>
        <p class="pb-letter-body">Meie töö algab alati ühest tavalisest asjast — kuidas laps saab kääridega lõigata, kuidas pärast haigust jälle ise süüa teha või kuidas eakas lähedane julgeb kodus vannituppa minna. Tasulisele vastuvõtule saab tulla ilma saatekirja ja diagnoosita.</p>
        <div class="pb-hero-actions">
          <button type="button" class="button primary" data-proto-jump="#pb-vastuvotud">Vaata vabu aegu ↓</button>
          <button type="button" class="text-button" data-proto-jump="#pb-intake-title">Aita mul sobiv abi valida</button>
        </div>
        <p class="pb-signature">Terje ja Kristel <span>tegevusterapeudid, keskuse asutajad</span></p>
      </div>
      <aside class="pb-margin" aria-label="Oluline teada enne kohtumist">
        <p class="pb-margin-title">Enne esimest kohtumist</p>
        <dl class="pb-margin-facts">
          <div><dt>Kestus ja hind</dt><dd class="num">${h(firstVisitRangeText())}</dd></div>
          <div><dt>Saatekiri</dt><dd>Tasulisele vastuvõtule pole vaja</dd></div>
          ${helpline ? `<div><dt>Nõu telefonil (E–R 9–17)</dt><dd>${helplineDisplay()}</dd></div>` : ""}
        </dl>
      </aside>
    </section>

    <section class="pb-conversation" aria-labelledby="pb-intake-title">
      <div class="pb-conv-head">
        <p class="pb-chapter-tag">Vestluse algus</p>
        <h2 id="pb-intake-title">Kellele te abi otsite?</h2>
        ${activeAudience || activeTask ? `<p class="pb-summary-line">Valitud: <strong>${h(activeAudience?.label ?? "")}</strong>${activeTask ? ` · <em>${h(activeTask.label)}</em>` : ""} <button type="button" class="text-button" data-action="finder-reset">Alusta uuesti</button></p>` : ""}
      </div>

      <fieldset class="pb-reading-list">
        <legend class="visually-hidden">Valige, kellele abi otsite</legend>
        ${AUDIENCES.map((a, i) => `
          <label class="pb-letter-choice${audience === a.id ? " is-picked" : ""}${i === AUDIENCES.length - 1 ? " is-wide" : ""}">
            <input type="radio" name="audience" value="${h(a.id)}"${audience === a.id ? " checked" : ""}>
            <span class="pb-choice-copy"><strong>${h(a.label)}</strong><small>${h(a.hint)}</small></span>
            <span class="pb-choice-arrow" aria-hidden="true">${audience === a.id ? "✓" : "→"}</span>
          </label>`).join("")}
      </fieldset>

      <fieldset class="pb-tasks-flow">
        <legend>${audience ? "Mis igapäevase toiminguga on praegu kõige raskem?" : "Või valige kohe üks sagedastest olukordadest:"}</legend>
        <div class="pb-task-lines">
          ${taskList.map((t) => `
            <label class="pb-task-choice${task === t.id ? " is-picked" : ""}">
              <input type="radio" name="task" value="${h(t.id)}"${task === t.id ? " checked" : ""}>
              <span>${h(t.label)}</span>
            </label>`).join("")}
          <label class="pb-task-choice${task === UNSURE.id ? " is-picked" : ""}">
            <input type="radio" name="task" value="${UNSURE.id}"${task === UNSURE.id ? " checked" : ""}>
            <span>${h(UNSURE.label)}</span>
          </label>
        </div>
        <p class="pb-footnote">Valikud jäävad ainult teie brauserisse. Neid ei salvestata ega saadeta kuhugi.</p>
      </fieldset>
    </section>

    ${appointmentBook()}

    <section class="pb-chapter" aria-labelledby="pb-ch2">
      <p class="pb-chapter-tag">Esimene kohtumine</p>
      <div class="pb-essay-spread">
        <h2 id="pb-ch2">Rahulik vestlus ja koos proovimine.</h2>
        <div class="pb-essay-body">
          <p><strong>Alustate rääkimisest.</strong> Kirjeldate tavaliste sõnadega, mis kodus, koolis või tööl muret teeb — olgu see riietumine, söömine, kirjutamine või vannitoas liikumine.</p>
          <p><strong>Proovite koos.</strong> Terapeut näitab eri võtteid ja laseb vajadusel abivahendeid proovida. Midagi ei pea esimesel korral kohe ostma.</p>
          <p><strong>Saate selge sammu koju kaasa.</strong> Lepite kokku ühe väikese harjutuse või muudatuse ja otsustate koos, kas on vaja järgmist kohtumist. ${nav("terapeudid", "Vaata terapeute rahastuse järgi")}</p>
        </div>
      </div>
    </section>

    <section class="pb-chapter" aria-labelledby="pb-ch3">
      <p class="pb-chapter-tag">Kus me töötame</p>
      <div class="pb-atlas-spread">
        <div class="pb-atlas-copy">
          <h2 id="pb-ch3">Tegevusterapeudid üle Eesti</h2>
          <p>Valige maakond kaardilt või linnade loetelust. Mõni terapeut võtab vastu mitmes maakonnas ja video teel, seega on piirkondade summa suurem kui terapeutide koguarv (${data.providers.length}).</p>
          <p class="pb-town-index">
            ${TOWNS.map(([label, region]) => {
              const count = data.providers.filter((p) => providerCovers(p, region)).length;
              return `<button type="button" class="pb-town-link" data-action="directory-region" data-value="${h(region)}">${h(label)} <span class="num">(${count})</span></button>`;
            }).join(" · ")}
          </p>
          <p>${btn(`Ava täiskaart ja kõik ${data.providers.length} terapeuti`, "directory-region", "all", "text-button")}</p>
        </div>
        <div class="pb-atlas-map">${estoniaMapSvg("all", { action: "home-region", counts: "all" })}</div>
      </div>
    </section>

    <section class="pb-chapter" aria-labelledby="pb-ch4">
      <p class="pb-chapter-tag">Koolitused</p>
      <div class="pb-chapter-head">
        <div>
          <h2 id="pb-ch4">Koolitused asutustele ja lähedastele</h2>
          <p>Lasteaedadele, koolidele, hooldekodudele ja omastehooldajatele. Asutusele saadame e-arve.</p>
        </div>
        <div class="pb-head-links">
          ${btn("Telli koolitus asutusele (e-arvega)", "training-inquiry", "", "button primary")}
          ${nav("koolituskalender", "Koolituskalender")}
        </div>
      </div>
      <ol class="pb-contents-list">
        ${courses.map((c) => {
          const m = MONTHS[Number(c.date.slice(5, 7)) - 1] ?? "";
          return `<li>
            <button type="button" class="pb-contents-row" data-action="calendar-course" data-value="${h(c.id)}">
              <span class="pb-contents-date"><em>${Number(c.date.slice(8, 10))}. ${m}</em></span>
              <span class="pb-contents-main"><strong>${h(c.title)}</strong><span>${h(c.place)} · ${plural(c.seats, "vaba koht", "vaba kohta")}</span></span>
              <span class="pb-contents-right"><span class="pb-contents-price num">${c.cents ? euro(c.cents) : "Tasuta"}</span><span class="pb-row-cue">Vaata →</span></span>
            </button>
          </li>`;
        }).join("")}
      </ol>
    </section>

    <section class="pb-chapter" aria-labelledby="pb-ch5">
      <p class="pb-chapter-tag">Abivahendid</p>
      <div class="pb-chapter-head">
        <div>
          <h2 id="pb-ch5">Terapeutide valitud abivahendid ja prinditavad lehed</h2>
          <p>Iga vahendi juures on kirjas, miks seda soovitame ja kellele see ei sobi. Midagi ei pea pimesi ostma.</p>
        </div>
        ${nav("e-pood", `Vaata kogu e-poodi (${data.products.length})`, "text-button")}
      </div>
      <div class="pb-aids-cols">
        ${aidsPicks.map((p) => `<article class="pb-aid-entry">
          <div class="pb-aid-top">
            <h3><button type="button" class="text-button pb-aid-name" data-action="open-product" data-value="${h(p.id)}">${h(p.name)}</button></h3>
            <span class="num pb-aid-price">${euro(p.cents)}</span>
          </div>
          <p>${h(p.reason)}${p.digital ? " <em>(Prinditav A4 PDF-leht.)</em>" : ""}</p>
          <div class="pb-aid-links">
            ${btn("Lisa ostukorvi", "add-product", p.id, "text-button")}
            ${btn("Loe sobivusest", "open-product", p.id, "text-button")}
          </div>
        </article>`).join("")}
      </div>
    </section>

    <section class="pb-invitation" aria-labelledby="pb-join">
      <div>
        <h2 id="pb-join">Kas töötate tegevusterapeudina?</h2>
        <p>Kinnitage oma isik Smart-ID või Mobiil-ID-ga. Seejärel saate avaldada oma vastuvõtuajad ja koolitused Eesti kaardil — ilma vahendustasuta ja selgete tingimustega.</p>
      </div>
      ${nav("spetsialistile", "Liitu spetsialistina →", "button primary")}
    </section>
  </div>`;
}
