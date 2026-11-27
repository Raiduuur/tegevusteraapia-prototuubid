// Acceptance checks from the Fable 5.2 proposal (§5.5) that check-browser.mjs does not cover:
// menu and drawers at three widths, sticky submit bars, wordmark lockup, tap targets, shadows,
// portraits, photo uniqueness and bundle size. Also writes review screenshots to qa-shots/.
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dist = new URL("../dist/index.html", import.meta.url);
const shots = new URL("../qa-shots/", import.meta.url);
const size = (await stat(dist)).size;
assert(size <= 1.7 * 1024 * 1024, `dist/index.html is ${size} bytes`);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const widths = [[1440, 900], [390, 844], [320, 760]];
const shot = (page, name, fullPage = false) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, shots)), fullPage, animations: "disabled" });

async function open(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => window.__csp.push(event.violatedDirective));
  });
  await page.clock.setFixedTime(new Date("2026-11-25T19:40:00Z"));
  await page.goto(dist.href);
  await page.locator(".wizard").waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors };
}
const go = async (page, view) => {
  await page.evaluate((hash) => { location.hash = hash; }, view);
  await page.locator(view === "leia-abi" ? ".wizard" : "#page-title").first().waitFor();
};
async function sane(page, label) {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    svg: document.querySelectorAll("svg:not(.estonia-map)").length,
    // © and ® are text symbols (map data attribution), not emoji.
    emoji: /(?![\u00A9\u00AE])\p{Extended_Pictographic}/u.test(document.body.innerText),
    photos: [...document.querySelectorAll("main img:not(.portrait)")].map((image) => image.src),
    inline: document.querySelectorAll('body [style]:not([style=""])').length,
  }));
  assert.equal(result.overflow, false, `Horizontal overflow: ${label}`);
  assert.equal(result.svg, 0, `Non-map SVG: ${label}`);
  assert.equal(result.emoji, false, `Emoji: ${label}`);
  assert.equal(new Set(result.photos).size, result.photos.length, `Repeated photo: ${label}`);
  assert.equal(result.inline, 0, `Inline style: ${label}`);
}
/** Focus every field in the open drawer and require it to sit fully between the sticky head and the sticky submit bar. */
async function fieldsClear(page, label) {
  const problems = await page.evaluate(async () => {
    const drawer = document.querySelector("#drawer");
    const head = drawer.querySelector(".drawer-head");
    const out = [];
    const actions = drawer.querySelector("form .drawer-actions");
    if (!actions) return ["no .drawer-actions in form"];
    if (actions.parentElement.lastElementChild !== actions) out.push(".drawer-actions is not the last child of its form");
    for (const field of drawer.querySelectorAll("form input:not([type=hidden]):not([type=radio]), form select, form textarea, form .checkout-options label")) {
      if (!field.getClientRects().length) continue;
      field.focus();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const box = field.getBoundingClientRect();
      const bar = actions.getBoundingClientRect();
      const top = head.getBoundingClientRect().bottom;
      if (box.bottom > bar.top + 0.5 || box.top < top - 0.5) out.push(`${field.name || field.textContent.trim()} ${Math.round(box.top)}-${Math.round(box.bottom)} vs head ${Math.round(top)} bar ${Math.round(bar.top)}`);
    }
    return out;
  });
  assert.deepEqual(problems, [], `Sticky bar covers a field: ${label}`);
}
const close = (page) => page.locator("#drawer .drawer-head [data-action=close]").click();

