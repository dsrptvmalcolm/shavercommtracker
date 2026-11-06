import { money0 } from "../format";
import { vehicleTitle, type Vehicle } from "./vehicle";

// Facebook Marketplace copy, built from a fixed template. Only facts from the feed — no invented claims.

const MAX_HIGHLIGHTS = 8;
const MAX_HIGHLIGHT_LENGTH = 60;

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

/** Short `<li>` items from the feed's HTML description (package contents, features). */
export const highlights = (descriptionHtml: string): string[] => {
  const items = [...descriptionHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter((t) => t !== "" && t.length <= MAX_HIGHLIGHT_LENGTH && !t.includes("<"));
  return [...new Set(items)].slice(0, MAX_HIGHLIGHTS);
};

/** AUTOMATIC → Automatic; 4X4, AWD, SUV stay as they are. */
const tidy = (token: string) => (/^[A-Z]{4,}$/.test(token) ? token[0] + token.slice(1).toLowerCase() : token);

const known = (s: string) => s.trim() !== "" && s.trim().toLowerCase() !== "other";

export const marketplaceDescription = (v: Vehicle, listingPhone: string): string => {
  const priceMiles = [v.price === null ? "" : money0(v.price), v.mileage === null ? "" : `${v.mileage.toLocaleString("en-US")} miles`]
    .filter(Boolean)
    .join(" · ");
  const colors = [
    known(v.exteriorColor) ? `Exterior: ${v.exteriorColor.trim()}` : "",
    known(v.interiorColor) ? `Interior: ${v.interiorColor.trim()}` : "",
  ].filter(Boolean);
  const specs = [v.drivetrain, v.transmission, v.fuelType, v.bodyStyle].filter(known).map((s) => tidy(s.trim())).join(" · ");
  const list = highlights(v.descriptionHtml);
  const dealer = [v.dealerName, v.dealerAddress].filter((s) => s.trim() !== "");

  const blocks: string[][] = [
    [vehicleTitle(v), priceMiles].filter(Boolean),
    [...colors, specs].filter(Boolean),
    list.length ? ["Highlights:", ...list.map((h) => `• ${h}`)] : [],
    [`Stock #${v.stockNumber} · VIN ${v.vin}`],
    [...dealer, `Call ${listingPhone} or send us a message here.`],
  ];
  return blocks
    .filter((b) => b.length > 0)
    .map((b) => b.join("\n"))
    .join("\n\n");
};

/** The three values pasted into Facebook's form fields. Price is plain digits (the field wants a number). */
export const marketplaceDetails = (v: Vehicle): { vin: string; title: string; price: string } => ({
  vin: v.vin,
  title: vehicleTitle(v),
  price: v.price === null ? "" : String(Math.round(v.price)),
});
