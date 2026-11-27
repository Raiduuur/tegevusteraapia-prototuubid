import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const distUrl = new URL("../../../deploy-bundle/v5-rahulik/index.html", import.meta.url);
const shotsDir = new URL("../qa-shots/", import.meta.url);
await mkdir(shotsDir, { recursive: true });

const expected = [
  { id: "source", head: "Source Sans 3", body: "Source Sans 3" },
  { id: "rubik", head: "Rubik", body: "Rubik" },
  { id: "lexend", head: "Lexend", body: "Lexend" },
  { id: "literata", head: "Literata", body: "Source Sans 3" },
  { id: "fraunces", head: "Fraunces", body: "Source Sans 3" },
  { id: "bitter", head: "Bitter", body: "IBM Plex Sans" },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // 1. Load default and switch live via postMessage (same path as the outer bar)
  await page.goto(`${distUrl.href}?v=20261126-f2&style=a&tone=sinine&font=source`, { waitUntil: "networkidle" });
  for (const item of expected) {
    await page.evaluate((font) => {
      window.postMessage({ type: "ttk-theme", style: "a", tone: "sinine", font }, "*");
    }, item.id);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const h1Style = getComputedStyle(h1);
      const bodyStyle = getComputedStyle(document.body);
      const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/^["']|["']$/g, ""));
      return {
        dataFont: document.documentElement.dataset.font,
        h1Font: h1Style.fontFamily,
        bodyFont: bodyStyle.fontFamily,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        loaded: [...new Set(loaded)],
      };
    });
    assert.equal(info.dataFont, item.id, `data-font mismatch for ${item.id}`);
    assert(info.h1Font.includes(item.head), `Expected h1 to use ${item.head}, got ${info.h1Font}`);
    assert(info.bodyFont.includes(item.body), `Expected body to use ${item.body}, got ${info.bodyFont}`);
    assert.equal(info.overflow, false, `Horizontal overflow at 1440 for font ${item.id}`);
    console.log(`${item.id.padEnd(9)} | h1=${info.h1Font.split(",")[0]} | body=${info.bodyFont.split(",")[0]} | loaded=[${info.loaded.join(", ")}]`);
    if (["fraunces", "rubik", "bitter"].includes(item.id)) {
      await page.screenshot({
        path: fileURLToPath(new URL(`1440-font-${item.id}.png`, shotsDir)),
        clip: { x: 0, y: 0, width: 1440, height: 820 },
      });
    }
  }

  // 2. Verify mobile 390px overflow for widest font (Lexend) and Fraunces
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ["lexend", "fraunces", "bitter"]) {
    await page.evaluate((font) => {
      window.postMessage({ type: "ttk-theme", style: "a", tone: "sinine", font }, "*");
    }, id);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `Horizontal overflow at 390 for font ${id}`);
  }

  assert.equal(errors.length, 0, `Console/page errors: ${errors.join("; ")}`);
  console.log("ALL 6 FONTS VERIFIED (0 errors, 0 overflow at 1440 & 390)");
} finally {
  await browser.close();
}
