import { productById, store } from "./model";
import type { Product } from "./data/catalog";

export interface Booker { name: string; contact: string; kind: "phone" | "email" }
export interface Receipt { reference: string; status: "confirmed" | "pending" }

const privateDetails = /(?:^|[^\p{L}])(?:isikukood\p{L}*|diagnoos\p{L}*|insult\p{L}*|autism\p{L}*|dements\p{L}*|diabeet\p{L}*|parkinson\p{L}*|adhd|ath|depressioon\p{L}*|epileps\p{L}*|trauma\p{L}*|skisofreen\p{L}*|vähk|covid)(?=$|[^\p{L}])/iu;
const nationalId = /(?:^|[^+\d])[1-8](?:[\s-]*\d){10}(?![\s-]*\d)/u;
export const protectedDetail = (value: string) => privateDetails.test(value) || nationalId.test(value);
export const sensitiveError = "Jätke siia ainult nimi ja kontakt. Isikukoodi ega terviseandmeid pole vaja.";
export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@.]+$/u.test(value);
export const validPhone = (value: string) => /^\+?\d[\d\s().-]{5,24}$/.test(value) && value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 15;
export const validName = (value: string) => /^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]{0,89}$/u.test(value);
export const contactError = (kind: string) => kind === "email" ? "Kontrollige e-posti aadressi, näiteks nimi@näide.ee." : "Sisestage telefoninumber, näiteks 5123 456.";
export const read = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export function bookerFrom(form: FormData): Booker | string {
  const name = read(form, "name"), contact = read(form, "contact");
  const kind = read(form, "kind") === "email" ? "email" : "phone";
  if (protectedDetail(name) || protectedDetail(contact)) return sensitiveError;
  if (!validName(name)) return "Sisestage oma nimi.";
  if (!(kind === "email" ? validEmail(contact) : validPhone(contact))) return contactError(kind);
  return { name, contact, kind };
}

export interface CartLine { product: Product; quantity: number }
export const activeLines = (): CartLine[] => [...store.cart].flatMap(([id, quantity]) => {
  const product = productById(id);
  return product ? [{ product, quantity }] : [];
});

const key = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const transactionKey = key;
export const demoReceipt = (prefix: string) => `${prefix}-${key().slice(-8).toUpperCase()}`;
