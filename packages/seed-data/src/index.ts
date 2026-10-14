import mediaJson from "../data/media.json" with { type: "json" };
import metaJson from "../data/meta.json" with { type: "json" };
import type { Media, SnapshotMeta } from "./types.ts";

export * from "./types.ts";

/** Media items from the committed Wikidata snapshot (CC0). */
export const media = mediaJson as Media[];

export const meta = metaJson as SnapshotMeta;
