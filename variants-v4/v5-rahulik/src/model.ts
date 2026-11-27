import { COURSES, PRODUCTS, type Course, type Product, type TrainingAudience, CATEGORIES } from "./data/catalog";
import { PROVIDERS } from "./data/providers";
import { TASKS, UNSURE, type Task } from "./data/finder";
import { findPlace } from "./data/places";
import type { AudienceId, County, Format, Provider, ProviderKind } from "./data/types";

export const live = import.meta.env.VITE_TTK_MODE === "live";
const configuredPhone = String(import.meta.env.VITE_TTK_PHONE ?? "");
export const helpline = live ? (/^\+372[\d ]{7,13}$/.test(configuredPhone) ? configuredPhone : "") : "+372 5555 0123";
export const today = () => live ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Tallinn" }).format(new Date()) : "2026-11-25";
export const FORMATS = { kohal: "Kohapeal", kodu: "Koduvisiit", video: "Videokõne", all: "Kõik kohtumisviisid" } as const;
export const KINDS: Record<ProviderKind, string> = { uksik: "Üksikspetsialist", praksis: "Väike praksis", kliinik: "Suur kliinik" };
export const REGIONS = {
  Harjumaa: "Tallinn ja Harjumaa", Tartumaa: "Tartu ja Tartumaa", Pärnumaa: "Pärnu ja Pärnumaa",
  "Lääne-Virumaa": "Rakvere ja Lääne-Virumaa", "Ida-Virumaa": "Narva ja Ida-Virumaa", Viljandimaa: "Viljandi ja Viljandimaa",
  Saaremaa: "Saaremaa", Hiiumaa: "Hiiumaa", Läänemaa: "Läänemaa", Raplamaa: "Raplamaa",
  Järvamaa: "Järvamaa", Jõgevamaa: "Jõgevamaa", Põlvamaa: "Põlvamaa", Valgamaa: "Valgamaa", Võrumaa: "Võrumaa",
} satisfies Record<County, string>;
export const QUICK_REGIONS = (Object.keys(REGIONS) as County[]).slice(0, 7);
export type View = "leia-abi" | "terapeudid" | "koolituskalender" | "e-pood" | "spetsialistile";
export const VIEWS: Record<View, string> = { "leia-abi": "Leia abi", terapeudid: "Terapeudid ja kaart", koolituskalender: "Koolituskalender", "e-pood": "E-pood", spetsialistile: "Spetsialistile" };
export type Region = County | "all" | "video";
type Funding = "all" | "Tasuline" | "Tervisekassa" | "SKA";
interface Finder { step: number; audience: AudienceId | ""; task: string; format: Format | "all" | ""; region: Region; place: string; error: string }
export const newFinder = (): Finder => ({ step: 1, audience: "", task: "", format: "", region: "all", place: "", error: "" });

export interface VisitSlot {
  id: string;
  providerId: string;
  at: string;
  format: Format;
  minutes: number;
  cents: number;
  location: string;
  condition: string;
  requestOnly?: boolean;
  demoTaken?: boolean;
}
export type DirectoryProvider = Omit<Provider, "slots" | "requestOnly">;
type PublicData = { providers: DirectoryProvider[]; slots: VisitSlot[]; courses: Course[]; products: Product[]; generatedAt: string };
export interface Staff { id: string; name: string; clearance: "verified"; provider: DirectoryProvider }
export const store = {
  view: "leia-abi" as View,
  finder: newFinder(),
  directory: { region: "all" as Region, audience: "all" as AudienceId | "all", kind: "all" as ProviderKind | "all", funding: "all" as Funding, week: false },
  calendar: { month: live ? today().slice(0, 7) : "2026-12", audience: "Kõik" as TrainingAudience, selected: "kirjutamine" },
  shop: { category: "Kõik" as (typeof CATEGORIES)[number], more: false, query: "", pdf: false },
  cart: new Map<string, number>(),
  checkout: { bank: "", delivery: "", consent: false },
  staff: undefined as Staff | undefined,
  menu: false,
  availability: (live ? "loading" : "fresh") as "loading" | "fresh" | "stale",
};

