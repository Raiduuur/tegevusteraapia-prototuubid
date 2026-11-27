import { TASKS } from "../data/finder";
import { portrait } from "../data/photos";
import { data, FORMATS, live, slotsFor, store, today } from "../model";
import { TRAINING_AUDIENCES } from "../data/catalog";
import { btn, euro, fullDate, h, option, pageHead, shortSlot } from "../ui";
import { providerCard } from "./directory";

export const plans = [
  { id: "baas", label: "Üksikspetsialist", capacity: "1 terapeut", price: "Baas 0 € · Profi 24 €/kuu", features: ["Baas: profiil ja kontaktid Eesti kaardil", "Profi: veebibroneering ja koolituste avaldamine"] },
  { id: "praksis", label: "Väike praksis", capacity: "2–5 terapeuti", price: "69 €/kuu", features: ["Kõik Profi võimalused", "Praksise ühine profiil ja meeskonna kalender"] },
  { id: "kliinik", label: "Suur kliinik", capacity: "6 või enam terapeuti", price: "189 €/kuu", features: ["Kõik praksise võimalused", "Mitme asukoha ja meeskonna haldus"] },
] as const;

const textInput = (name: string, title: string, extra = "") => `<label>${title}<input name="${name}" ${extra} required></label>`;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function dashboard(): string {
  const staff = store.staff;
  if (!staff) return "";
  const person = staff.provider;
  const slots = slotsFor(person.id);
  const courses = data.courses.filter((event) => event.teacher === person.name).sort((a,b) => a.date.localeCompare(b.date));
  return `<section class="page wrap">
    ${pageHead("Spetsialisti töölaud", `Tere, ${staff.name}. Siit saate lisada vastuvõtuaegu ja koolitusi.`, btn("Logi välja", "logout"))}
    <div class="staff-strip">
      ${portrait(person, 72)}
      <div>
        <h2>${h(person.name)}</h2>
        <p>Tegevusterapeut · ${h(person.city)}</p>
        <p class="num">${plural(slots.length, "avaldatud aeg", "avaldatud aega")} · ${plural(courses.length, "koolitus", "koolitust")}</p>
        ${btn("Vaata oma profiili kaardil", "directory-region", person.county, "text-button")}
      </div>
    </div>
    <div class="staff-dashboard">
      <section class="staff-panel"><h2>Lisa vastuvõtuaeg</h2>
        <form class="field-stack" id="new-slot">
          <div class="field-row">${textInput("date", "Kuupäev", `type="date" min="${today()}"`)}${textInput("time", "Kellaaeg", 'type="time"')}</div>
          <label>Kohtumisviis<select name="format">${person.formats.map((format) => option(format, FORMATS[format], "")).join("")}</select></label>
          <div class="field-row">${textInput("minutes", "Kestus minutites", `type="number" min="15" max="240" value="${person.visit.minutes}"`)}${textInput("price", "Hind eurodes", `type="number" min="0" max="1000" step="0.01" value="${person.visit.price}"`)}</div>
          <p class="field-error" role="alert" hidden></p><button class="button primary" type="submit">Avalda vastuvõtuaeg</button>
        </form>
        <h3>Avaldatud ajad</h3>
        <ul class="published">${slots.length ? slots.map((slot) => `<li><span class="num">${shortSlot(slot.at)}</span> · ${FORMATS[slot.format]} · <span class="num">${euro(slot.cents)}</span></li>`).join("") : "<li>Vabu aegu pole avaldatud.</li>"}</ul>
      </section>
      <section class="staff-panel"><h2>Lisa koolitus</h2>
        <form class="field-stack" id="new-course">
          ${textInput("title", "Koolituse pealkiri", 'maxlength="100"')}
          <div class="field-row">${textInput("date", "Kuupäev", `type="date" min="${today()}"`)}${textInput("time", "Algusaeg", 'type="time"')}</div>
          <div class="field-row">${textInput("end", "Lõpuaeg", 'type="time"')}${textInput("hours", "Maht ak/h", 'type="number" min="1" max="300"')}</div>
          ${textInput("place", 'Toimumiskoht (linn ja aadress või „Veebis”)', 'maxlength="100"')}
          <label>Sihtrühm<select name="audience">${TRAINING_AUDIENCES.slice(1).map((item) => option(item,item,"")).join("")}</select></label>
          <label>Teema<select name="topic">${TASKS.map((task) => option(task.id, task.label, "")).join("")}</select></label>
          <label>EHIS<input name="ehis" maxlength="80"></label>
          <div class="field-row">${textInput("seats", "Vabad kohad", 'type="number" min="1" max="1000"')}${textInput("price", "Hind eurodes", 'type="number" min="0" max="10000" step="0.01"')}</div>
          <label>Koolituse kirjeldus<textarea name="description" maxlength="350" rows="3" required></textarea></label>
          <p class="field-error" role="alert" hidden></p><button class="button primary" type="submit">Avalda koolitus</button>
        </form>
        <h3>Avaldatud koolitused</h3>
        <ul class="published">${courses.length ? courses.map((course) => `<li><span class="num">${fullDate(course.date)}</span> · ${h(course.title)}</li>`).join("") : "<li>Koolitusi pole avaldatud.</li>"}</ul>
      </section>
    </div>
  </section>`;
}

