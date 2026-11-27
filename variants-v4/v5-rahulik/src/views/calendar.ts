import { TRAINING_AUDIENCES, type Course } from "../data/catalog";
import { coursePhotoFor, portrait } from "../data/photos";
import { data, store } from "../model";
import { btn, euro, fullDate, h, pageHead } from "../ui";

const monthName = new Intl.DateTimeFormat("et-EE", { month: "long", year: "numeric", timeZone: "UTC" });
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("et") + text.slice(1);
const MONTH_GENITIVE = ["jaanuari", "veebruari", "märtsi", "aprilli", "mai", "juuni", "juuli", "augusti", "septembri", "oktoobri", "novembri", "detsembri"];
const WEEKDAYS = ["P", "E", "T", "K", "N", "R", "L"];
const MONTHS = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];
const startTime = (course: Course) => course.time.split(/[–-]/)[0]?.trim() ?? "";
const seatsText = (seats: number) => seats ? `${seats} ${seats === 1 ? "vaba koht" : "vaba kohta"}` : "Vabu kohti ei ole";

export function courseDetail(course: Course): string {
  const teacher = data.providers.find((person) => person.name === course.teacher);
  return `<img class="photo course-photo" src="${coursePhotoFor(course)}" alt="" width="800" height="450">
  <div class="course-detail">
    <h2>${h(course.title)}</h2>
    <p class="course-type">${h(course.audience)} · ${course.county ? "Kohapeal" : "Veebis"}</p>
    <p>${h(course.description)}</p>
    <div class="teacher">${portrait(teacher ?? { id: course.teacher, name: course.teacher }, 48)}<div><span>Koolitaja</span><strong>${h(course.teacher)}</strong></div></div>
    <dl class="detail-list">
      <div><dt>Kuupäev</dt><dd class="num">${fullDate(course.date)}</dd></div>
      <div><dt>Kellaaeg</dt><dd class="num">${h(course.time)}</dd></div>
      <div><dt>Toimumiskoht</dt><dd>${h(course.place)}</dd></div>
      <div><dt>Koolituse maht</dt><dd class="num">${course.hours} ak/h</dd></div>
      <div><dt>EHIS</dt><dd>${h(course.ehis)}</dd></div>
    </dl>
    <div class="course-price"><strong class="num">${course.cents ? euro(course.cents) : "Tasuta"}</strong><span class="num">${seatsText(course.seats)}</span></div>
    ${course.seats ? btn("Registreeru koolitusele", "register", course.id, "button primary full") : ""}
    ${btn("Telli see koolitus oma asutusele (e-arvega)", "training-inquiry", "", "button secondary full")}
  </div>`;
}

function agendaRow(course: Course, active: boolean): string {
  const weekday = WEEKDAYS[new Date(`${course.date}T12:00Z`).getUTCDay()] ?? "";
  return `<button type="button" class="overview-course" data-action="agenda-course" data-value="${h(course.id)}" aria-pressed="${active}"
    aria-label="${h(`${course.title}, ${fullDate(course.date)}, ${course.place}`)}">
    <span class="overview-date num"><b>${Number(course.date.slice(8, 10))}</b><span>${MONTHS[Number(course.date.slice(5, 7)) - 1] ?? ""}</span></span>
    <span class="overview-course-text"><strong>${h(course.title)}</strong><span class="num">${weekday} ${h(course.time)} · ${h(course.place)} · ${seatsText(course.seats)}</span></span>
    <span class="overview-price num">${course.cents ? euro(course.cents) : "Tasuta"}</span>
  </button>`;
}

