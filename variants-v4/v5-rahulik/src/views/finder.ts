// PROTOTYPE (UI.md Sub-shape A): Three structurally different variants of the Leia abi homepage, switchable via ?variant=A|B|C.
import { TASKS } from "../data/finder";
import type { AudienceId } from "../data/types";
import { findPlace, suggestPlaces } from "../data/places";
import { data, live, localTimeNow, store } from "../model";
import { currentVariant } from "./prototype-switcher";
import { ACTIVITY_GROUPS, renderVariantA, renderVariantADossierResults } from "./prototype-home-a";
import { renderVariantB, renderVariantBResults } from "./prototype-home-b";
import { renderVariantC, renderVariantCResults } from "./prototype-home-c";

const hasLocalMode = (format: string) => format === "kohal" || format === "kodu";
const scrollBehavior = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

class InstantMatchFinder extends HTMLElement {
  #availabilityTimer?: number;
  #openGroup = "";
  #selectedDay = "";
  #cFiltersOpen = false;
  #body!: HTMLElement;
  #status!: HTMLElement;

  connectedCallback(): void {
    this.#body = this.querySelector<HTMLElement>(".proto-home-body")!;
    this.#status = this.querySelector<HTMLElement>(".wizard-status")!;
    this.addEventListener("change", this.#onChange);
    this.addEventListener("click", this.#onClick);
    this.addEventListener("input", this.#onInput);
    this.#render();
    if (live) {
      let version = this.#availabilityVersion();
      this.#availabilityTimer = window.setInterval(() => {
        const next = this.#availabilityVersion();
        if (next !== version) {
          version = next;
          // Refresh only the results slot when the user is interacting with a form control.
          this.#updateResultsOnly();
        }
      }, 1000);
    }
  }

  disconnectedCallback(): void {
    window.clearInterval(this.#availabilityTimer);
  }

  #availabilityVersion(): string {
    return `${store.availability}|${data.generatedAt}|${localTimeNow()}`;
  }

  #onClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const groupBtn = target.closest<HTMLButtonElement>("[data-proto-group]");
    if (groupBtn) {
      const id = groupBtn.dataset.protoGroup ?? "";
      const nextOpen = this.#openGroup === id ? "" : id;
      this.#openGroup = nextOpen;
      // Always clear any previously chosen task when switching activity groups so tasks never bleed across groups.
      if (nextOpen === "ei-tea") {
        store.finder.task = "ei-tea";
      } else {
        store.finder.task = "";
      }
      if (nextOpen) {
        this.#render("#pa-dossier-title");
        const cushion = this.querySelector<HTMLElement>(".pa-dossier");
        cushion?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
      } else {
        const stoneSelector = `button.pa-stone[data-proto-group="${CSS.escape(id)}"]`;
        this.#render(stoneSelector);
        this.querySelector<HTMLElement>(stoneSelector)?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
      }
      return;
    }

    const filterToggle = target.closest<HTMLButtonElement>("[data-proto-toggle-filters]");
    if (filterToggle) {
      this.#cFiltersOpen = !this.#cFiltersOpen;
      this.#render("[data-proto-toggle-filters]");
      return;
    }

    const dayBtn = target.closest<HTMLButtonElement>("[data-proto-day]");
    if (dayBtn) {
      const strip = this.querySelector<HTMLElement>(".pc-day-strip");
      const priorScrollLeft = strip?.scrollLeft ?? 0;
      const iso = dayBtn.dataset.protoDay ?? "";
      this.#selectedDay = iso === "all" || this.#selectedDay === iso ? "" : iso;
      const focusKey = this.#selectedDay || "all";
      this.#render(`button[data-proto-day="${CSS.escape(focusKey)}"]`);
      const nextStrip = this.querySelector<HTMLElement>(".pc-day-strip");
      if (nextStrip) {
        nextStrip.scrollLeft = priorScrollLeft;
        const activePebble = nextStrip.querySelector<HTMLElement>(`button[data-proto-day="${CSS.escape(focusKey)}"]`);
        activePebble?.scrollIntoView({ behavior: "auto", inline: "nearest", block: "nearest" });
      }
      return;
    }

    const jump = target.closest<HTMLElement>("[data-proto-jump]");
    if (jump) {
      const selector = jump.dataset.protoJump;
      const dest = selector ? this.querySelector<HTMLElement>(selector) : null;
      if (dest) {
        dest.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        const focusTarget = dest.matches("[tabindex='-1']") ? dest : dest.querySelector<HTMLElement>("[tabindex='-1']");
        focusTarget?.focus({ preventScroll: true });
      }
    }
  };