function profilePreview(): string {
  const example = data.providers[0];
  if (!example) return "";
  return `<div class="staff-preview">
    <h2>Nii näeb abivajaja teie profiili</h2>
    <div class="directory-list profile-preview" inert aria-hidden="true">${providerCard(example, slotsFor(example.id))}</div>
    <p class="caption">Näidis. Nii kuvatakse teie nimi, kutse, hinnad ja vabad ajad.</p>
  </div>`;
}

export function staffView(): string {
  if (store.staff) return dashboard();
  return `<section class="page wrap">
    ${pageHead("Spetsialistile ja kliinikule", "Avaldage oma vastuvõtuajad ja koolitused kohas, kust abivajaja need üles leiab.", btn("Logi töölauale", "auth", "baas"))}
    <div class="staff-layout">
      <div>
        <h2>Kuidas konto kinnitatakse?</h2>
        <ol class="steps">
          <li><span class="step-num num" aria-hidden="true">1</span><h3>Kinnitage oma isik.</h3><p>Kasutage Smart-ID või Mobiil-ID teenust.</p></li>
          <li><span class="step-num num" aria-hidden="true">2</span><h3>Kinnitame kutse ja asutuse.</h3><p>Kontrollime andmeid Kutseregistris ja vajadusel Äriregistris ning Terviseametis.</p></li>
          <li><span class="step-num num" aria-hidden="true">3</span><h3>Avage spetsialisti töölaud.</h3><p>Lisage vastuvõtuaegu ja koolitusi.</p></li>
        </ol>
        <div class="actions">${btn("Alusta Smart-ID või Mobiil-ID-ga", "auth", "baas", "button primary")}</div>
      </div>
      ${profilePreview()}
    </div>
    <section class="plans" aria-labelledby="plans-title">
      <h2 id="plans-title">Valige endale sobiv konto</h2>
      <div class="plan-list">
        ${plans.map((plan) => `<article class="plan">
          <div><h3>${plan.label}</h3><p>${plan.capacity}</p></div>
          <ul>${plan.features.map((feature) => `<li>${h(feature)}</li>`).join("")}</ul>
          <div class="plan-action"><strong class="num">${plan.price}</strong>${plan.id === "baas" ? `<div class="plan-choices">${btn("Vali Baas", "auth", "baas", "button secondary small")}${btn("Vali Profi", "auth", "profi", "button secondary small")}</div>` : btn("Vali konto", "auth", plan.id, "button secondary small")}</div>
        </article>`).join("")}
      </div>
    </section>
  </section>`;
}

export function authStart(plan: string): string {
  return `<p>Valige, kuidas oma isik kinnitada.</p>
    <div class="field-stack">
      ${btn("Jätka Smart-ID-ga", "auth-start", `smart-id:${plan}`, "button primary full")}
      ${btn("Jätka Mobiil-ID-ga", "auth-start", `mobile-id:${plan}`, "button secondary full")}
    </div>
    <p class="small-print">${live ? "Järgmine samm avaneb SK Authentigate’i lehel." : "Näidisrežiimis avaneb seadmes proovikood. Päris isikuandmeid pole vaja."}</p>`;
}

export function demoRegistry(plan: string, certificate: string): string {
  const clinic = plan === "kliinik", org = clinic || plan === "praksis";
  return `<div class="transaction-summary"><p>Isikukinnitus lõpetatud (näidis).</p></div>
    <form id="registry-form" class="field-stack">
      ${textInput("certificate", "Kutseregistri kutsetunnistuse number", `inputmode="numeric" pattern="[0-9]{6}" value="${h(certificate)}"`)}
      ${org ? textInput("organisation", "Äriregistri registrikood", 'inputmode="numeric" pattern="[0-9]{8}" value="12345678"') : ""}
      ${clinic ? textInput("licence", "Terviseameti tegevusloa number", 'pattern="L[0-9]{5}" value="L06231"') : ""}
      <p class="field-error" role="alert" hidden></p>
      <div class="drawer-actions"><button class="button primary full" type="submit">Kontrolli ja ava töölaud</button></div>
    </form>`;
}
