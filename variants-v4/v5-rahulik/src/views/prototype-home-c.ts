// PROTOTYPE Variant C · Nädalaplaan (Morning Chalk, Sand & Washed Slate — Calm Open Week)
// Entry by WHEN can I go: soft day-pebble strip + unified borderless chronological day-by-day lanes (zero spreadsheet table!).
import { AUDIENCES, NEEDS_FITTING, SKA_AIDS_URL, TASKS, TOOL_TRY_NOTE, UNSURE, tasksFor } from "../data/finder";
import type { Product } from "../data/catalog";
import { findPlace } from "../data/places";
import {
  data, finderMatches, FORMATS, helpline, providerCovers,
  selectedFinderSlots, store, today, upcomingCourses, type DirectoryProvider, type Region, type VisitSlot,
} from "../model";
import { btn, euro, fullDate, h, nav, option } from "../ui";
import { estoniaMapSvg } from "./directory";
import {
  demoDisclosureText, emptyResultsMessage, firstVisitRangeText, helplineDisplay,
  initialsPlate, priceRangeLabel, providerMatchesFormatAndPlace,
} from "./prototype-home-a";

const WEEKDAYS_FULL = ["Pühapäev", "Esmaspäev", "Teisipäev", "Kolmapäev", "Neljapäev", "Reede", "Laupäev"];
const WEEKDAYS_SHORT = ["P", "E", "T", "K", "N", "R", "L"];
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

interface DayPebble {
  iso: string;
  shortWd: string;
  dateShort: string;
  fullLabel: string;
  tag: string;
  slotCount: number;
  nearest: boolean;
}

interface DayEntry {
  person: DirectoryProvider;
  slots: VisitSlot[];
}

interface DaySection {
  iso: string;
  weekday: string;
  dateLabel: string;
  tag: string;
  totalSlots: number;
  providers: DayEntry[];
}

function boardProviders(): { person: DirectoryProvider; slots: VisitSlot[] }[] {
  const { audience, task } = store.finder;
  const list = task
    ? finderMatches().providers
    : data.providers.filter((p) => (!audience || p.audiences.includes(audience)) && providerMatchesFormatAndPlace(p));
  return list
    .map((person) => ({ person, slots: selectedFinderSlots(person) }))
    .filter(({ slots, person }) => slots.length > 0 || Boolean(person.contact?.phone))
    .sort((a, b) => (a.slots[0]?.at ?? "9999").localeCompare(b.slots[0]?.at ?? "9999") || a.person.name.localeCompare(b.person.name, "et"));
}

function groupByChronologicalDay(rows: { person: DirectoryProvider; slots: VisitSlot[] }[]): DaySection[] {
  const byDay = new Map<string, Map<string, DayEntry>>();
  for (const { person, slots } of rows) {
    for (const slot of slots) {
      const iso = slot.at.slice(0, 10);
      let dayMap = byDay.get(iso);
      if (!dayMap) {
        dayMap = new Map();
        byDay.set(iso, dayMap);
      }
      let entry = dayMap.get(person.id);
      if (!entry) {
        entry = { person, slots: [] };
        dayMap.set(person.id, entry);
      }
      entry.slots.push(slot);
    }
  }

  const todayIso = today();
  const ordered = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return ordered.map(([iso, dayMap], idx) => {
    const d = new Date(`${iso}T12:00Z`);
    const wd = WEEKDAYS_FULL[d.getUTCDay()] ?? "";
    const month = MONTHS[Number(iso.slice(5, 7)) - 1] ?? "";
    const dateLabel = `${Number(iso.slice(8, 10))}. ${month}`;
    const providers = [...dayMap.values()].map((e) => ({
      person: e.person,
      slots: [...e.slots].sort((a, b) => a.at.localeCompare(b.at)),
    })).sort((a, b) => (a.slots[0]?.at ?? "").localeCompare(b.slots[0]?.at ?? ""));
    const totalSlots = providers.reduce((sum, e) => sum + e.slots.length, 0);
    const tag = iso === todayIso ? "Täna" : idx === 0 ? "Lähim päev" : "";
    return { iso, weekday: wd, dateLabel, tag, totalSlots, providers };
  });
}

