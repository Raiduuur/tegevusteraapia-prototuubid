// PROTOTYPE (UI.md Sub-shape A): Three structurally different variants of the Leia abi homepage, switchable via ?variant=A|B|C.
import { live, store } from "../model";
import { h } from "../ui";

export type PrototypeVariantId = "A" | "B" | "C";

export interface PrototypeVariantMeta {
  id: PrototypeVariantId;
  name: string;
  subtitle: string;
}

export const PROTOTYPE_VARIANTS: readonly PrototypeVariantMeta[] = [
  { id: "A", name: "Teatmik", subtitle: "tegevuste indeks" },
  { id: "B", name: "Vastuvõtt", subtitle: "asutajate kiri" },
  { id: "C", name: "Nädalaplaan", subtitle: "vabade aegade ajakava" },
] as const;

/** Gate switcher off in live production builds so a stray merge cannot ship evaluation chrome. */
export const PROTOTYPE_SWITCHER_ENABLED = !live;

const VALID = new Set<string>(PROTOTYPE_VARIANTS.map((v) => v.id));

export function readVariantFromUrl(): PrototypeVariantId {
  if (!PROTOTYPE_SWITCHER_ENABLED) return "A";
  const raw = new URLSearchParams(location.search).get("variant")?.trim().toUpperCase();
  return raw && VALID.has(raw) ? (raw as PrototypeVariantId) : "A";
}

let activeVariant: PrototypeVariantId = readVariantFromUrl();

export function currentVariant(): PrototypeVariantId {
  return PROTOTYPE_SWITCHER_ENABLED ? activeVariant : "A";
}

export function variantMeta(id: PrototypeVariantId = activeVariant): PrototypeVariantMeta {
  return PROTOTYPE_VARIANTS.find((v) => v.id === id) ?? PROTOTYPE_VARIANTS[0]!;
}

export function applyVariantToDocument(id: PrototypeVariantId): void {
  activeVariant = PROTOTYPE_SWITCHER_ENABLED ? id : "A";
  document.documentElement.dataset.variant = activeVariant;
  if (!PROTOTYPE_SWITCHER_ENABLED) return;
  try {
    const url = new URL(location.href);
    url.searchParams.set("variant", activeVariant);
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {
    // file:// URLs may restrict replaceState on some browsers; keep in-memory state working.
  }
}

export function cycleVariant(delta: -1 | 1): PrototypeVariantId {
  const index = PROTOTYPE_VARIANTS.findIndex((v) => v.id === activeVariant);
  const next = PROTOTYPE_VARIANTS[(index + delta + PROTOTYPE_VARIANTS.length) % PROTOTYPE_VARIANTS.length]!.id;
  applyVariantToDocument(next);
  return next;
}

export function mountPrototypeSwitcher(onChange: (next: PrototypeVariantId) => void): () => void {
  applyVariantToDocument(activeVariant);
  if (!PROTOTYPE_SWITCHER_ENABLED) return () => {};

  let bar = document.querySelector<HTMLElement>(".proto-switcher");
  if (!bar) {
    bar = document.createElement("aside");
    bar.className = "proto-switcher";
    bar.setAttribute("aria-label", "Avalehe prototüüpide vahetaja");
    // Build persistent button nodes once so clicking never destroys the focused button.
    bar.innerHTML = `<button type="button" class="proto-sw-btn" data-proto-step="-1" aria-label="Eelmine prototüüp">←</button>
      <span class="proto-sw-label" aria-live="polite"></span>
      <button type="button" class="proto-sw-btn" data-proto-step="1" aria-label="Järgmine prototüüp">→</button>`;
    document.body.appendChild(bar);
  }

  const label = bar.querySelector<HTMLElement>(".proto-sw-label")!;
  const updateBar = () => {
    const meta = variantMeta(activeVariant);
    label.innerHTML = `<strong>${h(meta.id)} · ${h(meta.name)}</strong><span>(${h(meta.subtitle)})</span>`;
    bar!.hidden = store.view !== "leia-abi";
  };

  updateBar();

  bar.addEventListener("click", (event) => {
    const btn = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-proto-step]") : null;
    if (!btn) return;
    const step = btn.dataset.protoStep === "-1" ? -1 : 1;
    const next = cycleVariant(step);
    updateBar();
    onChange(next);
  });

  window.addEventListener("keydown", (event) => {
    if (store.view !== "leia-abi") return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (document.querySelector("dialog[open]")) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && (el.matches("input, textarea, select, [contenteditable='true']") || el.isContentEditable)) return;
    event.preventDefault();
    const next = cycleVariant(event.key === "ArrowLeft" ? -1 : 1);
    updateBar();
    onChange(next);
  });

  return updateBar;
}
