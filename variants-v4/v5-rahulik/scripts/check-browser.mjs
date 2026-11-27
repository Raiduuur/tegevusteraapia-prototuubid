import assert from "node:assert/strict";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { AUDIENCES, TASKS, UNSURE } from "../src/data/finder.ts";

const dist = new URL("../dist/index.html", import.meta.url);
const shots = new URL("../qa-shots/", import.meta.url);
await mkdir(shots, { recursive: true });
assert.deepEqual(await readdir(new URL("../dist/", import.meta.url)), ["index.html"]);
assert(!/\sstyle=/.test(await readFile(dist, "utf8")), "Inline style attribute in the built markup");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

function byAction(page, action, value) {
  return page.locator(`[data-action="${action}"]${value ? `[data-value="${value}"]` : ""}`);
}
async function go(page, id) {
  const link = page.locator(`#navigation [data-nav="${id}"]`);
  if (!await link.isVisible()) await byAction(page, "menu").click();
  await link.click();
}
const requiredShots = new Map([
  ["1440-wizard", "1440-wizard"], ["1440-wizard-matched", "1440-wizard-matched"], ["1440-map", "1440-map"],
  ["1440-calendar", "1440-calendar"], ["1440-shop", "1440-shop"], ["1440-specialist", "1440-staff"], ["390-wizard", "390-wizard"],
]);

