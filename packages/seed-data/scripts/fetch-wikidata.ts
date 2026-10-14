/**
 * Fetches the most popular movies, books, video games and TV series from
 * Wikidata and writes a normalized snapshot to data/media.json.
 *
 * Wikidata structured data is CC0 (public domain), so the snapshot can be
 * committed and redistributed freely. This script is for maintainers only:
 * students use the committed snapshot and never hit the network.
 *
 * Images: each item gets a file from Wikimedia Commons (its poster, logo or image on Wikidata)
 * with the license and author to credit. Files are linked, never copied.
 *
 * Usage: pnpm --filter @media-tracker/seed-data fetch-wikidata
 *        pnpm --filter @media-tracker/seed-data fetch-wikidata --images
 *          (only refreshes the images of the committed snapshot: the rest stays as it is)
 */
import { readFile, writeFile } from "node:fs/promises";
import { IMAGE_KINDS, MEDIA_TYPES } from "../src/types.ts";
import type { Media, MediaImage, MediaType, SnapshotMeta } from "../src/types.ts";

const USER_AGENT =
  "rest-mongodb-graphql-course-seed/1.0 (educational project; https://www.wikidata.org/wiki/Wikidata:Data_access)";
const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const API_ENDPOINT = "https://www.wikidata.org/w/api.php";
const COMMONS_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
// Commons serves thumbnails in fixed widths (250, 330, 500...): ask for one of those.
const THUMBNAIL_WIDTH = 500;
const BATCH_SIZE = 50; // wbgetentities limit for anonymous clients
const MAX_CAST = 8;

interface TypeConfig {
  /** SPARQL triple patterns selecting ?item. */
  where: string;
  /** Minimum sitelinks: keeps the query fast (sorting a whole class times out). */
  minSitelinks: number;
  limit: number;
}

const CONFIG: Record<MediaType, TypeConfig> = {
  movie: { where: "?item wdt:P31 wd:Q11424.", minSitelinks: 60, limit: 300 },
  // Literary works whose form is "novel".
  book: { where: "?item wdt:P7937 wd:Q8261. ?item wdt:P31 wd:Q7725634.", minSitelinks: 30, limit: 300 },
  game: { where: "?item wdt:P31 wd:Q7889.", minSitelinks: 30, limit: 200 },
  series: { where: "?item wdt:P31 wd:Q5398426.", minSitelinks: 40, limit: 150 },
};

const UNIT_TO_MINUTES: Record<string, number> = {
  Q7727: 1, // minute
  Q11574: 1 / 60, // second
  Q25235: 60, // hour
};

// --- Wikidata API shapes (only the parts we read) ---

interface Snak {
  snaktype: "value" | "somevalue" | "novalue";
  datavalue?: { value: unknown };
}
interface Claim {
  mainsnak: Snak;
  rank: "preferred" | "normal" | "deprecated";
}
interface Entity {
  id: string;
  missing?: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
}

// --- HTTP helpers ---

