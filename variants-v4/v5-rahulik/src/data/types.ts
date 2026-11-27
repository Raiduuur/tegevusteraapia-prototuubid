/** Shared domain types. Every value in data/ is an example (näidis) for the prototype. */

export type AudienceId = "laps" | "ise" | "eakas" | "hooldaja" | "asutus";

export type Format = "kohal" | "kodu" | "video";


export type ProviderKind = "uksik" | "praksis" | "kliinik";

export type County =
  | "Harjumaa"
  | "Tartumaa"
  | "Pärnumaa"
  | "Ida-Virumaa"
  | "Lääne-Virumaa"
  | "Saaremaa"
  | "Hiiumaa"
  | "Viljandimaa"
  | "Võrumaa"
  | "Valgamaa"
  | "Põlvamaa"
  | "Jõgevamaa"
  | "Järvamaa"
  | "Raplamaa"
  | "Läänemaa";

/** Internal task tags. Providers declare them in their account; visitors never see them. */
export type Tag =
  | "kirjutamine"
  | "riietumine"
  | "soomine"
  | "sensoorne"
  | "uleminekud"
  | "kook"
  | "pesemine"
  | "haare"
  | "too"
  | "paevakava"
  | "kukkumine"
  | "siirdumine"
  | "kodu"
  | "abivahendid"
  | "meelespea"
  | "tootajad"
  | "ruumid";

export interface Slot {
  id: string;
  /** Local Europe/Tallinn wall-clock time, „2026-11-26T14:30“. */
  at: string;
  /** Prototype only: the slot is taken by someone else at the moment of booking. */
  takenOnSubmit?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  kind: ProviderKind;
  org: string;
  orgNote: string;
  /** Kutseregister certificate, always shown. */
  kutse: string;
  /** Terviseameti tegevusluba is required on every published page of a healthcare provider (RekS § 22 lg 3). */
  licence?: string;
  verifiedVia: "Smart-ID" | "Mobiil-ID" | "ID-kaart";
  city: string;
  municipality?: string;
  county: County;
  homeCounties: County[];
  formats: Format[];
  audiences: AudienceId[];
  tags: Tag[];
  languages: string[];
  visit: { minutes: number; price: number };
  funding: string;
  /** Accepts a first conversation for visitors who answered „Ei oska öelda, vajan nõu“. */
  firstConversation: boolean;
  /** The provider confirms each request by hand: the button is „Saada aja soov“. */
  requestOnly?: boolean;
  slots: Slot[];
  contact: { phone: string; email: string; hours: string };
  /** Added in this browser session from the therapist dashboard. */
  isNew?: boolean;
}
