// PROTOTYPE Variant C · Nädalaplaan (Live Estonian Clinic Timetable Board)
// Tradition: Elron / Estonian clinic duty schedule. Entry by WHEN can I go.
import { AUDIENCES, NEEDS_FITTING, SKA_AIDS_URL, TASKS, TOOL_TRY_NOTE, UNSURE, tasksFor } from "../data/finder";
import type { Product } from "../data/catalog";
import { findPlace } from "../data/places";
import {
  data, finderMatches, FORMATS, helpline, live, providerCovers,
  selectedFinderSlots, store, today, upcomingCourses, type DirectoryProvider, type Region, type VisitSlot,
} from "../model";
import { btn, euro, fullDate, h, nav, option } from "../ui";
import { estoniaMapSvg } from "./directory";
import { firstVisitRangeText, helplineDisplay, initialsPlate, priceRangeLabel } from "./prototype-home-a";

const WEEKDAYS = ["P", "E", "T", "K", "N", "R", "L"];
const MONTHS = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];
const MODES = [
  ["all", "Kõik"],
  ["kohal", "Kohapeal"],
  ["kodu", "Koduvisiit"],
  ["video", "Videokõne"],
] as const;
const TOWNS: readonly [string, Region][] = [
  ["Tallinn", "Harjumaa"], ["Tartu", "Tartumaa"], ["Narva", "Ida-Virumaa"], ["Pärnu", "Pärnumaa"],
  ["Viljandi", "Viljandimaa"], ["Rakvere", "Lääne-Virumaa"], ["Kuressaare", "Saaremaa"], ["Videokõne", "video"],
];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const hasLocal = (f: string) => f === "kohal" || f === "kodu";

interface DayColumn {
  iso: string;
  weekday: string;
  label: string;
  tag: string;
  weekend: boolean;
  nearest: boolean;
}

function nextSevenDays(rows: { person: DirectoryProvider; slots: VisitSlot[] }[]): DayColumn[] {
  const todayIso = today();
  const hasTodaySlot = rows.some(({ slots }) => slots.some((s) => s.at.slice(0, 10) === todayIso));
  const start = new Date(`${todayIso}T12:00Z`);
  const offset = hasTodaySlot ? 0 : 1;
  const days: DayColumn[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + offset + i);
    const iso = d.toISOString().slice(0, 10);
    const wd = d.getUTCDay();
    const dayLetter = WEEKDAYS[wd] ?? "";
    const tag = offset === 0 && i === 0 ? "täna" : offset === 1 && i === 0 ? "homme" : "";
    days.push({
      iso,
      weekday: dayLetter,
      label: `${dayLetter} ${iso.slice(8, 10)}.${iso.slice(5, 7)}`,
      tag,
      weekend: wd === 0 || wd === 6,
      nearest: i === 0,
    });
  }
  return days;
}

function boardSlotButton(person: DirectoryProvider, slot: VisitSlot, showDate = false): string {
  const formatShort = slot.format === "video" ? "Video" : slot.format === "kodu" ? "Kodu" : "Kohal";
  const topLabel = showDate
    ? `${slot.at.slice(8, 10)}.${slot.at.slice(5, 7)} · ${slot.at.slice(11, 16)}`
    : slot.at.slice(11, 16);
  return `<button type="button" class="pc-cell-slot" data-action="book" data-value="${h(slot.id)}"
    aria-label="Broneeri ${h(person.name)}, ${fullDate(slot.at)} kell ${slot.at.slice(11, 16)}, ${FORMATS[slot.format]}, ${euro(slot.cents)}">
    <span class="pc-cell-time num">${topLabel}</span>
    <span class="pc-cell-meta num">${formatShort} · ${euro(slot.cents)}</span>
  </button>`;
}

function boardProviders(): { person: DirectoryProvider; slots: VisitSlot[] }[] {
  const { audience, task } = store.finder;
  const list = task
    ? finderMatches().providers
    : audience
      ? data.providers.filter((p) => p.audiences.includes(audience))
      : data.providers;
  return list
    .map((person) => ({ person, slots: selectedFinderSlots(person) }))
    .filter(({ slots, person }) => slots.length > 0 || Boolean(task) || Boolean(audience) || Boolean(person.contact?.phone))
    .sort((a, b) => (a.slots[0]?.at ?? "9999").localeCompare(b.slots[0]?.at ?? "9999") || a.person.name.localeCompare(b.person.name, "et"));
}