function buildWeekPebbles(days: DaySection[]): { pebbles: DayPebble[]; laterCount: number } {
  const todayIso = today();
  const countByIso = new Map(days.map((d) => [d.iso, d.totalSlots]));
  const hasTodaySlot = (countByIso.get(todayIso) ?? 0) > 0;
  const start = new Date(`${todayIso}T12:00Z`);
  const offset = hasTodaySlot ? 0 : 1;
  const firstOpenIso = days[0]?.iso ?? "";

  const pebbles: DayPebble[] = [];
  const weekSet = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + offset + i);
    const iso = d.toISOString().slice(0, 10);
    weekSet.add(iso);
    const wd = d.getUTCDay();
    const month = MONTHS[Number(iso.slice(5, 7)) - 1] ?? "";
    const slotCount = countByIso.get(iso) ?? 0;
    const tag = iso === todayIso ? "täna" : offset === 1 && i === 0 ? "homme" : "";
    pebbles.push({
      iso,
      shortWd: WEEKDAYS_SHORT[wd] ?? "",
      dateShort: `${Number(iso.slice(8, 10))}. ${month}`,
      fullLabel: `${WEEKDAYS_FULL[wd] ?? ""}, ${Number(iso.slice(8, 10))}. ${month}`,
      tag,
      slotCount,
      nearest: iso === firstOpenIso,
    });
  }
  const laterCount = days.filter((d) => !weekSet.has(d.iso)).reduce((sum, d) => sum + d.totalSlots, 0);
  return { pebbles, laterCount };
}

function timePill(person: DirectoryProvider, slot: VisitSlot): string {
  const formatShort = slot.format === "video" ? "Video" : slot.format === "kodu" ? "Koduvisiit" : "Kohapeal";
  const dotClass = slot.format === "kodu" ? "is-kodu" : slot.format === "video" ? "is-video" : "is-kohal";
  return `<button type="button" class="pc-time-pill" data-action="book" data-value="${h(slot.id)}"
    aria-label="Broneeri ${h(person.name)}, ${fullDate(slot.at)} kell ${slot.at.slice(11, 16)}, ${FORMATS[slot.format]}, ${euro(slot.cents)}">
    <span class="pc-pill-dot ${dotClass}" aria-hidden="true"></span>
    <span class="pc-pill-time num">${slot.at.slice(11, 16)}</span>
    <span class="pc-pill-meta">${formatShort} · <span class="num">${euro(slot.cents)}</span></span>
  </button>`;
}

