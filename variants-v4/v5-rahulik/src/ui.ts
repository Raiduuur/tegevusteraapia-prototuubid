import { helpline, type View, VIEWS } from "./model";

export function h(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (letter) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[letter] ?? letter);
}
export const euro = (cents: number) => `${new Intl.NumberFormat("et-EE", { maximumFractionDigits: 2, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)} €`;
const weekDays = ["P", "E", "T", "K", "N", "R", "L"];
const formatter = new Intl.DateTimeFormat("et-EE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const fullDate = (iso: string) => formatter.format(new Date(`${iso.slice(0, 10)}T12:00Z`));
export function shortSlot(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  const weekday = weekDays[new Date(`${year}-${month}-${day}T12:00Z`).getUTCDay()];
  return `${weekday} ${day}.${month} · ${iso.slice(11, 16)}`;
}
export const nav = (view: View, label = VIEWS[view], css = "text-link") =>
  `<a class="${css}" href="#${view}" data-nav="${view}">${h(label)}</a>`;
export const call = (label = "Helista meile") => helpline
  ? `<a class="text-link" href="tel:${helpline.replace(/\s/g, "")}">${h(label)}</a>`
  : "";
export const pageHead = (title: string, intro: string, action = "") =>
  `<div class="page-head"><div><h1 id="page-title" tabindex="-1">${h(title)}</h1><p>${h(intro)}</p></div>${action}</div>`;
export const btn = (label: string, action: string, value = "", css = "button secondary") =>
  `<button type="button" class="${css}" data-action="${action}" data-value="${h(value)}">${h(label)}</button>`;
export const option = (value: string, label: string, active: string) =>
  `<option value="${h(value)}"${active === value ? " selected" : ""}>${h(label)}</option>`;
export const formError = (id: string, error: string) => `<p id="${id}" class="field-error" tabindex="-1"${error ? "" : " hidden"}>${h(error)}</p>`;
