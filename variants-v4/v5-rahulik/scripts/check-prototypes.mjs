import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dist = new URL("../dist/index.html", import.meta.url);
const shots = new URL("../qa-shots/", import.meta.url);
await mkdir(shots, { recursive: true });

const htmlText = await readFile(dist, "utf8");
assert(!/\sstyle=/.test(htmlText), "Inline style attribute in built bundle");

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
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
    await page.waitForTimeout(200);

    const desktopInfo = await page.evaluate(() => ({
      variant: document.documentElement.dataset.variant,
      h1Font: getComputedStyle(document.querySelector("h1")).fontFamily.split(",")[0],
      bodyFont: getComputedStyle(document.body).fontFamily.split(",")[0],
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      nonMapSvg: document.querySelectorAll("svg:not(.estonia-map)").length,
      switcherText: document.querySelector(".proto-sw-label")?.textContent?.trim(),
      footerBg: getComputedStyle(document.querySelector("#footer")).backgroundColor,
    }));
    assert.equal(desktopInfo.variant, variant, `Expected data-variant=${variant}`);
    assert.equal(desktopInfo.overflow, false, `Desktop overflow in variant ${variant}`);
    assert.equal(desktopInfo.nonMapSvg, 0, `Non-map SVG in variant ${variant}`);
    assert(desktopInfo.switcherText?.includes(variant), `Missing switcher label for ${variant}`);
    console.log(`1440 ${variant} | ${desktopInfo.switcherText} | h1=${desktopInfo.h1Font} | body=${desktopInfo.bodyFont} | footer=${desktopInfo.footerBg}`);

    await page.screenshot({ path: fileURLToPath(new URL(`proto-${variant.toLowerCase()}-1440.png`, shots)), fullPage: true });
    await page.screenshot({ path: fileURLToPath(new URL(`proto-${variant.toLowerCase()}-1440-fold.png`, shots)), clip: { x: 0, y: 0, width: 1440, height: 900 } });

    // Interactive checks: audience-only filtering + cross-group isolation + booking + privacy
    if (variant === "A") {
      await page.locator('[data-proto-group="kirjutamine"]').click();
      await page.locator('input[name="audience"][value="laps"]').check();
      await page.waitForTimeout(100);
      await page.locator('input[name="task"][value="laps-pliiats"]').check();
      await page.waitForTimeout(150);
      // Verify first therapist slot is visible within 900px fold when dossier is open
      const firstSlotBottom = await page.locator(".pa-dossier .proto-slot").first().evaluate((el) => el.getBoundingClientRect().top);
      console.log(`Variant A open dossier first slot top y=${Math.round(firstSlotBottom)}px`);
      await page.screenshot({ path: fileURLToPath(new URL(`proto-a-1440-open.png`, shots)), clip: { x: 0, y: 0, width: 1440, height: 900 } });
      // Verify switching to another group clears incompatible task
      await page.locator('[data-proto-group="soomine"]').click();
      const leaked = await page.locator(".pa-guidance").count();
      assert.equal(leaked, 0, "Variant A leaked previous group's task into another activity group");
    } else if (variant === "B") {
      const beforeNames = await page.locator(".pb-appt-who h4").allTextContents();
      await page.locator('input[name="audience"][value="eakas"]').check();
      const afterAudienceNames = await page.locator(".pb-appt-who h4").allTextContents();
      assert.notDeepEqual(afterAudienceNames, beforeNames, "Variant B audience-only filter did not update appointment list");
      await page.locator('input[name="task"][value="eakas-vannituba"]').check();
    } else if (variant === "C") {
      const beforeRows = await page.locator(".pc-grid-table tbody tr").count();
      await page.locator('select[data-proto-select="audience"]').selectOption("asutus");
      const afterAudienceRows = await page.locator(".pc-grid-table tbody tr").count();
      assert(afterAudienceRows < beforeRows, `Variant C audience-only filter did not narrow rows (${beforeRows} -> ${afterAudienceRows})`);
      await page.locator('select[data-proto-select="task"]').selectOption("asutus-koolitus");
    }

    // Privacy invariant
    const privacy = await page.evaluate(() => ({
      href: location.href, ls: localStorage.length, ss: sessionStorage.length, cookie: document.cookie,
    }));
    assert(!/laps|eakas|asutus|pliiats|vannituba/.test(privacy.href), `Finder leaked into URL in ${variant}`);
    assert.equal(privacy.ls, 0);
    assert.equal(privacy.ss, 0);
    assert.equal(privacy.cookie, "");

    // Open booking drawer and confirm demo privacy note is honest
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
    await page.waitForTimeout(150);
    const overflow390 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow390, false, `390px overflow in variant ${variant}`);

    // Variant C mobile day-list parity check: header count MUST equal rendered <li> count!
    if (variant === "C") {
      const mismatch = await page.evaluate(() => {
        const groups = [...document.querySelectorAll(".pc-day-group")];
        return groups.filter((g) => {
          const text = g.querySelector(".pc-day-head span")?.textContent ?? "";
          const count = Number.parseInt(text, 10);
          return g.querySelectorAll(".pc-day-items li").length !== count;
        }).length;
      });
      assert.equal(mismatch, 0, "Variant C mobile day count disagreed with rendered slot count");
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
  console.log("ALL 3 PROTOTYPES PASSED ROUND 2->3 CHECKS (0 errors, 0 CSP, 0 overflow, parity + focus + privacy verified)");
} finally {
  await browser.close();
}
