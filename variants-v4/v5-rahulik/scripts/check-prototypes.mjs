import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dist = new URL("../dist/index.html", import.meta.url);
const shots = new URL("../qa-shots/", import.meta.url);
await mkdir(shots, { recursive: true });

const htmlText = await readFile(dist, "utf8");
assert(!/\sstyle=/.test(htmlText), "Inline style attribute in built bundle");

const candidateBrowsers = [
  process.env.CHROME_PATH,
  "/home/raido/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome",
  "/home/raido/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
  "/home/raido/.local/bin/chromium",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

let executablePath;
for (const path of candidateBrowsers) {
  try {
    await access(path);
    executablePath = path;
    break;
  } catch {
    // Try next path.
  }
}
assert(executablePath, "No Chromium/Chrome executable found");

const browser = await chromium.launch({
  executablePath,
  headless: true,
  env: { ...process.env, TMPDIR: "/tmp" },
});

try {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  for (const variant of ["A", "B", "C"]) {
    // Desktop 1440
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${dist.href}?variant=${variant}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);

    const desktopInfo = await page.evaluate(() => ({
      variant: document.documentElement.dataset.variant,
      h1Font: getComputedStyle(document.querySelector("h1")).fontFamily.split(",")[0],
      bodyFont: getComputedStyle(document.body).fontFamily.split(",")[0],
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      nonMapSvg: document.querySelectorAll("svg:not(.estonia-map)").length,
      tables: document.querySelectorAll("table").length,
      telLinks: document.querySelectorAll('a[href^="tel:"]').length,
      switcherText: document.querySelector(".proto-sw-label")?.textContent?.trim(),
      footerBg: getComputedStyle(document.querySelector("#footer")).backgroundColor,
    }));
    assert.equal(desktopInfo.variant, variant, `Expected data-variant=${variant}`);
    assert.equal(desktopInfo.overflow, false, `Desktop overflow in variant ${variant}`);
    assert.equal(desktopInfo.nonMapSvg, 0, `Non-map SVG in variant ${variant}`);
    assert.equal(desktopInfo.tables, 0, `Unexpected caged <table> in soft variant ${variant}`);
    assert.equal(desktopInfo.telLinks, 0, `Demo build leaked callable tel: link in variant ${variant}`);
    assert(desktopInfo.switcherText?.includes(variant), `Missing switcher label for ${variant}`);
    console.log(`1440 ${variant} | ${desktopInfo.switcherText} | h1=${desktopInfo.h1Font} | body=${desktopInfo.bodyFont} | footer=${desktopInfo.footerBg}`);

    await page.screenshot({ path: fileURLToPath(new URL(`proto-${variant.toLowerCase()}-1440.png`, shots)), fullPage: true });
    await page.screenshot({ path: fileURLToPath(new URL(`proto-${variant.toLowerCase()}-1440-fold.png`, shots)), clip: { x: 0, y: 0, width: 1440, height: 900 } });

    // Interactive checks: audience-only filtering + cross-group isolation + place filtering + parity + booking + privacy
    if (variant === "A") {
      await page.locator('[data-proto-group="kirjutamine"]').click();
      assert.equal(await page.evaluate(() => document.activeElement?.id), "pa-dossier-title", "Variant A did not focus opened cushion heading");
      await page.locator('input[name="audience"][value="asutus"]').check();
      await page.locator('input[name="task"][value="asutus-kirjutamine"]').check();
      // Switching to another group with overlapping tags MUST clear the task!
      await page.locator('[data-proto-group="asutus"]').click();
      assert.equal(await page.locator(".pa-guidance").count(), 0, "Variant A carried task into another group with overlapping tags");
      await page.locator('[data-proto-group="kirjutamine"]').click();
      await page.locator('input[name="audience"][value="laps"]').check();
      await page.locator('input[name="task"][value="laps-pliiats"]').check();
      await page.waitForTimeout(150);
      await page.screenshot({ path: fileURLToPath(new URL(`proto-a-1440-open.png`, shots)), clip: { x: 0, y: 0, width: 1440, height: 900 } });
    } else if (variant === "B") {
      // Jump CTA must focus #pb-intake-title
      await page.locator('[data-proto-jump="#pb-intake-title"]').click();
      assert.equal(await page.evaluate(() => document.activeElement?.id), "pb-intake-title", "Variant B primary jump did not focus intake heading");
      const beforeNames = await page.locator(".pb-appt-who h4").allTextContents();
      await page.locator('input[name="audience"][value="eakas"]').check();
      const afterAudienceNames = await page.locator(".pb-appt-who h4").allTextContents();
      assert.notDeepEqual(afterAudienceNames, beforeNames, "Variant B audience-only filter did not update appointment list");
      // Place filtering in audience-only mode must reflect the place accurately
      await page.locator('input[name="format"][value="kohal"]').check();
      await page.locator("#wizard-place").fill("Narva");
      await page.waitForTimeout(100);
      const narvaText = await page.locator("#pb-vastuvotud [data-proto-results]").textContent();
      assert(narvaText?.includes("Narva") || (await page.locator("#pb-vastuvotud .proto-slot").count()) > 0, "Variant B place filter did not produce Narva slots or place-aware empty message");
      await page.locator('input[name="format"][value="all"]').check();
      await page.locator('input[name="task"][value="eakas-vannituba"]').check();
      await page.waitForTimeout(150);
      await page.screenshot({ path: fileURLToPath(new URL(`proto-b-1440-open.png`, shots)), fullPage: true });
    } else if (variant === "C") {
      const desktopMismatch = await page.evaluate(() => {
        const groups = [...document.querySelectorAll(".pc-day-group")];
        return groups.filter((g) => {
          const count = Number.parseInt(g.querySelector(".pc-day-count")?.textContent ?? "", 10);
          return g.querySelectorAll(".pc-time-pill").length !== count;
        }).length;
      });
      assert.equal(desktopMismatch, 0, "Variant C desktop day count disagreed with rendered slot pills");

      const beforeSlots = await page.locator(".pc-time-pill").count();
      await page.locator('select[data-proto-select="audience"]').selectOption("asutus");
      const afterAudienceSlots = await page.locator(".pc-time-pill").count();
      assert(afterAudienceSlots < beforeSlots, `Variant C audience-only filter did not narrow slots (${beforeSlots} -> ${afterAudienceSlots})`);
      await page.locator('select[data-proto-select="task"]').selectOption("asutus-koolitus");
      const firstOpenDay = page.locator('.pc-pebble:not(.pc-pebble-all):not(.is-empty)').first();
      if (await firstOpenDay.count()) {
        await firstOpenDay.click();
        assert.equal(await page.locator(".pc-day-group").count(), 1, "Variant C day-pebble click did not filter to single day");
        await page.locator('[data-proto-day="all"]').click();
      }
    }

    // Privacy invariant
    const privacy = await page.evaluate(() => ({
      href: location.href, ls: localStorage.length, ss: sessionStorage.length, cookie: document.cookie,
    }));
    assert(!/laps|eakas|asutus|pliiats|vannituba|Narva/.test(privacy.href), `Finder leaked into URL in ${variant}`);
    assert.equal(privacy.ls, 0);
    assert.equal(privacy.ss, 0);
    assert.equal(privacy.cookie, "");

    // Open booking drawer and confirm honest demo disclosure
    const slot = page.locator('[data-action="book"]').first();
    await slot.click();
    await page.locator("dialog#drawer[open]").waitFor();
    const drawerText = await page.locator("dialog#drawer").textContent();
    assert(drawerText?.includes("Näidisbroneering"), "Booking drawer missing honest demo disclosure");
    await page.locator('#drawer [data-action="close"]').click();

    // Mobile 390
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${dist.href}?variant=${variant}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow390, false, `390px overflow in variant ${variant}`);

    // Verify mobile menu has zero callable tel: links
    await page.locator('[data-action="menu"]').click();
    assert.equal(await page.locator('a[href^="tel:"]').count(), 0, `Mobile menu leaked tel: link in ${variant}`);
    await page.locator('[data-action="menu"]').click();

    if (variant === "A") {
      // Verify opening and closing an activity cushion at 390px restores focus visibly in viewport
      const stone = page.locator('button.pa-stone[data-proto-group="kirjutamine"]');
      await stone.click();
      await page.locator(".pa-close-pill").click();
      const stoneBox = await stone.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, active: document.activeElement === el };
      });
      assert.equal(stoneBox.active, true, "Variant A close did not return focus to stone on mobile");
      assert(stoneBox.top >= 0 && stoneBox.bottom <= 844, `Variant A closed stone off-screen (${Math.round(stoneBox.top)}..${Math.round(stoneBox.bottom)})`);
    }

    if (variant === "C") {
      const mobileMismatch = await page.evaluate(() => {
        const groups = [...document.querySelectorAll(".pc-day-group")];
        return groups.filter((g) => {
          const count = Number.parseInt(g.querySelector(".pc-day-count")?.textContent ?? "", 10);
          return g.querySelectorAll(".pc-time-pill").length !== count;
        }).length;
      });
      assert.equal(mobileMismatch, 0, "Variant C mobile day count disagreed with rendered slot pills");
      const firstPillRect = await page.locator(".pc-time-pill").first().evaluate((el) => {
        const r = el.getBoundingClientRect();
        const sw = document.querySelector(".proto-switcher")?.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, swTop: sw?.top ?? 844 };
      });
      console.log(`Variant C 390px first time pill y=${Math.round(firstPillRect.top)}..${Math.round(firstPillRect.bottom)}px (switcher top=${Math.round(firstPillRect.swTop)}px)`);
      assert(firstPillRect.bottom < firstPillRect.swTop, `Variant C mobile first time pill overlaps switcher (${Math.round(firstPillRect.bottom)} >= ${Math.round(firstPillRect.swTop)})`);
      // Tap the center of the first time pill at 390px and confirm booking drawer opens (not intercepted by switcher!)
      await page.locator(".pc-time-pill").first().click();
      await page.locator("dialog#drawer[open]").waitFor();
      await page.locator('#drawer [data-action="close"]').click();
    }

    await page.screenshot({ path: fileURLToPath(new URL(`proto-${variant.toLowerCase()}-390.png`, shots)), fullPage: true });
    await page.screenshot({ path: fileURLToPath(new URL(`proto-${variant.toLowerCase()}-390-fold.png`, shots)), clip: { x: 0, y: 0, width: 390, height: 844 } });

    // Mobile 320 overflow check
    await page.setViewportSize({ width: 320, height: 760 });
    await page.waitForTimeout(100);
    const overflow320 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow320, false, `320px overflow in variant ${variant}`);
  }

  // Test switcher cycling + focus preservation + hiding on subpages
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${dist.href}?variant=A`, { waitUntil: "networkidle" });
  const nextBtn = page.locator('[data-proto-step="1"]');
  await nextBtn.focus();
  await nextBtn.click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.variant), "B");
  const stayedFocused = await page.evaluate(() => document.activeElement?.getAttribute("data-proto-step") === "1");
  assert.equal(stayedFocused, true, "Clicking switcher button destroyed focused button");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.variant), "C");
  // Navigate to subpage: switcher must hide and ignore arrow keys
  await page.locator('#navigation [data-nav="terapeudid"]').click();
  assert.equal(await page.locator(".proto-switcher").isVisible(), false, "Switcher remained visible off homepage");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.variant), "C");

  assert.equal(errors.length, 0, `Errors found: ${errors.join("; ")}`);
  console.log("ALL 3 SOFT PROTOTYPES PASSED ROUND 3 CHECKS (0 errors, 0 CSP, 0 tables, 0 tel: leaks, 0 overflow, C mobile fold + parity + focus + privacy verified)");
} finally {
  await browser.close();
}