try {
  for (const [width, height] of widths) {
    const { page, context, errors } = await open(width, height);
    const tag = `${width}`;

    // Wordmark: one line on desktop, a deliberate two-line lockup on phones.
    const brand = await page.locator(".site-header .brand").evaluate((element) => {
      const [first, second] = element.querySelectorAll("span");
      const a = first.getBoundingClientRect(), b = second.getBoundingClientRect();
      // The link box stretches to the header row; measure the text itself.
      return { height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top), twoLines: b.top > a.top + 4 };
    });
    if (width === 1440) assert(brand.height < 30 && !brand.twoLines, "Wordmark should be one line at 1440");
    else assert(brand.twoLines, `Wordmark should be two lines at ${width}`);
    if (width === 320) assert.equal((await page.locator(".cart-header").innerText()).replace(/\s+/g, " ").trim(), "Korv (0)");

    // Overview default and matched.
    assert.equal(await page.locator(".hero-photos img").evaluateAll(async (images) => (await Promise.all(images.map((image) => image.decode().then(() => image.naturalWidth > 0)))).filter(Boolean).length), 2);
    assert.equal(await page.locator(".next-person img.portrait").count(), 3);
    assert.equal(await page.locator("svg.estonia-map").count(), 1);
    await sane(page, `${tag} overview`);
    if (width === 320) await shot(page, "320-wizard");
    await page.getByRole("radio", { name: "Eakale lähedasele", exact: true }).check();
    await page.getByRole("radio", { name: "Mu lähedane kardab vannitoas kukkuda.", exact: true }).check();
    assert.equal(await page.locator(".wizard-tools .result-tool").count(), 3);
    await sane(page, `${tag} overview matched`);
    if (width !== 320) {
      await page.locator(".match-panel").scrollIntoViewIfNeeded();
      await page.locator(".match-panel").screenshot({ path: fileURLToPath(new URL(`${width}-matched-panel.png`, shots)), animations: "disabled" });
    }

    // Tap targets.
    const small = await page.evaluate(() => [...document.querySelectorAll(".slot, .button, .wizard-choice span, .town-chip, .overview-course, .quantity button")]
      .filter((element) => element.getClientRects().length)
      .filter((element) => element.getBoundingClientRect().height < (element.matches(".button.small") ? 40 : 44) - 0.5)
      .map((element) => `${element.className} ${element.textContent.trim().slice(0, 30)} ${element.getBoundingClientRect().height}`));
    assert.deepEqual(small, [], `Small tap targets at ${width}`);

    // Shadows only on things that float.
    const shadows = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((element) => {
      const value = getComputedStyle(element).boxShadow;
      if (value === "none" || element.matches(":focus")) return false;
      if (element.matches(".drawer, .toast > span, .main-nav.is-open, .main-nav a, .segmented button[aria-pressed=true], .wizard-modes input:checked + span")) return false;
      return true;
    }).map((element) => element.className));
    assert.deepEqual(shadows, [], `Unexpected box-shadow at ${width}`);

    // Booking drawer from the matched panel.
    await page.locator(".match-panel [data-action=book]").first().click();
    await page.locator("#booking-form").waitFor();
    assert.equal(await page.locator("#drawer .booking-who .portrait").count(), 1);
    await sane(page, `${tag} booking drawer`);
    await fieldsClear(page, `${tag} booking`);
    if (width !== 1440) {
      await page.setViewportSize({ width, height: 520 });
      await fieldsClear(page, `${tag}x520 booking`);
      await page.locator("#drawer").evaluate((drawer) => { drawer.scrollTop = 0; });
      await page.locator("#drawer-title").focus();
      await page.locator("#drawer [name=contact]").focus();
      await shot(page, `${width}-booking-short`);
      await page.setViewportSize({ width, height });
    }
    await page.locator("#drawer").evaluate((drawer) => { drawer.scrollTop = 0; });
    await page.locator("#drawer-title").focus();
    await shot(page, `${width}-booking`);
    await close(page);

    // Open mobile menu.
    if (width !== 1440) {
      await page.locator("[data-action=menu]").click();
      assert(await page.locator(".main-nav.is-open .nav-phone").isVisible());
      await sane(page, `${tag} menu open`);
      await shot(page, `${width}-menu`);
      await page.locator("[data-action=menu]").click();
    }

    // Directory.
    await go(page, "terapeudid");
    assert.equal(await page.locator(".directory-list .provider-card").count(), 10);
    assert.equal(await page.locator(".directory-list .provider-card img.portrait").count(), 6);
    assert.equal(await page.locator(".directory-list .provider-card .portrait.mono").count(), 4);
    const faces = await page.locator(".directory-list img.portrait").evaluateAll((images) => images.map((image) => image.src));
    assert.equal(new Set(faces).size, faces.length, "A face is used for two names");
    if (width === 1440) assert.equal(await page.locator(".map-panel").evaluate((panel) => getComputedStyle(panel).position), "sticky");
    assert.equal(await page.locator("svg.estonia-map").count(), 1);
    await sane(page, `${tag} directory`);
    await page.locator("[data-action=credentials]").first().click();
    await sane(page, `${tag} credentials drawer`);
    await close(page);

    // Calendar and the registration drawer.
    await go(page, "koolituskalender");
    assert.equal(await page.locator(".weekdays [role=columnheader]").count(), 7);
    await sane(page, `${tag} calendar`);
    await page.locator("#calendar-detail [data-action=register]").click();
    await page.getByRole("combobox", { name: "Registreerun" }).selectOption("institution");
    await sane(page, `${tag} register drawer`);
    await fieldsClear(page, `${tag} register`);
    await close(page);
    await page.locator("#calendar-detail [data-action=training-inquiry]").click();
    await fieldsClear(page, `${tag} training inquiry`);
    await close(page);

    // Shop, product drawer, quote drawer, cart drawer.
    await go(page, "e-pood");
    await sane(page, `${tag} shop`);
    await page.getByRole("button", { name: "Vaata toodet Jäme pliiats" }).click();
    assert.equal(await page.locator("#drawer .product-media img").count(), 1);
    await sane(page, `${tag} product drawer`);
    await page.locator("#drawer [data-action=add-product]").click();
    await close(page);
    assert(await page.locator(".cart-header.has-items").isVisible());
    await page.locator("main [data-action=add-product][data-value=piltidega-paevakava]").click();
    await page.locator("[data-action=cart]").click();
    await sane(page, `${tag} cart drawer`);
    await fieldsClear(page, `${tag} cart`);
    await page.locator("#drawer").evaluate((drawer) => { drawer.scrollTop = 0; });
    await page.locator("#drawer-title").focus();
    await shot(page, `${width}-cart`);
    await close(page);
    await page.locator("main [data-action=quote]").click();
    await fieldsClear(page, `${tag} quote`);
    await close(page);

    // Specialist.
    await go(page, "spetsialistile");
    assert.equal(await page.locator(".plan").count(), 3);
    assert.equal(await page.locator(".steps li").count(), 3);
    assert.equal(await page.locator(".profile-preview").getAttribute("inert"), "");
    await sane(page, `${tag} specialist`);
    if (width !== 1440) await shot(page, `${width}-staff`, true);

    assert.deepEqual(await page.evaluate(() => window.__csp), [], `CSP violations at ${width}`);
    assert.deepEqual(errors, [], `Console errors at ${width}`);
    console.log(`${width}×${height} · wordmark, overview, matched panel, menu, 6 drawers, directory, calendar, shop and specialist passed · 0 errors · 0 CSP violations`);
    await context.close();
  }
  console.log(`dist/index.html ${size} bytes (limit ${Math.round(1.7 * 1024 * 1024)})`);
} finally {
  await browser.close();
}