export function renderVariantCResults(selectedDay = ""): string {
  const { task } = store.finder;
  const rows = boardProviders();
  const allDays = groupByChronologicalDay(rows);
  const { pebbles, laterCount } = buildWeekPebbles(allDays);
  const weekIsoSet = new Set(pebbles.map((p) => p.iso));
  const totalSlotsAll = allDays.reduce((sum, d) => sum + d.totalSlots, 0);

  const matched = task ? finderMatches() : undefined;
  const taskObj = matched?.task;
  const videoBlocked = taskObj && "videoOk" in taskObj && taskObj.videoOk === false;
  const isUnsure = task === UNSURE.id;

  const visibleDays = selectedDay === "later"
    ? allDays.filter((d) => !weekIsoSet.has(d.iso))
    : selectedDay
      ? allDays.filter((d) => d.iso === selectedDay)
      : allDays;

  const contactOnly = rows.filter((r) => r.slots.length === 0 && r.person.contact?.phone);

  let agendaHtml = "";
  if (store.availability === "loading") {
    agendaHtml = `<p class="pc-state">Laadime vabu aegu.</p>`;
  } else if (store.availability === "stale") {
    agendaHtml = `<p class="pc-state">Vabu aegu ei õnnestunud laadida. ${btn("Proovi uuesti", "retry-public", "", "text-button")}</p>`;
  } else if (!allDays.length) {
    agendaHtml = `<div class="pc-state">
      <p>${h(emptyResultsMessage())}</p>
      <p>${btn("Tühjenda filtrid", "finder-reset", "", "text-button")} · ${btn("Ava kõik terapeudid kaardil", "directory-region", "all", "text-button")}</p>
    </div>`;
  } else if (!visibleDays.length) {
    const nearest = allDays[0]!;
    agendaHtml = `<div class="pc-state">
      <p>Sel päeval vabu aegu pole — lähim vaba aeg on <strong>${h(nearest.weekday.toLocaleLowerCase("et"))}, ${h(nearest.dateLabel)}</strong>.</p>
      <p><button type="button" class="button secondary small" data-proto-day="${h(nearest.iso)}">Mine päevale ${h(nearest.dateLabel)}</button> <button type="button" class="text-button" data-proto-day="all">Näita kõiki päevi</button></p>
    </div>`;
  } else {
    agendaHtml = `<div class="pc-agenda">
      ${visibleDays.map((day) => `<section class="pc-day-group${day.tag ? " is-nearest" : ""}" data-day-iso="${h(day.iso)}">
        <header class="pc-day-head">
          <div class="pc-day-title-wrap">
            <h3>${h(day.weekday)}, <span class="num">${h(day.dateLabel)}</span></h3>
            ${day.tag ? `<span class="pc-nearest-pill">${h(day.tag)}</span>` : ""}
          </div>
          <span class="pc-day-count num">${plural(day.totalSlots, "vaba aeg", "vaba aega")}</span>
        </header>
        <ul class="pc-day-items">
          ${day.providers.map(({ person, slots }) => `<li class="pc-lane">
            <div class="pc-lane-who">
              ${initialsPlate(person)}
              <div>
                <strong>${h(person.name)}</strong>
                <span class="pc-lane-sub">${h(person.city)} · <span class="num">${priceRangeLabel(person, slots)}</span> · <span class="num">${person.visit.minutes} min</span></span>
              </div>
            </div>
            <div class="pc-lane-times">
              ${slots.map((s) => timePill(person, s)).join("")}
            </div>
          </li>`).join("")}
        </ul>
      </section>`).join("")}
    </div>`;
  }

  return `${videoBlocked ? `<p class="pc-soft-note pc-note-warm">Valitud toimingu puhul peab terapeut nägema ruumi või liikumist kohapeal — videokõnet selleks ei pakuta.</p>` : ""}
    ${matched ? `<p class="pc-guidance" id="wizard-preview-title" tabindex="-1"><strong>Kuidas tegevusterapeut aitab:</strong> ${h(matched.task.result)}</p>` : `<span id="wizard-preview-title" class="visually-hidden" tabindex="-1">Nädalaplaan</span>`}
    ${isUnsure && helpline ? `<p class="pc-helpline-cushion"><strong>Ei tea, millist terapeuti valida?</strong> Helistage nõuandeliinile <strong>${helplineDisplay()}</strong> (E–R 9–17) ja leiame esimese sammu koos.</p>` : ""}

    <section class="pc-board-wrap" aria-label="Nädala vabad ajad">
      <div class="pc-day-strip" role="group" aria-label="Valige päev">
        <button type="button" class="pc-pebble pc-pebble-all${!selectedDay ? " is-active" : ""}" data-proto-day="all" aria-pressed="${!selectedDay}">
          <span class="pc-pebble-wd">Kõik päevad</span>
          <span class="pc-pebble-count num">${plural(totalSlotsAll, "aeg", "aega")}</span>
        </button>
        ${pebbles.map((p) => {
          const active = selectedDay === p.iso;
          const empty = p.slotCount === 0;
          return `<button type="button" class="pc-pebble${active ? " is-active" : ""}${p.nearest ? " is-nearest" : ""}${empty ? " is-empty" : ""}"
            data-proto-day="${h(p.iso)}" aria-pressed="${active}" aria-label="${h(p.fullLabel)}, ${empty ? "vabu aegu pole" : plural(p.slotCount, "vaba aeg", "vaba aega")}">
            <span class="pc-pebble-wd">${h(p.shortWd)} · ${h(p.dateShort)}</span>
            <span class="pc-pebble-count num">${empty ? "vabu pole" : plural(p.slotCount, "aeg", "aega")}</span>
          </button>`;
        }).join("")}
        ${laterCount > 0 ? `<button type="button" class="pc-pebble${selectedDay === "later" ? " is-active" : ""}" data-proto-day="later" aria-pressed="${selectedDay === "later"}">
          <span class="pc-pebble-wd">Hilisemad</span>
          <span class="pc-pebble-count num">${plural(laterCount, "aeg", "aega")}</span>
        </button>` : ""}
      </div>

      <p class="pc-board-note">${demoDisclosureText()}</p>

      ${agendaHtml}

      ${contactOnly.length && !selectedDay ? `<p class="pc-board-foot">Veel ${plural(contactOnly.length, "terapeut võtab", "terapeuti võtavad")} vastu päringu alusel. ${btn("Vaata kõiki terapeute kaardil →", "directory-region", "all", "text-button")}</p>` : ""}
    </section>`;
}

