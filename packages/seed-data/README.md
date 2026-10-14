# @media-tracker/seed-data

Media catalog for the media tracker: the 300 most popular movies, 300 novels, 200 video games and 150 TV series on Wikidata, as a committed JSON snapshot (`data/media.json`, metadata in `data/meta.json`).

Popularity is the number of Wikipedia language editions with an article about the item.

## Usage

```ts
import { media, type Media } from "@media-tracker/seed-data";
```

`Media` is a union of four types (`Movie`, `Book`, `Game`, `Series`) told apart by their `type` field. Each type has its own fields (see `src/types.ts`). Fields that are often missing on Wikidata are `null` or empty arrays.

## Refreshing the snapshot (maintainers only)

```sh
pnpm --filter @media-tracker/seed-data fetch-wikidata
```

To refresh only the images (keeping everything else as it is):

```sh
pnpm --filter @media-tracker/seed-data fetch-wikidata --images
```

A full refresh takes a few minutes: it queries the Wikidata Query Service for the most popular item IDs per type, fetches their details through the Wikidata API in batches, and backs off when Wikidata reports replication lag. Review the diff before committing: the data changes as Wikidata gets edited.

## Images

Each item's `image` is a file from [Wikimedia Commons](https://commons.wikimedia.org) that Wikidata links to: its poster, logo or image, in that order of preference, or `null` when there is none (779 of 950 items have one). The snapshot only stores a link to a 500 px thumbnail, never the file itself, plus what crediting it takes: `license`, `author` (null when the license doesn't require credit) and `sourceUrl`, the file's page on Commons. Only licenses that allow commercial use are kept: public domain, CC0, CC BY and CC BY-SA (most files are public domain logos).

## License

Data from [Wikidata](https://www.wikidata.org), available under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No attribution is required, but we credit Wikidata anyway. Images are not part of the data: each one keeps its own license on Wikimedia Commons, and the web app credits them.
