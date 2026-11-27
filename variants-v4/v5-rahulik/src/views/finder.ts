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

class InstantMatchFinder extends HTMLElement {
  #availabilityTimer?: number;
  #openGroup = "";
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
      if (nextOpen === "ei-tea") {
        store.finder.task = "ei-tea";
      } else if (nextOpen) {
        // Clear any task that does not belong to the newly opened activity group.
        const group = ACTIVITY_GROUPS.find((g) => g.id === nextOpen);
        const picked = TASKS.find((t) => t.id === store.finder.task);
        if (!group || !picked || !picked.tags.some((tag) => group.tags.includes(tag))) {
          store.finder.task = "";
        }
      }
      this.#render(`button[data-proto-group="${CSS.escape(id)}"]`);
      return;
    }

    const jump = target.closest<HTMLElement>("[data-proto-jump]");
    if (jump) {
      const selector = jump.dataset.protoJump;
      const dest = selector ? this.querySelector<HTMLElement>(selector) : null;
      dest?.scrollIntoView({ behavior: "smooth", block: "start" });
      dest?.querySelector<HTMLElement>("[tabindex='-1']")?.focus({ preventScroll: true });
    }
  };

  #onChange = (event: Event): void => {
    const target = event.target;
    const finder = store.finder;

    if (target instanceof HTMLSelectElement && target.dataset.protoSelect) {
      const kind = target.dataset.protoSelect;
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
      focusSelector = `input[name="audience"][value="${CSS.escape(target.value)}"]`;
    } else if (target.name === "task") {
      finder.task = target.value;
      const picked = TASKS.find(({ id }) => id === target.value);
      if (!finder.audience && picked) {
        finder.audience = picked.audience;
      }
      focusSelector = `input[name="task"][value="${CSS.escape(target.value)}"]`;
    } else if (target.name === "format") {
      finder.format = target.value as typeof finder.format;
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
      container.innerHTML = renderVariantCResults();
    }
    this.#status.textContent = "Vabad ajad ja soovitused on uuendatud.";
  }

  #render(focusSelector?: string): void {
    const variant = currentVariant();
    const html = variant === "B"
      ? renderVariantB()
      : variant === "C"
        ? renderVariantC()
        : renderVariantA(this.#openGroup);

    this.#body.innerHTML = html;
    this.#syncDatalist();

    if (focusSelector) {
      this.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
    }
    this.#status.textContent = store.finder.task || store.finder.audience ? "Vabad ajad ja soovitused on uuendatud." : "";
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