export function renderVariantC(selectedDay = "", filtersOpenMobile = false): string {
  const { audience, task, format, place } = store.finder;
  const taskList = audience ? tasksFor(audience) : TASKS;
  const matched = task ? finderMatches() : undefined;
  const courses = upcomingCourses().slice(0, 4);
  const aidsPicks = (matched
    ? matched.task.tools.map((name) => data.products.find((p) => p.name === name)).filter((p): p is Product => Boolean(p))
    : ["jame-pliiats", "libisemiskindel-lauamatt", "piltidega-paevakava"].map((id) => data.products.find((p) => p.id === id)).filter((p): p is Product => Boolean(p))
  ).slice(0, 3);

  const activeFilterCount = (audience ? 1 : 0) + (task ? 1 : 0) + (format && format !== "all" ? 1 : 0) + (place.trim() ? 1 : 0);

  return `<div class="wrap proto-c">
    <header class="pc-top">
      <p class="pc-eyebrow">Tegevusteraapia Keskus · Asutajad: tegevusterapeudid Terje ja Kristel</p>
      <h1 id="page-title" tabindex="-1">Vabad ajad tegevusterapeudi juurde</h1>
      <p class="pc-sub">Valige sobiv aeg. Soovi korral saate valikuid täpsustada.</p>
      <p class="pc-meta-line">
        <span class="num">${h(firstVisitRangeText())}</span>
        <span>Tasulisele vastuvõtule ei ole saatekirja vaja</span>
        ${helpline ? `<span>Nõu E–R 9–17: ${helplineDisplay()}</span>` : ""}
      </p>
    </header>

    <div class="pc-mobile-filter-bar">
      <button type="button" class="pc-filter-toggle" data-proto-toggle-filters aria-expanded="${filtersOpenMobile}">
        <span>${filtersOpenMobile ? "Peida valikud" : "Täpsusta valikuid"}${activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
        <span aria-hidden="true">${filtersOpenMobile ? "−" : "+"}</span>
      </button>
      ${activeFilterCount || selectedDay ? `<button type="button" class="text-button" data-action="finder-reset">Lähtesta</button>` : ""}
    </div>

    <section class="pc-filter-pillow${filtersOpenMobile ? " is-open-mobile" : ""}" aria-label="Vastuvõtuaegade filter">
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
        ${activeFilterCount || selectedDay ? `<button type="button" class="text-button pc-reset" data-action="finder-reset">Lähtesta</button>` : ""}
      </div>
      <p class="pc-privacy">Filtrid töötavad ainult teie brauseris — valikuid ei salvestata ega saadeta kuhugi. <strong id="wizard-place-hint"${place.trim() && !findPlace(place) ? "" : " hidden"}>Valige loendist linn või vald.</strong></p>
    </section>

    <div data-proto-results>${renderVariantCResults(selectedDay)}</div>

    <section class="pc-back-spread">
      <aside class="pc-first-cushion" aria-labelledby="pc-first-title">
        <h2 id="pc-first-title">Esimesel kohtumisel</h2>
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
          <div class="pc-map-cushion">${estoniaMapSvg("all", { action: "home-region", counts: "all" })}</div>
          <div class="pc-town-flow">
            ${TOWNS.map(([label, region]) => {
              const count = data.providers.filter((p) => providerCovers(p, region)).length;
              return `<button type="button" class="pc-town-link" data-action="directory-region" data-value="${h(region)}">${h(label)} <span class="num">(${count})</span></button>`;
            }).join("")}
          </div>
        </div>
      </div>
    </section>

    <section class="pc-section" aria-labelledby="pc-courses-title">
      <div class="pc-sec-head">
        <h2 id="pc-courses-title">Koolitused asutustele ja lähedastele</h2>
        <div class="pc-sec-act">
          ${btn("Telli koolitus asutusele (e-arvega)", "training-inquiry", "", "button primary")}
          ${nav("koolituskalender", "Koolituskalender")}
        </div>
      </div>
      <ol class="pc-course-list">
        ${courses.map((c) => {
          const m = MONTHS[Number(c.date.slice(5, 7)) - 1] ?? "";
          return `<li>
            <button type="button" class="pc-course-row" data-action="calendar-course" data-value="${h(c.id)}">
              <span class="pc-course-date num">${Number(c.date.slice(8, 10))}. ${m}</span>
              <span class="pc-course-main"><strong>${h(c.title)}</strong><span>${h(c.place)} · <span class="num">${plural(c.seats, "koht", "kohta")}</span></span></span>
              <span class="pc-course-right"><span class="num">${c.cents ? euro(c.cents) : "Tasuta"}</span><span class="pc-row-go">Vaata →</span></span>
            </button>
          </li>`;
        }).join("")}
      </ol>
    </section>

    <section class="pc-section" aria-labelledby="pc-aids-title">
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

    <section class="pc-supply-cushion" aria-label="Asutajad ja spetsialistile">
      <p><strong>Tegevusteraapia Keskus</strong> — asutasid tegevusterapeudid Terje ja Kristel.</p>
      <p>Olete tegevusterapeut? ${nav("spetsialistile", "Avaldage oma vabad ajad siin nädalaplaanis (Smart-ID / Mobiil-ID) →", "pc-supply-cta")}</p>
    </section>
  </div>`;
}