async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  const width = page.viewportSize().width;
  const images = await page.locator("img").evaluateAll((elements) => Promise.all(elements.map(async (image) => {
    await image.decode();
    return image.naturalWidth;
  })));
  assert(images.every((naturalWidth) => naturalWidth > 0), `Unloaded photo at ${width} in ${name}`);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Overflow at ${width} in ${name}`);
  if (await page.locator(".calendar").count()) {
    assert(await page.locator(".calendar-cell, .calendar-event").evaluateAll((elements) => elements.every((element) =>
      element.getBoundingClientRect().right <= element.parentElement.getBoundingClientRect().right + 1)), "Calendar content escaped its column");
  }
  const nonMap = await page.locator("svg:not(.estonia-map)").count();
  assert.equal(nonMap, 0, `Non-map SVG at ${width} in ${name}`);
  const photos = await page.evaluate(() => [...document.querySelectorAll("main img:not(.portrait)")].map((image) => image.src));
  assert.equal(new Set(photos).size, photos.length, `Photo repeated at ${width} in ${name}`);
  // Playwright's own screenshots leave empty style="" on inputs; anything non-empty would be ours and CSP-blocked.
  assert.equal(await page.locator('body [style]:not([style=""])').count(), 0, `Inline style attribute at ${width} in ${name}`);
  const expectedMaps = Number(["map", "therapist-map-tartu", "wizard", "wizard-matched", "wizard-result", "booking"].includes(name));
  const maps = await page.locator("svg.estonia-map").count();
  assert.equal(maps, expectedMaps, `Unexpected map count at ${width} in ${name}`);
  const shot = `${width}-${name}`;
  if (requiredShots.has(shot)) {
    await page.screenshot({
      path: fileURLToPath(new URL(`${requiredShots.get(shot)}.png`, shots)),
      animations: "disabled",
      fullPage: shot === "1440-wizard" || shot === "1440-wizard-matched" || shot === "390-wizard",
    });
  }
  if (["wizard", "map", "calendar", "shop", "specialist"].includes(name)) {
    console.log(`${width}×${page.viewportSize().height} · ${name} · ${images.length} loaded photos · SVG ${nonMap} non-map / ${maps} map · no horizontal overflow`);
  }
}
async function choose(page, label) {
  await page.getByRole("radio", { name: label, exact: true }).check();
}
const dialog = (page) => page.locator("#drawer");
const dialogHeading = (page) => dialog(page).locator("#drawer-title");
async function close(page) {
  await dialog(page).getByRole("button", { name: "Sulge", exact: true }).first().click();
}
async function expectText(locator, text) {
  assert.match(await locator.innerText(), typeof text === "string" ? new RegExp(text, "i") : text);
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", (req) => errors.push(`${req.url()} ${req.failure()?.errorText}`));
    page.on("request", (req) => requests.push([` ${req.method()}`.trim(), req.url(), req.postData()]));
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (event) => window.__csp.push(`${event.violatedDirective} ${event.blockedURI}`));
    });
    await page.clock.setFixedTime(new Date("2026-11-25T19:40:00Z"));
    await page.goto(dist.href);
    await page.locator(".wizard").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() => Array.from(document.fonts, (face) => [face.family, face.status]));
    for (const name of ["Source Sans 3"]) {
      assert(fonts.some(([family, status]) => family === name && status === "loaded"), `${name} did not load`);
    }
    assert.equal(await page.locator(".next-person .portrait").count(), 3);
    assert.equal(await page.locator(".hero-photos img").count(), 2);
    for (const gone of [".home-editorial", ".direct-band", ".wizard-week", ".wizard-intro-copy"]) assert.equal(await page.locator(gone).count(), 0, `${gone} should be gone`);
    assert.equal(await page.locator('img[src*="hero_room"]').count(), 0);
    assert.equal(await page.locator(".next-person").count(), 3);
    assert.equal(await page.locator(".next-card [data-action=book]").count() > 0, true);
    assert.equal(await page.locator(".hero-photos figcaption [data-finder-audience]").count(), 2);
    assert.equal(await page.locator(".town-chip").count(), 8);
    assert.equal(await page.locator(".overview-course").count(), 4);
    assert.equal(await page.locator(".overview-product").count(), 3);
    assert.equal(await page.locator(".wizard legend").evaluateAll((items) => items.filter((item) => /^\d\./.test(item.textContent.trim())).length), 0);
    assert.equal(await page.evaluate(() => /\p{Extended_Pictographic}/u.test(document.body.innerText)), false, "Emoji found");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("h1")).fontFamily.startsWith('"Source Sans 3"') || getComputedStyle(document.querySelector("h1")).fontFamily.startsWith("Source Sans 3")), true);
    await capture(page, "wizard");
    // No dead state: six situations before any choice, nothing disabled, no "choose first" box.
    assert.equal(await page.locator("[data-wizard-tasks] input").count(), 6);
    assert.equal(await page.locator("[data-wizard-tasks] input:disabled").count(), 0);
    assert.equal(await page.getByText("Valige esmalt").count(), 0);
    assert.equal(await page.locator(".wizard-hint, [data-action=finder-reset]:visible").count(), 0);
    // "Kohtumisviis" reshapes the default panel.
    await choose(page, "Videokõne");
    assert(await page.locator(".next-card .slot small").count() > 0);
    assert((await page.locator(".next-card .slot small").allTextContents()).every((text) => text === "Videokõne"));
    await choose(page, "Kõik");
    // A starter situation answers the first question too.
    const starter = TASKS.find((task) => task.id === "eakas-vannituba");
    await choose(page, starter.label);
    assert(await page.getByRole("radio", { name: "Eakale lähedasele", exact: true }).isChecked());
    assert.equal(await page.locator("[data-wizard-tasks] input").count(), 6);
    assert(await page.getByRole("radio", { name: starter.label, exact: true }).isChecked());
    assert.equal(await page.evaluate(() => document.activeElement?.closest("[data-wizard-tasks]") !== null && document.activeElement.checked), true);
    assert.equal(await page.locator(".result-intro > p").innerText(), starter.result);
    // Quiet reset clears every answer in memory and returns to the first question.
    await page.locator("[data-action=finder-reset]").click();
    assert.equal(await page.locator('.wizard input[name="audience"]:checked, .wizard input[name="task"]:checked').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "wizard-title");
    assert.equal(await page.locator("[data-action=finder-reset]:visible").count(), 0);
    // Uncertainty without an audience still finds therapists.
    await choose(page, UNSURE.label);
    assert(await page.locator(".wizard-preview .provider-card").count() > 0);
    assert.equal(await page.locator('.wizard input[name="audience"]:checked').count(), 0);
    await page.locator("[data-action=finder-reset]").click();
    await choose(page, "Lapsele");
    assert.equal(await page.locator("[data-wizard-tasks] input").count(), 6);
    assert(await page.getByText("Ei oska öelda, vajan nõu", { exact: true }).isVisible());
    assert.equal(await page.locator(".next-person .portrait").count(), 3);
    await choose(page, "Lapsel on raske pliiatsit hoida või kääridega lõigata.");
    await expectText(page.locator("#wizard-preview-title"), "Teie valikule sobiv abi");
    assert.equal(await page.locator(".wizard-preview .provider-card .portrait").count(), await page.locator(".wizard-preview .provider-card").count());
    assert.equal(await page.locator(".match-filter .wizard-preview, .wizard-preview .match-filter").count(), 0);
    await capture(page, "wizard-matched");
    await choose(page, "Kohapeal");
    await page.locator("#wizard-place").fill("Tartu");
    await expectText(page.locator("main"), "proovib laps eri viise pliiatsi hoidmiseks");
    assert.equal(await page.locator(".result-tool").count(), 3);
    assert.equal(await page.locator(".provider-card").count(), 2);
    assert.equal(page.url(), dist.href);
    assert.deepEqual(await page.evaluate(() => ({ browserHistory: history.state, local: localStorage.length, session: sessionStorage.length, cookies: document.cookie })), { browserHistory: null, local: 0, session: 0, cookies: "" });
    assert.deepEqual(requests.filter(([, url]) => url === dist.href), [["GET", dist.href, null]]);
    for (const [method, url, body] of requests.filter(([, url]) => url !== dist.href)) {
      assert.equal(method, "GET");
      assert.equal(body, null);
      assert(["fonts.googleapis.com", "fonts.gstatic.com"].includes(new URL(url).hostname), `Finder sent request to ${url}`);
    }
    await capture(page, "wizard-result");
    await byAction(page, "book", "s-rs-1").click();
    await dialog(page).getByRole("textbox", { name: "Teie nimi" }).fill("Isikukood 38507261234");
    await dialog(page).getByRole("textbox", { name: "Telefoninumber" }).fill("5123 456");
    await dialog(page).getByRole("button", { name: "Broneeri aeg" }).click();
    assert(await page.getByText(/Isikukoodi ega terviseandmeid/).isVisible());
    await dialog(page).getByRole("textbox", { name: "Teie nimi" }).fill("Diagnoos autism");
    await dialog(page).getByRole("button", { name: "Broneeri aeg" }).click();
    assert(await page.getByText(/Isikukoodi ega terviseandmeid/).isVisible());
    await dialog(page).getByRole("textbox", { name: "Teie nimi" }).fill("Mari Näide");
    await dialog(page).getByRole("textbox", { name: "Telefoninumber" }).fill("+372 5123 4567");
    await capture(page, "booking");
    await dialog(page).getByRole("button", { name: "Broneeri aeg" }).click();
    await expectText(dialogHeading(page), "Näidisaeg on broneeritud");
    const download = page.waitForEvent("download");
    await dialog(page).getByRole("button", { name: /Laadi kalendrisse/ }).click();
    const file = await download;
    const ical = await readFile(await file.path(), "utf8");
    assert.equal(file.suggestedFilename(), "kohtumine.ics");
    assert(ical.includes("DTSTART;TZID=Europe/Tallinn:20261126T110000"));
    assert(ical.includes("SUMMARY:Kohtumine"));
    assert(!/Mari|5123|pliiatsi/i.test(ical));
    await close(page);
    await go(page, "terapeudid");
    assert.equal(await page.locator(".provider-card").count(), 10);
    assert.equal(await byAction(page, "book", "s-rs-1").count(), 0);
    await capture(page, "map");
    assert(await page.locator(".map-pin .pin-label").evaluateAll((labels) => labels.every((label, i) => {
      const a = label.getBoundingClientRect();
      return labels.slice(i + 1).every((other) => {
        const b = other.getBoundingClientRect();
        return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
      });
    })), "Map city labels overlap");
    const tartu = page.locator('[data-pin="Tartumaa"]');
    if (viewport.width === 1440) {
      await page.locator('.provider-card[data-provider-county="Tartumaa"]').first().hover();
      assert(await tartu.evaluate((pin) => pin.classList.contains("is-highlighted")));
    }
    await tartu.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".provider-card").count(), 2);
    assert(await page.locator(".map-summary").getByText("Tartu ja Tartumaa").isVisible());
    await capture(page, "therapist-map-tartu");
    await byAction(page, "inquiry").click();
    await expectText(dialogHeading(page), "Päring piirkonna terapeutidele");
    await close(page);
    await byAction(page, "map-region", "video").click();
    await expectText(page.locator(".map-summary"), "Veebikohtumised");
    assert(await page.locator(".slot").evaluateAll((slots) => slots.every((slot) => slot.textContent.includes("Videokõne"))));

    await go(page, "koolituskalender");
    await expectText(page.locator("#month-title"), "Detsember 2026");
    assert.equal(await page.locator(".weekdays [role=columnheader]").count(), 7);
    const coursePhoto = page.locator("#calendar-detail .course-photo");
    assert.equal(await page.locator(".agenda .overview-course").count(), 5);
    assert.equal(await page.locator("#calendar-detail .teacher").count(), 1);
    assert(["rgb(163, 78, 46)", "rgb(35, 73, 109)"].includes(await page.locator('.calendar-event[aria-pressed="true"]').evaluate((element) => getComputedStyle(element).backgroundColor)));
    const writing = await coursePhoto.getAttribute("src");
    await capture(page, "calendar");
    await byAction(page, "select-course", "kodus").click();
    const care = await coursePhoto.getAttribute("src");
    assert(care && care !== writing, "Care course should show a different photo");
    await capture(page, "calendar-care");
    await page.getByRole("button", { name: "Järgmine kuu" }).click();
    await expectText(page.locator("#month-title"), "Jaanuar 2027");
    await page.locator(".calendar [role=table]").getByRole("button", { name: /Kuidas tööpäeva pärast haigust kohandada/ }).click();
    await expectText(page.locator("#calendar-detail"), "Tõnu Mägi");
    const workshop = await coursePhoto.getAttribute("src");
    assert(workshop && workshop !== writing && workshop !== care, "Workshop should show a different photo");
    await capture(page, "calendar-january");
    await page.getByRole("button", { name: "Registreeru koolitusele" }).click();
    await dialog(page).getByRole("textbox", { name: "Teie nimi" }).fill("Mari Näide");
    await dialog(page).getByRole("textbox", { name: "E-posti aadress" }).fill("mari@example.test");
    await dialog(page).getByRole("combobox", { name: "Registreerun" }).selectOption("institution");
    await dialog(page).getByRole("textbox", { name: "Asutuse nimi" }).fill("Näidiskool");
    await dialog(page).getByRole("textbox", { name: "Registrikood" }).fill("12345678");
    await dialog(page).getByRole("button", { name: "Registreeru koolitusele" }).click();
    await expectText(dialogHeading(page), "Näidisregistreerimine on tehtud");
    await close(page);
    await expectText(page.locator(".course-price"), "41 vaba kohta");

    await go(page, "e-pood");
    assert.equal(await page.locator(".product").count(), 10);
    assert.equal(await page.locator("main [data-action=quote]").count(), 1);
    assert.equal(await page.locator("main [data-action=more-products]").count(), 1);
    // The demo compliance line appears once per shelf, never on every product.
    assert.equal(await page.locator(".product").filter({ hasText: "CE ja EN 71" }).count(), 0);
    assert.equal(await page.locator(".shelf-note").count(), await page.locator(".shelf").count());
    await capture(page, "shop");
    await byAction(page, "more-products").click();
    assert.equal(await page.locator(".product").count(), 48);
    assert.equal(await page.locator(".product").filter({ hasText: "CE ja EN 71" }).count(), 0);
    await capture(page, "shop-expanded");
    await byAction(page, "more-products").click();
    const search = page.locator("#shop-search");
    await search.fill("lusikas");
    assert(await page.locator(".product").count() >= 2);
    await expectText(page.locator(".shop-count"), /^Leitud \d+ vahendit$/);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "shop-search");
    await search.fill("paevakava");
    assert(await page.getByRole("button", { name: "Vaata toodet Piltidega päevakava" }).isVisible());
    await search.fill("zzz");
    assert.equal(await page.locator(".product").count(), 0);
    assert(await page.getByText("ei andnud tulemusi").isVisible());
    await byAction(page, "shop-clear").click();
    assert.equal(await page.locator(".product").count(), 10);
    assert.equal(page.url(), dist.href.replace(/#.*$/, "") + "#e-pood");
    await byAction(page, "quote").click();
    await dialog(page).getByLabel("Teie nimi").fill("Mari Näide");
    await dialog(page).getByLabel("E-posti aadress").fill("mari@example.test");
    await dialog(page).getByLabel("Asutuse nimi").fill("Näidiskool");
    await dialog(page).getByLabel("Registrikood").fill("12345678");
    await dialog(page).getByRole("button", { name: "Saada päring" }).click();
    await expectText(dialogHeading(page), "Näidispäring on tehtud");
    await close(page);
    await page.getByRole("button", { name: "Vaata toodet Jäme pliiats" }).click();
    await expectText(dialog(page), "Miks soovitame");
    await expectText(dialog(page), "GPSR");
    await dialog(page).getByRole("button", { name: "Lisa ostukorvi" }).click();
    await close(page);
    await byAction(page, "add-product", "piltidega-paevakava").click();
    assert(await page.locator(".cart-header").evaluate((button) => button.classList.contains("has-items")));
    await byAction(page, "cart").click();
    assert.equal(await dialog(page).locator(".cart-line").count(), 2);
    assert.deepEqual(await dialog(page).locator("[name=bank]").evaluateAll((inputs) => inputs.map((input) => input.value)), ["Swedbank", "SEB", "LHV", "Coop", "Luminor", "Kaart"]);
    assert.deepEqual(await dialog(page).locator("[name=delivery]").evaluateAll((inputs) => inputs.map((input) => input.value)), ["Omniva", "SmartPosti", "DPD", "Venipak"]);
    await dialog(page).getByRole("radio", { name: "LHV", exact: true }).check();
    await dialog(page).getByRole("radio", { name: "Omniva", exact: true }).check();
    await capture(page, "cart");
    await dialog(page).getByRole("button", { name: "Vormista näidistellimus" }).click();
    await expectText(dialog(page).locator(".field-error"), "Märkige nõusolek");
    await dialog(page).getByRole("checkbox", { name: /Soovin PDF-i/ }).check();
    await dialog(page).getByRole("button", { name: "Vormista näidistellimus" }).click();
    await expectText(dialogHeading(page), "Näidistellimus on vormistatud");
    await dialog(page).getByRole("button", { name: "Taganemisavaldus" }).click();
    assert.match(await dialog(page).getByLabel("Tellimuse number").inputValue(), /^TTK-/);
    await dialog(page).getByRole("textbox", { name: "E-posti aadress" }).fill("mari@example.test");
    await dialog(page).getByRole("button", { name: "Edasi" }).click();
    await expectText(dialogHeading(page), "Kontrollige taganemisavaldust");
    await dialog(page).getByRole("button", { name: "Kinnita taganemine" }).click();
    await expectText(dialogHeading(page), "Näidistaganemisavaldus on vastu võetud");
    await close(page);

    await go(page, "spetsialistile");
    await capture(page, "specialist");
    assert.equal(await page.locator(".plan").count(), 3);
    assert.equal(await page.locator(".steps li").count(), 3);
    assert.equal(await page.locator(".profile-preview").getAttribute("inert"), "");
    await page.locator(".plan").filter({ hasText: "Väike praksis" }).getByRole("button", { name: "Vali konto" }).click();
    await dialog(page).getByRole("button", { name: "Jätka Smart-ID-ga" }).click();
    const code = await dialog(page).locator(".auth-code").innerText();
    await dialog(page).getByLabel("Neljakohaline kood").fill(code === "1000" ? "1001" : "1000");
    await dialog(page).getByRole("button", { name: "Kinnita kood" }).click();
    await expectText(dialog(page).locator(".field-error"), "Kontrollkood ei klapi");
    await dialog(page).getByLabel("Neljakohaline kood").fill(code);
    await dialog(page).getByRole("button", { name: "Kinnita kood" }).click();
    await dialog(page).getByRole("button", { name: "Kontrolli ja ava töölaud" }).click();
    await expectText(page.locator("main h1"), "Spetsialisti töölaud");
    await capture(page, "specialist-dashboard");
    const slot = page.locator("#new-slot");
    await slot.getByLabel("Kuupäev").fill("2026-11-28");
    await slot.getByLabel("Kellaaeg").fill("13:05");
    await slot.getByRole("button", { name: "Avalda vastuvõtuaeg" }).click();
    await expectText(page.locator(".published").first(), "13:05");
    const course = page.locator("#new-course");
    await course.getByLabel("Koolituse pealkiri").fill("Kirjutamise õpituba");
    await course.getByLabel("Kuupäev").fill("2026-12-12");
    await course.getByLabel("Algusaeg").fill("13:30");
    await course.getByLabel("Lõpuaeg").fill("15:30");
    await course.getByLabel("Maht ak/h").fill("2");
    await course.getByLabel("Toimumiskoht").fill("Veebis");
    await course.getByLabel("Vabad kohad").fill("6");
    await course.getByLabel("Hind eurodes").fill("19");
    await course.getByLabel("Koolituse kirjeldus").fill("Proovime eri viise pliiatsi hoidmiseks.");
    await course.getByRole("button", { name: "Avalda koolitus" }).click();
    await expectText(page.locator(".published").last(), "Kirjutamise õpituba");
    await go(page, "koolituskalender");
    await expectText(page.locator("#calendar-detail"), "Kirjutamise õpituba");
    await go(page, "terapeudid");
    await page.locator('[data-filter="region"]').selectOption("Tartumaa");
    await page.locator('[data-filter="week"]').check();
    assert(await page.getByRole("button", { name: /Riin Saar.*13:05/ }).isVisible());

    await byAction(page, "map-region", "all").click();
    await page.locator('[data-filter="week"]').uncheck();
    await byAction(page, "provider-slots", "riin-saar").click();
    await byAction(page, "book", "s-rs-4").click();
    await dialog(page).getByRole("textbox", { name: "Teie nimi" }).fill("Mari Näide");
    await dialog(page).getByRole("textbox", { name: "Telefoninumber" }).fill("5123 456");
    await dialog(page).getByRole("button", { name: "Broneeri aeg" }).click();
    await expectText(dialogHeading(page), "Valige teine aeg");
    assert(await dialog(page).getByText(/vahepeal broneeritud/).isVisible());
    await dialog(page).locator('[data-action="pick-alternative"]').first().click();
    assert.equal(await dialog(page).getByRole("textbox", { name: "Teie nimi" }).inputValue(), "Mari Näide");
    await close(page);

    await go(page, "leia-abi");
    await expectText(page.locator(".wizard legend").first(), "Kellele abi otsite");
    await choose(page, "Lasteaiale, koolile või hooldekodule");
    await choose(page, "Soovime aidata lastel paremini pliiatsi ja kääridega toime tulla.");
    await expectText(page.locator(".result-group").first(), "Koolitused ja nõu teie asutusele");
    await page.reload();
    await expectText(page.locator(".wizard legend").first(), "Kellele abi otsite");
    await byAction(page, "directory-region", "Tartumaa").click();
    await expectText(page.locator(".map-summary"), "Tartu ja Tartumaa");
    assert.equal(await page.locator('[data-filter="region"]').inputValue(), "Tartumaa");
    await go(page, "leia-abi");
    await byAction(page, "directory-region", "video").click();
    await expectText(page.locator(".map-summary"), "Veebikohtumised");
    await go(page, "leia-abi");
    await byAction(page, "calendar-course", "larm").click();
    await expectText(page.locator("#calendar-detail"), "Kuidas last lärmakas rühmas toetada");
    await go(page, "leia-abi");
    await page.locator(".next-card [data-action=book]").first().click();
    await expectText(dialogHeading(page), "Kontrollige aega");
    await close(page);
    await page.locator(".overview-product [data-action=add-product]").first().click();
    await expectText(page.locator(".cart-header"), "\\(1\\)");
    await page.reload();
    await expectText(page.locator(".wizard legend").first(), "Kellele abi otsite");
    assert.equal(await page.locator('.wizard input[name="audience"]:checked, .wizard input[name="task"]:checked').count(), 0);
    assert.equal(await page.locator(".next-person .portrait").count(), 3);
    assert.deepEqual(await page.evaluate(() => window.__csp), [], `CSP violations at ${viewport.width}`);
    assert.deepEqual(errors, [], `Chrome errors at ${viewport.width}`);
    console.log(`${viewport.width}px · 0 Chrome errors · privacy, booking, training, B2B quote, cart, withdrawal and specialist publishing passed`);
    await context.close();
  }

  const page = await browser.newPage({ viewport: { width: 320, height: 760 } });
  await page.clock.setFixedTime(new Date("2026-11-25T19:40:00Z"));
  await page.goto(dist.href);
  for (const id of ["leia-abi", "terapeudid", "koolituskalender", "e-pood", "spetsialistile"]) {
    await go(page, id);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `320px overflow in ${id}`);
  }
  console.log("320px · no horizontal overflow in any view");
  for (const person of AUDIENCES) {
    for (const task of [...TASKS.filter((choice) => choice.audience === person.id), UNSURE]) {
      await go(page, "leia-abi");
      await choose(page, person.label);
      await choose(page, task.label);
      assert.equal(await page.locator(".result-intro > p").innerText(), task.result);
      assert.deepEqual(await page.locator(".result-tool h4").allTextContents(), [...task.tools]);
      assert(await page.locator(".provider-card").count() > 0, `Missing provider match for ${task.id}`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `320px overflow for ${task.id}`);
      await go(page, "terapeudid");
    }
  }
  console.log("25 exact activity paths and the uncertainty choice in all five branches passed");
} finally {
  await browser.close();
}
