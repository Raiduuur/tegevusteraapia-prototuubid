import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { PROVIDERS } from "../src/data/providers.ts";

const workingDirectory = fileURLToPath(new URL("../", import.meta.url));
const temp = await mkdtemp(join(tmpdir(), "ttk-live-"));
const origin = "https://ttk.example";
const now = new Date("2026-11-25T10:00:00Z");
const original = PROVIDERS.find((provider) => provider.id === "riin-saar");
const { slots: _exampleSlots, ...provider } = original;
const slots = ["11:00", "13:00"].map((at, index) => ({
  id: `opaque-${index}`, providerId: provider.id, at: `2026-11-26T${at}`, format: "kohal", minutes: 45,
  cents: 6000, condition: "Saatekiri pole vajalik.", location: "Tartu",
}));
let browser;
try {
  execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--outDir", temp, "--emptyOutDir"], {
    cwd: workingDirectory, env: { ...process.env, VITE_TTK_MODE: "live" },
  });
  const html = await readFile(join(temp, "index.html"), "utf8");
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const branches = [
    { label: "Lapsel on raske pliiatsit hoida või kääridega lõigata.", status: "lost-response" },
    { label: "Ei oska öelda, vajan nõu", status: "collision" },
  ];
  let comparison;
  for (const branch of branches) {
    const page = await browser.newPage();
    await page.clock.setFixedTime(now);
    const traffic = [], errors = [];
    let bookings = 0;
    let unavailable = false;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.route(`${origin}/**`, async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      traffic.push({ method: req.method(), path, body: req.postDataJSON() });
      if (path === "/") return route.fulfill({ body: html, contentType: "text/html" });
      if (path === "/api/ttk/public") return route.fulfill({ json: {
        providers: [provider], slots: unavailable ? slots.slice(1) : slots, courses: [], products: [], generatedAt: now.toISOString(),
      } });
      if (path === "/api/ttk/booking/status") return route.fulfill({ json: { status: "confirmed", reference: "AEG-FIXTURE" } });
      if (path === "/api/ttk/booking") {
        bookings++;
        if (bookings > 1) return route.fulfill({ json: { status: "confirmed", reference: "AEG-FIXTURE" } });
        unavailable = true;
        if (branch.status === "collision") return route.fulfill({ status: 409, json: {} });
        return route.abort("connectionreset");
      }
      throw new Error(`Unexpected request ${path}`);
    });
    await page.goto(origin);
    const hero = page.locator(".hero-photos img").first();
    assert(await hero.evaluate(async (image) => {
      await image.decode();
      return image.naturalWidth > 0;
    }));
    await page.getByRole("radio", { name: "Lapsele", exact: true }).check();
    await page.getByRole("radio", { name: branch.label, exact: true }).check();
    await page.getByRole("radio", { name: "Kohapeal", exact: true }).check();
    await page.locator("#wizard-place").fill("Tartu");
    await page.locator('[data-value="opaque-0"]').waitFor();
    assert(await page.locator(".provider-card").count() > 0);
    assert.equal(page.url(), `${origin}/`);
    assert.deepEqual(await page.evaluate(() => [history.state, localStorage.length, sessionStorage.length, document.cookie]), [null, 0, 0, ""]);
    assert.deepEqual(traffic, [
      { method: "GET", path: "/", body: null }, { method: "GET", path: "/api/ttk/public", body: null },
    ]);
    await page.locator('[data-value="opaque-0"]').click();
    await page.getByRole("textbox", { name: "Teie nimi" }).fill("Mari Näide");
    await page.getByRole("textbox", { name: "Telefoninumber" }).fill("+372 5123 4567");
    await page.getByRole("button", { name: "Broneeri aeg", exact: true }).click();
    if (branch.status === "collision") {
      await page.getByRole("heading", { name: "Valige teine aeg" }).waitFor();
      await page.locator('[data-action="pick-alternative"]').click();
      assert.equal(await page.getByRole("textbox", { name: "Teie nimi" }).inputValue(), "Mari Näide");
      await page.getByRole("button", { name: "Broneeri aeg", exact: true }).click();
    } else {
      const check = traffic.find((entry) => entry.path === "/api/ttk/booking/status");
      if (!check) await page.getByRole("heading", { name: "Aeg on broneeritud" }).waitFor();
      assert(traffic.some((entry) => entry.path === "/api/ttk/booking/status"));
      assert.equal(bookings, 1);
    }
    await page.getByRole("heading", { name: "Aeg on broneeritud" }).waitFor();
    const receipt = traffic.find((entry) => entry.path === "/api/ttk/booking");
    const { idempotencyKey, ...payload } = receipt.body;
    assert.match(idempotencyKey, /^[a-f0-9-]{36}$/);
    assert.deepEqual(payload, { slotId: "opaque-0", bookerName: "Mari Näide", phone: "+372 5123 4567" });
    if (comparison) assert.deepEqual(payload, comparison);
    comparison = payload;
    assert.equal(errors.filter((error) => !/Failed to load resource/.test(error)).length, 0);
    await page.close();
  }
  console.log("Live contract fixtures · identical finder traffic and booking payloads, lost-response recovery and slot collision passed");
} finally {
  await browser?.close();
  await rm(temp, { recursive: true, force: true });
}