const INITIAL_SLOTS = PROVIDERS.flatMap((provider) => provider.slots.map((slot, index): VisitSlot => {
  const format = provider.formats[index % provider.formats.length] ?? "kohal";
  return {
    id: slot.id, providerId: provider.id, at: slot.at, format, minutes: provider.visit.minutes,
    cents: (provider.visit.price + (format === "kodu" && provider.id === "riin-saar" ? 15 : 0)) * 100,
    location: format === "video" ? "Veebis" : format === "kodu" ? "Teie juures" : provider.city,
    condition: format !== "kodu" && provider.id === "riin-saar" ? "Saatekiri pole vajalik." : provider.funding,
    demoTaken: slot.id === "s-rs-4",
  };
}));
export const data: PublicData = live ? { providers: [], slots: [], courses: [], products: [], generatedAt: "" }
  : { providers: [...PROVIDERS], slots: INITIAL_SLOTS, courses: [...COURSES], products: PRODUCTS, generatedAt: "" };

const tallinnTime = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Tallinn", dateStyle: "short", timeStyle: "short" });
export function localTimeNow(): string {
  return live ? tallinnTime.format(new Date()).replace(" ", "T") : "2026-11-25T12:00";
}
export function weekEnd(): string {
  const day = new Date(`${today()}T12:00Z`);
  day.setUTCDate(day.getUTCDate() + (7 - (day.getUTCDay() || 7)));
  return day.toISOString().slice(0, 10);
}
export function slotsFor(id: string, format?: Format | "all" | "", week = false): VisitSlot[] {
  if (store.availability !== "fresh") return [];
  const now = localTimeNow();
  const end = week ? weekEnd() : undefined;
  return data.slots.filter((slot) => slot.providerId === id && slot.at >= now &&
    (!end || slot.at.slice(0, 10) <= end) && (!format || format === "all" || slot.format === format))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function providerCovers(provider: DirectoryProvider, region: Region, format?: Format | "all" | ""): boolean {
  if (region === "video") return provider.formats.includes("video");
  if (format && format !== "all" && !provider.formats.includes(format)) return false;
  if (region === "all" || format === "video") return true;
  if (format === "kodu") return provider.homeCounties.includes(region);
  if (format === "kohal") return provider.county === region;
  return (provider.formats.includes("kohal") && provider.county === region) || provider.homeCounties.includes(region);
}

export function regionSlots(provider: DirectoryProvider, region: Region, week = false): VisitSlot[] {
  return slotsFor(provider.id, region === "video" ? "video" : "all", week).filter((slot) =>
    region === "all" || region === "video" || providerCovers(provider, region, slot.format) && slot.format !== "video");
}

export function directoryProviders(region = store.directory.region): DirectoryProvider[] {
  const { audience, kind, funding, week } = store.directory;
  return data.providers.filter((provider) =>
    providerCovers(provider, region)
    && (audience === "all" || provider.audiences.includes(audience))
    && (kind === "all" || provider.kind === kind)
    && (funding === "all" || funding === "Tasuline" && provider.visit.price > 0 || funding !== "Tasuline" && provider.funding.includes(funding))
    && (!week || regionSlots(provider, region, true).length > 0));
}

function finderVisitFilters() {
  const { format, region, place: input, task } = store.finder;
  const place = format === "video" ? undefined : findPlace(input);
  return { format, region: format === "video" ? "all" as const : place?.county ?? region, place,
    videoOk: TASKS.find(({ id }) => id === task)?.videoOk ?? true };
}

function finderModeMatches(p: DirectoryProvider, mode: Format, filters: ReturnType<typeof finderVisitFilters>): boolean {
  const { format, region, place, videoOk } = filters;
  if (format !== "all" && format !== mode) return false;
  if (mode === "video") return videoOk && region === "all";
  if (place && mode === "kohal") {
    const name = place.name.toLocaleLowerCase("et");
    const city = p.city.toLocaleLowerCase("et");
    if (name !== city && name !== `${city} linn` && p.municipality?.toLocaleLowerCase("et") !== name) return false;
  }
  return providerCovers(p, region, mode);
}

export function finderMatches(): { task: Task | typeof UNSURE; providers: DirectoryProvider[]; courses: Course[] } {
  const { audience, task: chosen } = store.finder;
  const { format, region, place } = finderVisitFilters();
  const task = TASKS.find(({ id }) => id === chosen) ?? UNSURE;
  const primaryTag = "tags" in task ? task.tags[0] : undefined;
  const filters = finderVisitFilters();
  const rank = (provider: DirectoryProvider) => selectedFinderSlots(provider)[0]?.at ?? "9999";
  const providers = data.providers.filter((provider) =>
    (!audience || provider.audiences.includes(audience))
    && (primaryTag ? provider.tags.includes(primaryTag) : provider.firstConversation)
    && provider.formats.some((mode) => finderModeMatches(provider, mode, filters)))
    .sort((a, b) => rank(a).localeCompare(rank(b)) || a.name.localeCompare(b.name, "et"));
  const courses = data.courses.filter((course) => course.date >= today() && course.seats > 0
    && audience && course.eligible.includes(audience) && (!primaryTag || course.tags.includes(primaryTag))
    && (region === "all" || !course.county || region === course.county)
    && (!place || !course.county || course.place.toLocaleLowerCase("et").startsWith(place.name.toLocaleLowerCase("et")))
    && (format !== "video" || !course.county)).sort((a, b) => a.date.localeCompare(b.date));
  return { task, providers, courses };
}

export function selectedFinderSlots(provider: DirectoryProvider): VisitSlot[] {
  const filters = finderVisitFilters();
  return slotsFor(provider.id, filters.format).filter((slot) => finderModeMatches(provider, slot.format, filters));
}

export function finderRegionLabel(): string {
  const { region, place } = finderVisitFilters();
  return place?.name ?? (region === "video" ? "Veebikohtumised" : region === "all" ? "Kogu Eesti" : REGIONS[region]);
}

/** Opens the directory with a single, clean region filter (used by overview town chips). */
export function presetDirectory(region: Region): void {
  store.directory = { region, audience: "all", kind: "all", funding: "all", week: false };
}

/** Opens the training calendar on the exact month and course. */
export function presetCalendar(course: Course): void {
  store.calendar = { month: course.date.slice(0, 7), audience: "Kõik", selected: course.id };
}

export function upcomingCourses(): Course[] {
  return data.courses.filter((course) => course.date >= today() && course.seats > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

/** Verified therapists ordered by their earliest open slot, filtered by the finder's „Kohtumisviis“ and place. */
export function nextOpenProviders(limit = 3): { person: DirectoryProvider; slots: VisitSlot[] }[] {
  return data.providers.map((person) => ({ person, slots: selectedFinderSlots(person) }))
    .filter(({ slots }) => slots.length > 0)
    .sort((a, b) => a.slots[0]!.at.localeCompare(b.slots[0]!.at) || a.person.name.localeCompare(b.person.name, "et"))
    .slice(0, limit);
}

export const productById = (id: string) => data.products.find((product) => product.id === id);
export const courseById = (id: string) => data.courses.find((course) => course.id === id);
export const providerById = (id: string) => data.providers.find((provider) => provider.id === id);
export const cartCount = () => [...store.cart.values()].reduce((sum, count) => sum + count, 0);

export function moveMonth(month: string, amount: number): string {
  const date = new Date(`${month}-01T12:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export function safelyNavigate(url: string, allowedHosts: string[]): void {
  const target = new URL(url, location.origin);
  if (target.origin !== location.origin && (target.protocol !== "https:" || !allowedHosts.includes(target.hostname))) {
    throw new Error("Teenuse aadressi ei saanud kinnitada.");
  }
  location.assign(target);
}

export class ServiceError extends Error {
  constructor(readonly status: number) {
    super("Teenusega ei õnnestunud ühendust saada. Proovige uuesti.");
  }
}

export async function request<T>(path: string, payload?: object): Promise<T> {
  if (!live || !location.protocol.startsWith("http")) throw new ServiceError(503);
  const response = await fetch(`/api/ttk/${path}`, {
    method: payload ? "POST" : "GET", body: payload ? JSON.stringify(payload) : undefined,
    headers: payload ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    credentials: "same-origin", referrerPolicy: "no-referrer", redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new ServiceError(response.status);
  return response.json() as Promise<T>;
}

const reservedSlots = new Set<string>();
export function reserveLocally(id: string): void {
  reservedSlots.add(id);
  data.slots = data.slots.filter((slot) => slot.id !== id);
}
export function releaseLocally(id: string): void {
  reservedSlots.delete(id);
}

export async function refreshPublicData(): Promise<void> {
  try {
    const snapshot = await request<PublicData>("public");
    const age = Date.now() - Date.parse(snapshot.generatedAt);
    if (!Number.isFinite(age) || age < -60_000 || age > 5 * 60_000 ||
        ![snapshot.providers, snapshot.slots, snapshot.courses, snapshot.products].every(Array.isArray)) throw new ServiceError(503);
    if (data.generatedAt && Date.parse(data.generatedAt) > Date.parse(snapshot.generatedAt)) return;
    Object.assign(data, { ...snapshot, slots: snapshot.slots.filter((slot) => !reservedSlots.has(slot.id)) });
    store.availability = "fresh";
  } catch {
    store.availability = "stale";
  }
}
