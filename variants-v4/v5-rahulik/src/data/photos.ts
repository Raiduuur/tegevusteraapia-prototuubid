/**
 * Every photo the site shows. Files are cut by scripts/make-photos.sh from the
 * verified originals in assets/. No view state shows the same photo twice and
 * no photo stands in for a product or therapist it does not show.
 */
import heroChild from "../../assets/derived/hero-child.jpg";
import heroSeniors from "../../assets/derived/hero-seniors.jpg";
import tileCeramic from "../../assets/derived/tile-ceramic.jpg";
import tileMug from "../../assets/derived/tile-mug.jpg";
import tilePencilsA from "../../assets/derived/tile-pencils-a.jpg";
import tilePencilsB from "../../assets/derived/tile-pencils-b.jpg";
import tileTea from "../../assets/derived/tile-tea.jpg";
import wideCeramic from "../../assets/derived/wide-ceramic.jpg";
import wideMug from "../../assets/derived/wide-mug.jpg";
import widePen from "../../assets/derived/wide-pen.jpg";
import widePencils from "../../assets/derived/wide-pencils.jpg";
import wideSeniors from "../../assets/derived/wide-seniors.jpg";
import wideToy from "../../assets/derived/wide-toy.jpg";
import wideWorkshop from "../../assets/derived/wide-workshop.jpg";
import type { Course, Product } from "./catalog";
import { h } from "../ui";

export const PHOTOS = {
  heroChild, heroSeniors, tileCeramic, tileMug, tilePencilsA, tilePencilsB, tileTea,
  wideCeramic, wideMug, widePen, widePencils, wideSeniors, wideToy, wideWorkshop,
} as const;

const TINTS = ["mist", "oat", "blush"] as const;

/** Honest initials plate until real therapist portraits are supplied by the API. */
export function portrait(person: { id: string; name: string } | undefined, _size = 64): string {
  const initials = (person?.name ?? "").split(/\s+/).map((part) => part.charAt(0)).slice(0, 2).join("").toLocaleUpperCase("et");
  const tint = TINTS[[...(person?.id ?? "")].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % TINTS.length];
  return `<span class="portrait mono tint-${tint}" aria-hidden="true">${h(initials)}</span>`;
}

/** Honest product media: printable A4 sheet preview for PDFs, typographic specs for physical aids until real product photos exist. */
export function productMedia(product: Product): string {
  if (product.digital) return `<span class="tile-media sheet" aria-hidden="true"><b>${h(product.name)}</b><i>A4 · PDF</i></span>`;
  return "";
}

/** Course photo by the first tag that has a matching picture. */
export function coursePhotoFor(course: Pick<Course, "tags" | "audience">): string {
  for (const tag of course.tags) {
    if (tag === "kirjutamine") return widePencils;
    if (tag === "sensoorne" || tag === "uleminekud") return wideToy;
    if (tag === "soomine" || tag === "riietumine" || tag === "pesemine") return course.audience === "Hooldekodud" ? wideCeramic : wideSeniors;
    if (tag === "too") return widePen;
    if (tag === "kodu" || tag === "kukkumine" || tag === "siirdumine") {
      return course.audience === "Spetsialistid" || course.audience === "Lasteaiad ja koolid" ? wideWorkshop : wideSeniors;
    }
  }
  return wideMug;
}