function desktopBoard(days: DayColumn[], rows: { person: DirectoryProvider; slots: VisitSlot[] }[], isUnsure: boolean): string {
  if (store.availability === "loading") return `<p class="pc-state">Laadime vabu aegu.</p>`;
  if (store.availability === "stale") return `<p class="pc-state">Vabu aegu ei õnnestunud laadida. ${btn("Proovi uuesti", "retry-public", "", "text-button")}</p>`;
  if (!rows.length) {
    return `<div class="pc-state">
      <p>Valitud filtritega vabu aegu sel nädalal ei leidu.</p>
      <p>${btn("Tühjenda filtrid", "finder-reset", "", "text-button")} · ${btn("Ava kõik terapeudid kaardil", "directory-region", "all", "text-button")}</p>
    </div>`;
  }

  return `<div class="pc-board-desktop">
    <table class="pc-grid-table">
      <thead>
        <tr>
          <th class="pc-th-who">Terapeut ja asukoht</th>
          ${days.map((d) => `<th class="pc-th-day num${d.nearest ? " is-nearest" : ""}${d.weekend ? " is-weekend" : ""}">${h(d.label)}${d.tag ? `<span class="pc-day-tag">${h(d.tag)}</span>` : ""}</th>`).join("")}
          <th class="pc-th-more num">Hilisem</th>
        </tr>
      </thead>
      <tbody>
        ${isUnsure && helpline ? `<tr class="pc-helpline-row">
          <td colspan="${days.length + 2}">
            <strong>Ei tea, millist terapeuti valida?</strong> Helistage nõuandeliinile <strong>${helplineDisplay()}</strong> (E–R 9–17) ja leiame esimese sammu koos.
          </td>
        </tr>` : ""}
        ${rows.slice(0, 7).map(({ person, slots }) => {
          const dayMap = new Map<string, VisitSlot[]>();
          const later: VisitSlot[] = [];
          const daySet = new Set(days.map((d) => d.iso));
          for (const slot of slots) {
            const d = slot.at.slice(0, 10);
            if (daySet.has(d)) {
              const arr = dayMap.get(d) ?? [];
              arr.push(slot);
              dayMap.set(d, arr);
            } else {
              later.push(slot);
            }
          }
          const nextLater = later[0];
          return `<tr>
            <th scope="row" class="pc-td-who">
              <div class="pc-who-wrap">
                ${initialsPlate(person)}
                <div>
                  <strong>${h(person.name)}</strong>
                  <span class="pc-who-sub">${h(person.city)} · <span class="num">${priceRangeLabel(person, slots)}</span> · <span class="num">${person.visit.minutes} min</span></span>
                </div>
              </div>
            </th>
            ${days.map((d) => {
              const cellSlots = dayMap.get(d.iso) ?? [];
              return `<td class="pc-td-day${d.nearest ? " is-nearest" : ""}${d.weekend ? " is-weekend" : ""}">
                ${cellSlots.length ? cellSlots.map((s) => boardSlotButton(person, s)).join("") : `<span class="pc-dash" aria-hidden="true">—</span>`}
              </td>`;
            }).join("")}
            <td class="pc-td-more">
              ${nextLater
                ? boardSlotButton(person, nextLater, true)
                : slots.length === 0 && person.contact?.phone
                  ? btn("Kontakt", "provider-contact", person.id, "text-button")
                  : `<span class="pc-dash" aria-hidden="true">—</span>`}
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    ${rows.length > 7 ? `<p class="pc-board-foot">Kuvatud 7 lähima ajaga terapeuti (${rows.length}-st). ${btn("Näita kõiki terapeute kaardil →", "directory-region", "all", "text-button")}</p>` : ""}
  </div>`;
}

function mobileDayList(rows: { person: DirectoryProvider; slots: VisitSlot[] }[], isUnsure: boolean): string {
  if (store.availability === "loading") return `<div class="pc-board-mobile"><p class="pc-state">Laadime vabu aegu.</p></div>`;
  if (store.availability === "stale") {
    return `<div class="pc-board-mobile"><p class="pc-state">Vabu aegu ei õnnestunud laadida. ${btn("Proovi uuesti", "retry-public", "", "text-button")}</p></div>`;
  }

  // Group ALL bookable slots chronologically by date so desktop & mobile show identical availability.
  const byDay = new Map<string, { person: DirectoryProvider; slot: VisitSlot }[]>();
  for (const { person, slots } of rows) {
    for (const slot of slots) {
      const iso = slot.at.slice(0, 10);
      const list = byDay.get(iso) ?? [];
      list.push({ person, slot });
      byDay.set(iso, list);
    }
  }
  const orderedDays = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const todayIso = today();

  return `<div class="pc-board-mobile">
    ${isUnsure && helpline ? `<p class="pc-mobile-help">Ei tea, keda valida? Helistage <strong>${helplineDisplay()}</strong> (E–R 9–17).</p>` : ""}
    ${orderedDays.length ? orderedDays.map(([iso, entries], idx) => {
      const d = new Date(`${iso}T12:00Z`);
      const wd = WEEKDAYS[d.getUTCDay()] ?? "";
      const tag = iso === todayIso ? " · täna" : idx === 0 ? " · lähim päev" : "";
      entries.sort((a, b) => a.slot.at.localeCompare(b.slot.at));
      return `<section class="pc-day-group${idx === 0 ? " is-nearest" : ""}">
        <h3 class="pc-day-head num">${wd} ${iso.slice(8, 10)}.${iso.slice(5, 7)}${tag} <span>${plural(entries.length, "vaba aeg", "vaba aega")}</span></h3>
        <ul class="pc-day-items">
          ${entries.map(({ person, slot }) => `<li>
            <div class="pc-m-who">
              <strong>${h(person.name)}</strong>
              <span>${h(person.city)} · ${FORMATS[slot.format]} · <span class="num">${euro(slot.cents)}</span> · <span class="num">${slot.minutes} min</span></span>
            </div>
            <button type="button" class="pc-m-slot num" data-action="book" data-value="${h(slot.id)}"
              aria-label="Broneeri ${h(person.name)}, ${fullDate(slot.at)} kell ${slot.at.slice(11, 16)}, ${FORMATS[slot.format]}, ${euro(slot.cents)}">${slot.at.slice(11, 16)}</button>
          </li>`).join("")}
        </ul>
      </section>`;
    }).join("") : `<p class="pc-state">Valitud filtritega vabu aegu ei leidu. ${btn("Tühjenda filtrid", "finder-reset", "", "text-button")}</p>`}
  </div>`;
}

export function renderVariantCResults(): string {
  const { task } = store.finder;
  const rows = boardProviders();
  const days = nextSevenDays(rows);
  const matched = task ? finderMatches() : undefined;
  const taskObj = matched?.task;
  const videoBlocked = taskObj && "videoOk" in taskObj && taskObj.videoOk === false;
  const isUnsure = task === UNSURE.id;

  return `${videoBlocked ? `<p class="pc-alert">Valitud toimingu puhul peab terapeut nägema ruumi või liikumist kohapeal — videokõnet selleks ei pakuta.</p>` : ""}
    ${matched ? `<p class="pc-guidance" id="wizard-preview-title" tabindex="-1"><strong>Mida tegevusterapeut teiega teeb:</strong> ${h(matched.task.result)}</p>` : `<span id="wizard-preview-title" class="visually-hidden" tabindex="-1">Nädalaplaan</span>`}
    <section class="pc-board-wrap" aria-label="Nädala vabad ajad">
      <p class="pc-board-note">${live ? "Kõigil loetletud terapeutidel on isik kinnitatud ja kehtiv kutsetunnistus Kutseregistrist." : "Näidisandmed · tegelikul lehel on terapeudi isik kinnitatud Smart-ID/Mobiil-ID-ga ja kutse kontrollitud Kutseregistrist. Iga aja juures on selle kohtumisviisi täpne hind."}</p>
      ${desktopBoard(days, rows, isUnsure)}
      ${mobileDayList(rows, isUnsure)}
    </section>`;
}

export function renderVariantC(): string {
  const { audience, task, format, place } = store.finder;
  const taskList = audience ? tasksFor(audience) : TASKS;
  const matched = task ? finderMatches() : undefined;
  const courses = upcomingCourses().slice(0, 4);
  const aidsPicks = (matched
    ? matched.task.tools.map((name) => data.products.find((p) => p.name === name)).filter((p): p is Product => Boolean(p))
    : ["jame-pliiats", "libisemiskindel-lauamatt", "piltidega-paevakava"].map((id) => data.products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p))
  ).slice(0, 3);

  return `<div class="wrap proto-c">
    <header class="pc-top">
      <div>
        <p class="pc-kicker">Tegevusteraapia Keskus · Asutajad: tegevusterapeudid Terje ja Kristel</p>
        <h1 id="page-title" tabindex="-1">Vabad ajad tegevusterapeudi juurde</h1>
        <p class="pc-sub">Valige sobiv aeg otse ajakavast või kitsendage filtriga.</p>
      </div>
      <p class="pc-meta-strip">
        <span class="num">${h(firstVisitRangeText())}</span>
        <span>Tasulisele vastuvõtule saatekirjata</span>
        ${helpline ? `<span>Nõu E–R 9–17: ${helplineDisplay()}</span>` : ""}
      </p>
    </header>

    <section class="pc-filter-bar" aria-label="Vastuvõtuaegade filter">
      <div class="pc-filter-line">
        <label class="pc-sel">
          <span>Kellele</span>
          <select name="audience" data-proto-select="audience">
            ${option("", "Kõik sihtrühmad", audience)}
            ${AUDIENCES.map((a) => option(a.id, a.label, audience)).join("")}
          </select>
        </label>
        <label class="pc-sel pc-sel-wide">
          <span>Mis on raske</span>
          <select name="task" data-proto-select="task">
            ${option("", "Kõik tegevused", task)}
            ${taskList.map((t) => option(t.id, t.label, task)).join("")}
            ${option(UNSURE.id, UNSURE.label, task)}
          </select>
        </label>
        <div class="pc-modes" role="radiogroup" aria-label="Kohtumisviis">
          ${MODES.map(([id, label]) => `
            <label class="pc-mode">
              <input type="radio" name="format" value="${id}"${(format || "all") === id ? " checked" : ""}>
              <span>${label}</span>
            </label>`).join("")}
        </div>
        <div class="pc-place"${hasLocal(format) ? "" : " hidden"}>
          <label for="wizard-place" class="visually-hidden">Linn või vald</label>
          <input type="search" id="wizard-place" value="${h(place)}" list="wizard-places" autocomplete="off" placeholder="Linn või vald (nt Tartu)" maxlength="80">
          <datalist id="wizard-places"></datalist>
        </div>
        ${audience || task || (format && format !== "all") || place ? `<button type="button" class="text-button pc-reset" data-action="finder-reset">Lähtesta</button>` : ""}
      </div>
      <p class="pc-privacy">Filtrid töötavad ainult teie brauseris — valikuid ei salvestata ega saadeta kuhugi. <strong id="wizard-place-hint"${place.trim() && !findPlace(place) ? "" : " hidden"}>Valige loendist linn või vald.</strong></p>
    </section>

    <div data-proto-results>${renderVariantCResults()}</div>

    <section class="pc-back-spread">
      <aside class="pc-pinned-note" aria-labelledby="pc-first-title">
        <h2 id="pc-first-title">Esimesel korral</h2>
        <p>Räägite tavaliste sõnadega, mis on igapäevaselt raske — diagnoosi ei pea teadma. Proovite terapeudiga koos eri võtteid ja vahendeid ning lepite kokku ühe selge sammu koduks. ${nav("terapeudid", "Rahastus ja saatekiri")}</p>
      </aside>
      <div class="pc-compact-map" aria-labelledby="pc-where-title">
        <div class="pc-where-head">
          <div>
            <h2 id="pc-where-title">Kus terapeudid töötavad</h2>
            <p class="pc-where-sub">Mõni terapeut töötab mitmes maakonnas või video teel (kokku ${data.providers.length} terapeuti).</p>
          </div>
          ${btn(`Ava täiskaart (${data.providers.length})`, "directory-region", "all", "text-button")}
        </div>
        <div class="pc-where-grid">
          <div class="pc-map-box">${estoniaMapSvg("all", { action: "home-region", counts: "all" })}</div>
          <ul class="pc-town-list">
            ${TOWNS.map(([label, region]) => {
              const count = data.providers.filter((p) => providerCovers(p, region)).length;
              return `<li><button type="button" data-action="directory-region" data-value="${h(region)}"><span>${h(label)}</span><strong class="num">${count}</strong></button></li>`;
            }).join("")}
          </ul>
        </div>
      </div>
    </section>

    <section class="pc-table-section" aria-labelledby="pc-courses-title">
      <div class="pc-sec-head">
        <h2 id="pc-courses-title">Koolitused asutustele ja lähedastele</h2>
        <div class="pc-sec-act">
          ${btn("Telli koolitus asutusele (e-arvega)", "training-inquiry", "", "button primary")}
          ${nav("koolituskalender", "Koolituskalender")}
        </div>
      </div>
      <table class="pc-mini-table pa-table-stack">
        <thead><tr><th>Kuupäev</th><th>Koolitus</th><th>Koht ja kohad</th><th class="num">Hind</th><th></th></tr></thead>
        <tbody>
          ${courses.map((c) => {
            const m = MONTHS[Number(c.date.slice(5, 7)) - 1] ?? "";
            return `<tr>
              <td data-col="Kuupäev" class="pa-td-date"><strong>${Number(c.date.slice(8, 10))}. ${m}</strong></td>
              <td data-col="Koolitus"><strong>${h(c.title)}</strong></td>
              <td data-col="Koht">${h(c.place)} · <span class="num">${plural(c.seats, "koht", "kohta")}</span></td>
              <td data-col="Hind" class="num">${c.cents ? euro(c.cents) : "Tasuta"}</td>
              <td class="pc-td-act">${btn("Vaata", "calendar-course", c.id, "text-button")}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </section>

    <section class="pc-table-section" aria-labelledby="pc-aids-title">
      <div class="pc-sec-head">
        <h2 id="pc-aids-title">${matched ? "Valikule vastavad abivahendid" : "Igapäevased abivahendid"}</h2>
        ${nav("e-pood", `Kogu e-pood (${data.products.length})`, "text-button")}
      </div>
      <ul class="pc-aids-rows">
        ${aidsPicks.map((p) => `<li>
          <div><strong><button type="button" class="text-button pc-aid-btn" data-action="open-product" data-value="${h(p.id)}">${h(p.name)}</button></strong><span>${h(p.reason)}</span></div>
          <div class="pc-aid-right"><span class="num">${euro(p.cents)}</span>${btn("Lisa ostukorvi", "add-product", p.id, "button secondary small")}</div>
        </li>`).join("")}
        ${matched ? matched.task.tools.filter((name) => NEEDS_FITTING.has(name)).map((name) => `<li>
          <div><strong>${h(name)}</strong><span>Küsige terapeudilt sobivuse ja paigalduse kohta.</span></div>
          <div class="pc-aid-right"><span class="pc-micro">Terapeudiga</span></div>
        </li>`).join("") : ""}
      </ul>
      <p class="pc-privacy">${h(TOOL_TRY_NOTE)} <a class="text-link" href="${SKA_AIDS_URL}" target="_blank" rel="noreferrer">Kuidas saada vahendit soodsamalt?</a></p>
    </section>

    <section class="pc-supply-bar" aria-label="Asutajad ja spetsialistile">
      <p><strong>Tegevusteraapia Keskus</strong> — asutasid tegevusterapeudid Terje ja Kristel.</p>
      <p>Olete tegevusterapeut? ${nav("spetsialistile", "Avaldage oma vabad ajad siin ajakavas (Smart-ID / Mobiil-ID) →", "pc-supply-cta")}</p>
    </section>
  </div>`;
}