async function fetchJson(url: URL, attempt = 1): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const retryAfter = Number(res.headers.get("retry-after")) || 2 ** attempt;
    console.warn(`  ${res.status} from ${url.host}, retrying in ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function sparql(query: string) {
  const url = new URL(SPARQL_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const json = (await fetchJson(url)) as {
    results: { bindings: Record<string, { value: string }>[] };
  };
  return json.results.bindings;
}

async function getEntities(ids: string[], props: string): Promise<Map<string, Entity>> {
  const entities = new Map<string, Entity>();
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const url = new URL(API_ENDPOINT);
    url.search = new URLSearchParams({
      action: "wbgetentities",
      format: "json",
      ids: ids.slice(i, i + BATCH_SIZE).join("|"),
      props,
      // "mul" holds labels shared by all languages (e.g. proper names); English may only exist there.
      languages: "en|mul",
      maxlag: "5",
    }).toString();
    let json: { entities?: Record<string, Entity>; error?: { code: string; info: string } };
    // A "maxlag" error means the replicas are lagging: back off and retry, as Wikimedia asks.
    for (let attempt = 1; ; attempt++) {
      json = (await fetchJson(url)) as typeof json;
      if (json.error?.code !== "maxlag" || attempt >= 10) break;
      console.warn(`  replication lag, retrying in ${5 * attempt}s`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
    if (json.error) throw new Error(`wbgetentities: ${json.error.info}`);
    for (const entity of Object.values(json.entities ?? {})) {
      if (entity.missing === undefined) entities.set(entity.id, entity);
    }
  }
  return entities;
}

function englishLabel(entity: Entity | undefined): string | undefined {
  return entity?.labels?.en?.value ?? entity?.labels?.mul?.value;
}

// --- Claim readers ---

/** Non-deprecated claims; if some are marked preferred, only those. */
function claimsOf(entity: Entity, property: string): Claim[] {
  const claims = (entity.claims?.[property] ?? []).filter(
    (c) => c.rank !== "deprecated" && c.mainsnak.snaktype === "value",
  );
  const preferred = claims.filter((c) => c.rank === "preferred");
  return preferred.length > 0 ? preferred : claims;
}

function itemIds(entity: Entity, property: string): string[] {
  const ids = claimsOf(entity, property).map(
    (c) => (c.mainsnak.datavalue!.value as { id: string }).id,
  );
  return [...new Set(ids)];
}

/** Earliest year among the time values of a property. */
function earliestYear(entity: Entity, property: string): number | null {
  const years = claimsOf(entity, property)
    .map((c) => (c.mainsnak.datavalue!.value as { time: string }).time)
    .map((time) => Number.parseInt(time.slice(0, time.indexOf("-", 1)), 10))
    .filter(Number.isFinite);
  return years.length > 0 ? Math.min(...years) : null;
}

function quantity(entity: Entity, property: string): { amount: number; unit: string } | null {
  const claim = claimsOf(entity, property)[0];
  if (!claim) return null;
  const value = claim.mainsnak.datavalue!.value as { amount: string; unit: string };
  return { amount: Number(value.amount), unit: value.unit.split("/").pop()! };
}

function count(entity: Entity, property: string): number | null {
  const amount = quantity(entity, property)?.amount;
  return amount !== undefined && Number.isInteger(amount) && amount > 0 ? amount : null;
}

function runtimeMinutes(entity: Entity): number | null {
  const q = quantity(entity, "P2047");
  const factor = q && UNIT_TO_MINUTES[q.unit];
  return q && factor ? Math.round(q.amount * factor) : null;
}

// --- Pipeline ---

async function topIds(type: MediaType): Promise<Map<string, number>> {
  const { where, minSitelinks, limit } = CONFIG[type];
  const rows = await sparql(
    `SELECT ?item ?sitelinks WHERE { ${where} ?item wikibase:sitelinks ?sitelinks. FILTER(?sitelinks >= ${minSitelinks}) }`,
  );
  const ranked = rows
    .map((row) => ({ id: row.item!.value.split("/").pop()!, sitelinks: Number(row.sitelinks!.value) }))
    .sort((a, b) => b.sitelinks - a.sitelinks || a.id.localeCompare(b.id, "en", { numeric: true }));
  if (ranked.length < limit) {
    console.warn(`  only ${ranked.length} ${type} items above ${minSitelinks} sitelinks (wanted ${limit})`);
  }
  return new Map(ranked.slice(0, limit).map((r) => [r.id, r.sitelinks]));
}

/** Properties holding references to other items, whose labels we need. */
const REFERENCE_PROPERTIES: Record<MediaType, string[]> = {
  movie: ["P136", "P57", "P161"],
  book: ["P136", "P50", "P407", "P179"],
  game: ["P136", "P178", "P123", "P400"],
  series: ["P136", "P170"],
};

// --- Images ---

/** The Wikidata property of each kind of image, in order of preference. */
const IMAGE_PROPERTIES: Record<MediaImage["kind"], string> = { poster: "P3383", logo: "P154", image: "P18" };

/**
 * Licenses that allow commercial use. Commons only hosts free files, but some licenses
 * (GFDL, GPL) are impractical for images shown in an app, so they are left out.
 */
const ALLOWED_LICENSE = /^(Public domain|CC0|CC BY(-SA)? [\d.]+|Attribution|WTFPL)$/;
const ALLOWED_MIME = /^image\/(png|jpeg|svg\+xml|webp|gif)$/;

interface CommonsFile {
  title: string;
  imageinfo?: {
    mime: string;
    thumburl?: string;
    descriptionurl: string;
    extmetadata?: Record<string, { value: string } | undefined>;
  }[];
}

/** Plain text from Commons' HTML metadata (the Artist field holds links and markup). */
function plainText(html: string) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Thumbnails, licenses and authors of Commons files, by file name. */
async function commonsFiles(names: string[]): Promise<Map<string, MediaImage & { mime: string }>> {
  const files = new Map<string, MediaImage & { mime: string }>();
  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE);
    const url = new URL(COMMONS_ENDPOINT);
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      iiurlwidth: String(THUMBNAIL_WIDTH),
      iiextmetadatafilter: "LicenseShortName|AttributionRequired|Artist",
      titles: batch.map((name) => `File:${name}`).join("|"),
      maxlag: "5",
    }).toString();
    const json = (await fetchJson(url)) as {
      query: { pages: Record<string, CommonsFile>; normalized?: { from: string; to: string }[] };
    };
    const byTitle = new Map(Object.values(json.query.pages).map((page) => [page.title, page]));
    const normalized = new Map((json.query.normalized ?? []).map((n) => [n.from, n.to]));
    for (const name of batch) {
      const page = byTitle.get(normalized.get(`File:${name}`) ?? `File:${name}`);
      const info = page?.imageinfo?.[0];
      if (!info?.thumburl) continue;
      const meta = info.extmetadata ?? {};
      const author = meta.Artist && plainText(meta.Artist.value);
      files.set(name, {
        // Without the tracking parameters Commons appends.
        url: info.thumburl.split("?")[0]!,
        kind: "image",
        sourceUrl: info.descriptionurl,
        license: meta.LicenseShortName?.value ?? "unknown",
        author: meta.AttributionRequired?.value === "true" && author ? author : null,
        mime: info.mime,
      });
    }
  }
  return files;
}

/** Sets `image` on each item: the first usable file among its poster, logo and image. */
async function addImages(media: Media[]) {
  // Through the query service: wdt: values are the best-ranked claims, like claimsOf().
  const candidates = new Map<string, { kind: MediaImage["kind"]; name: string }[]>(media.map((item) => [item.wikidataId, []]));
  for (let i = 0; i < media.length; i += 100) {
    const ids = media.slice(i, i + 100).map((item) => `wd:${item.wikidataId}`);
    const rows = await sparql(
      `SELECT ?item ?kind ?file WHERE { VALUES ?item { ${ids.join(" ")} } VALUES (?kind ?property) { ${IMAGE_KINDS.map((kind) => `("${kind}" wdt:${IMAGE_PROPERTIES[kind]})`).join(" ")} } ?item ?property ?file. }`,
    );
    for (const row of rows) {
      const name = decodeURIComponent(row.file!.value.split("/Special:FilePath/")[1]!).replace(/_/g, " ");
      candidates.get(row.item!.value.split("/").pop()!)!.push({ kind: row.kind!.value as MediaImage["kind"], name });
    }
  }
  // Preferred kinds first, then by file name, so the choice is stable between runs.
  for (const list of candidates.values()) list.sort((a, b) => IMAGE_KINDS.indexOf(a.kind) - IMAGE_KINDS.indexOf(b.kind) || a.name.localeCompare(b.name));
  const files = await commonsFiles([...new Set([...candidates.values()].flat().map((c) => c.name))]);
  for (const item of media) {
    const usable = candidates
      .get(item.wikidataId)!
      .map(({ kind, name }) => ({ kind, file: files.get(name) }))
      .find(({ file }) => file && ALLOWED_LICENSE.test(file.license) && ALLOWED_MIME.test(file.mime));
    item.image = usable ? { url: usable.file!.url, kind: usable.kind, sourceUrl: usable.file!.sourceUrl, license: usable.file!.license, author: usable.file!.author } : null;
  }
  const count = media.filter((item) => item.image).length;
  console.log(`  images for ${count} of ${media.length} items`);
}

function toMedia(type: MediaType, entity: Entity, popularity: number, label: (id: string) => string | undefined): Media | null {
  const title = englishLabel(entity);
  if (!title) return null;
  const names = (property: string, max = Infinity) =>
    itemIds(entity, property).map(label).filter((name): name is string => !!name).slice(0, max);
  const base = {
    wikidataId: entity.id,
    title,
    description: entity.descriptions?.en?.value ?? null,
    genres: names("P136"),
    popularity,
    image: null, // set by addImages()
  };
  switch (type) {
    case "movie":
      return {
        type,
        ...base,
        year: earliestYear(entity, "P577"),
        directors: names("P57"),
        cast: names("P161", MAX_CAST),
        runtimeMinutes: runtimeMinutes(entity),
      };
    case "book":
      return {
        type,
        ...base,
        year: earliestYear(entity, "P577") ?? earliestYear(entity, "P571"),
        authors: names("P50"),
        language: names("P407")[0] ?? null,
        bookSeries: names("P179")[0] ?? null,
      };
    case "game":
      return {
        type,
        ...base,
        year: earliestYear(entity, "P577"),
        developers: names("P178"),
        publishers: names("P123"),
        platforms: names("P400"),
      };
    case "series":
      return {
        type,
        ...base,
        year: earliestYear(entity, "P580") ?? earliestYear(entity, "P577"),
        endYear: earliestYear(entity, "P582"),
        creators: names("P170"),
        seasons: count(entity, "P2437"),
        episodes: count(entity, "P1113"),
      };
  }
}

const dataDir = new URL("../data/", import.meta.url);

/** Refreshes the images only, keeping the rest of the committed snapshot as it is. */
async function refreshImages() {
  const media = JSON.parse(await readFile(new URL("media.json", dataDir), "utf8")) as Media[];
  console.log("Fetching images...");
  await addImages(media);
  await writeFile(new URL("media.json", dataDir), JSON.stringify(media, null, 2) + "\n");
}

async function main() {
  const result: Media[] = [];
  const seen = new Set<string>();

  for (const type of MEDIA_TYPES) {
    console.log(`Fetching ${type}...`);
    const popularity = await topIds(type);
    const ids = [...popularity.keys()].filter((id) => !seen.has(id));
    const entities = await getEntities(ids, "labels|descriptions|claims");

    const refIds = new Set<string>();
    for (const entity of entities.values()) {
      for (const property of REFERENCE_PROPERTIES[type]) {
        const ids = itemIds(entity, property);
        for (const id of property === "P161" ? ids.slice(0, MAX_CAST) : ids) refIds.add(id);
      }
    }
    console.log(`  ${entities.size} items, resolving ${refIds.size} labels`);
    const refs = await getEntities([...refIds], "labels");
    const label = (id: string) => englishLabel(refs.get(id));

    const dropped: string[] = [];
    for (const id of ids) {
      const entity = entities.get(id);
      const media = entity && toMedia(type, entity, popularity.get(id)!, label);
      if (!media) {
        dropped.push(entity ? `${id} (no English label)` : `${id} (not returned)`);
        continue;
      }
      seen.add(id);
      result.push(media);
    }
    if (dropped.length > 0) console.warn(`  dropped ${dropped.length}: ${dropped.slice(0, 10).join(", ")}`);
  }

  console.log("Fetching images...");
  await addImages(result);

  const counts = Object.fromEntries(
    MEDIA_TYPES.map((type) => [type, result.filter((m) => m.type === type).length]),
  ) as Record<MediaType, number>;
  const meta: SnapshotMeta = {
    source: "Wikidata (https://www.wikidata.org)",
    license: "CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)",
    fetchedAt: new Date().toISOString(),
    counts,
  };

  await writeFile(new URL("media.json", dataDir), JSON.stringify(result, null, 2) + "\n");
  await writeFile(new URL("meta.json", dataDir), JSON.stringify(meta, null, 2) + "\n");
  console.log("Wrote data/media.json:", counts);
}

await (process.argv.includes("--images") ? refreshImages() : main());