export function calendarView(): string {
  const { month, audience, selected } = store.calendar;
  const courses = data.courses.filter((course) => course.date.startsWith(month) && (audience === "Kõik" || course.audience === audience))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const active = courses.find((course) => course.id === selected) ?? courses[0];
  const date = new Date(`${month}-01T12:00Z`);
  const monthLabel = capitalize(monthName.format(date));
  const genitive = capitalize(MONTH_GENITIVE[date.getUTCMonth()] ?? "");
  const firstDay = (date.getUTCDay() + 6) % 7;
  const monthDays = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((monthDays + firstDay) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, index) => {
    const cell = new Date(date);
    cell.setUTCDate(index - firstDay + 1);
    const iso = cell.toISOString().slice(0, 10);
    const events = courses.filter((course) => course.date === iso);
    const inMonth = iso.startsWith(month);
    return `<div class="calendar-cell ${inMonth ? "" : "outside"} ${active?.date === iso ? "active-day" : ""}" role="cell">
      <time datetime="${iso}" aria-label="${fullDate(iso)}">${cell.getUTCDate()}</time>
      ${events.map((course) => `<button type="button" class="calendar-event ${course.county ? "physical" : "online"}" data-action="select-course" data-value="${h(course.id)}" aria-pressed="${course.id === active?.id}"
      aria-label="${h(`${course.title}, ${fullDate(iso)}`)}" title="${h(course.title)}"><span>${h(course.short)}</span><span class="compact-event" aria-hidden="true">${h(course.compact ?? course.short)}</span><small>${h(startTime(course))}</small></button>`).join("")}
    </div>`;
  });
  return `<section class="page calendar-page has-band">
    <div class="wrap">
    ${pageHead("Koolituskalender", "Leidke praktiline koolitus Eesti eri paigus või veebis.", btn("Telli koolitus oma asutusele (e-arvega)", "training-inquiry"))}
    <div class="segmented" role="group" aria-label="Koolituse sihtrühm">${TRAINING_AUDIENCES.map((value) =>
      `<button type="button" data-action="training-audience" data-value="${h(value)}" aria-pressed="${audience === value}">${h(value)}</button>`).join("")}</div>
    <div class="calendar-layout">
      <section class="calendar" aria-labelledby="month-title">
        <div class="calendar-top">
          <div><h2 id="month-title">${h(monthLabel)}</h2><p>${courses.length} ${courses.length === 1 ? "koolitus" : "koolitust"}</p></div>
          <div class="month-actions">
            <button type="button" class="button secondary small" data-action="month" data-value="-1" aria-label="Eelmine kuu">Eelmine</button>
            <button type="button" class="button secondary small" data-action="month" data-value="1" aria-label="Järgmine kuu">Järgmine</button>
          </div>
        </div>
        <div role="table" aria-label="${h(monthLabel)}">
          <div class="calendar-grid weekdays" role="row">${["E","T","K","N","R","L","P"].map((day) => `<span role="columnheader">${day}</span>`).join("")}</div>
          ${Array.from({ length: cellCount / 7 }, (_, week) => `<div class="calendar-grid calendar-row" role="row">${days.slice(week * 7, week * 7 + 7).join("")}</div>`).join("")}
        </div>
        <div class="calendar-legend"><span><i></i> Kohapeal</span><span><i></i> Veebis</span></div>
        <div class="agenda">
          <h3>${h(genitive)} koolitused</h3>
          ${courses.length ? courses.map((course) => agendaRow(course, course.id === active?.id)).join("") : '<p class="result-empty">Sel kuul selle sihtrühma koolitusi ei ole.</p>'}
        </div>
      </section>
      <section class="calendar-detail" id="calendar-detail" tabindex="-1" aria-label="Koolituse üksikasjad">${active ? courseDetail(active) : "<h2>Praegu ei ole siin sobivat koolitust.</h2><p>Valige teine kuu või sihtrühm.</p>"}</section>
    </div>
    </div>
    <section class="band band-oat page-band" aria-labelledby="house-title"><div class="wrap band-cta">
      <div><h2 id="house-title">Koolitus teie majas</h2><p>Tuleme teie lasteaeda, kooli või hooldekodusse. Arve saadame e-arvena teie asutuse registrikoodi alusel.</p></div>
      ${btn("Telli koolitus oma asutusele (e-arvega)", "training-inquiry", "", "button primary")}
    </div></section>
  </section>`;
}