  #onChange = (event: Event): void => {
    const target = event.target;
    const finder = store.finder;

    if (target instanceof HTMLSelectElement && target.dataset.protoSelect) {
      const kind = target.dataset.protoSelect;
      this.#selectedDay = "";
      if (kind === "audience") {
        finder.audience = target.value as AudienceId | "";
        finder.task = "";
      } else if (kind === "task") {
        finder.task = target.value;
        const picked = TASKS.find((t) => t.id === target.value);
        if (!finder.audience && picked) finder.audience = picked.audience;
      }
      this.#render(`select[data-proto-select="${kind}"]`);
      return;
    }

    if (!(target instanceof HTMLInputElement) || target.type !== "radio" || !target.checked) return;

    let focusSelector: string | undefined;
    if (target.name === "audience") {
      finder.audience = target.value as AudienceId;
      finder.task = "";
      this.#selectedDay = "";
      focusSelector = `input[name="audience"][value="${CSS.escape(target.value)}"]`;
    } else if (target.name === "task") {
      finder.task = target.value;
      this.#selectedDay = "";
      const picked = TASKS.find(({ id }) => id === target.value);
      if (!finder.audience && picked) {
        finder.audience = picked.audience;
      }
      focusSelector = `input[name="task"][value="${CSS.escape(target.value)}"]`;
    } else if (target.name === "format") {
      finder.format = target.value as typeof finder.format;
      this.#selectedDay = "";
      if (!hasLocalMode(finder.format)) {
        finder.place = "";
      }
      focusSelector = `input[name="format"][value="${CSS.escape(target.value)}"]`;
    }

    this.#render(focusSelector);
  };

  #onInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.id !== "wizard-place") return;
    store.finder.place = target.value;
    this.#selectedDay = "";
    // Update datalist & results container in place so typing never destroys the focused input or autocomplete popup.
    this.#syncDatalist();
    this.#updateResultsOnly();
  };

  #syncDatalist(): void {
    const datalist = this.querySelector<HTMLDataListElement>("#wizard-places");
    if (!datalist) return;
    datalist.replaceChildren(...suggestPlaces(store.finder.place).map((name) => new Option(name)));
    const hint = this.querySelector<HTMLElement>("#wizard-place-hint");
    if (hint) {
      hint.hidden = !store.finder.place.trim() || Boolean(findPlace(store.finder.place));
    }
  }

  #updateResultsOnly(): void {
    const container = this.querySelector<HTMLElement>("[data-proto-results]");
    if (!container) {
      this.#render();
      return;
    }
    const variant = currentVariant();
    if (variant === "A") {
      const group = ACTIVITY_GROUPS.find((g) => g.id === this.#openGroup);
      if (group) container.innerHTML = renderVariantADossierResults(group);
    } else if (variant === "B") {
      container.innerHTML = renderVariantBResults();
    } else {
      container.innerHTML = renderVariantCResults(this.#selectedDay);
    }
    this.#status.textContent = "Vabad ajad ja soovitused on uuendatud.";
  }

  #render(focusSelector?: string): void {
    const variant = currentVariant();
    const html = variant === "B"
      ? renderVariantB()
      : variant === "C"
        ? renderVariantC(this.#selectedDay, this.#cFiltersOpen)
        : renderVariantA(this.#openGroup);

    this.#body.innerHTML = html;
    this.#syncDatalist();

    if (focusSelector) {
      this.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
    }
    this.#status.textContent = store.finder.task || store.finder.audience || this.#selectedDay ? "Vabad ajad ja soovitused on uuendatud." : "";
  }
}

customElements.define("instant-match-finder", InstantMatchFinder);

export function finderView(): string {
  store.finder.format ||= "all";
  return `<instant-match-finder class="home">
    <div class="proto-home-body"></div>
    <p class="wizard-status visually-hidden" role="status"></p>
  </instant-match-finder>`;
}
