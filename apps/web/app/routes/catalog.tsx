import { Link, useNavigate, useSearchParams } from "react-router";
import { MEDIA_SORTS, MEDIA_TYPES } from "@media-tracker/shared";
import type { CursorPage, Genre, Media, MediaSort } from "@media-tracker/shared";
import { ApiCalls } from "~/components/api-calls";
import { MediaImage } from "~/components/media-image";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { api } from "~/lib/api";
import { TYPE_LABELS, credits, formatYear } from "~/lib/media";
import type { Route } from "./+types/catalog";

const PAGE_SIZE = 24;

const SORT_LABELS: Record<MediaSort, string> = {
  "-popularity": "Most popular",
  popularity: "Least popular",
  title: "Title, A to Z",
  "-title": "Title, Z to A",
  "-rating": "Top rated",
};

const ALL_GENRES = "";

export function meta() {
  return [{ title: "Catalog · Media Tracker" }];
}

/** Runs in the browser: the page's query string becomes the API's. */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams;
  params.set("limit", String(PAGE_SIZE));
  // "Top rated" only counts media rated by a few users, so one 10/10 doesn't top the list.
  if (params.get("sort") === "-rating" && !params.has("minRatings")) params.set("minRatings", "5");
  const type = params.get("type");
  const calls = [`/api/media?${params}`, `/api/genres${type ? `?type=${type}` : ""}`];
  const [page, genres] = await Promise.all([api<CursorPage<Media>>(calls[0]!), api<Genre[]>(calls[1]!)]);
  return { page, genres, calls };
}

export function HydrateFallback() {
  return <Spinner />;
}

export default function Catalog({ loaderData }: Route.ComponentProps) {
  const { page, genres, calls } = loaderData;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  /** Navigates to the same page with some parameters changed, back to the first page. */
  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    next.delete("cursor");
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    navigate(`?${next}`);
  }

  const nextPage = new URLSearchParams(searchParams);
  if (page.nextCursor) nextPage.set("cursor", page.nextCursor);
  const sortItems = MEDIA_SORTS.map((value) => ({ value, label: SORT_LABELS[value] }));
  const genreItems = [
    { value: ALL_GENRES, label: "All genres" },
    ...genres.slice(0, 60).map((genre) => ({ value: genre.name, label: `${genre.name} (${genre.count})` })),
  ];

  return (
    <>
      <h1 className="font-heading text-3xl font-semibold">Catalog</h1>
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[searchParams.get("type") ?? "all"]}
          onValueChange={(value) => update({ type: value[0] === "all" ? null : (value[0] ?? null) })}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          {MEDIA_TYPES.map((type) => (
            <ToggleGroupItem key={type} value={type}>
              {TYPE_LABELS[type]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select
          items={sortItems}
          value={searchParams.get("sort") ?? "-popularity"}
          onValueChange={(value) => update({ sort: value === "-popularity" ? null : value })}
        >
          <SelectTrigger aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {sortItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={genreItems}
          value={searchParams.get("genre") ?? ALL_GENRES}
          onValueChange={(value) => update({ genre: value || null })}
        >
          <SelectTrigger aria-label="Genre" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {genreItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {page.items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Nothing matches</EmptyTitle>
            <EmptyDescription>Try another genre or type.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((media) => (
            <Link key={media.id} to={`/media/${media.id}`} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <Card className="h-full pt-0 transition-colors hover:bg-muted/50">
                <MediaImage image={media.image} type={media.type} />
                <CardHeader>
                  <CardTitle>{media.title}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{TYPE_LABELS[media.type]}</Badge>
                    {media.year !== null && <span>{formatYear(media.year)}</span>}
                    {media.stats.averageRating !== null && (
                      <span>
                        ★ {media.stats.averageRating.toFixed(1)} ({media.stats.ratingCount})
                      </span>
                    )}
                    <span className="max-w-full truncate">{credits(media).slice(0, 2).join(", ")}</span>
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {searchParams.has("cursor") && (
          <Button variant="outline" onClick={() => update({})}>
            First page
          </Button>
        )}
        {page.nextCursor && (
          <Link to={`?${nextPage}`} className={buttonVariants({ variant: "outline" })}>
            Next page
          </Link>
        )}
      </div>
      <ApiCalls calls={calls.map((call) => `GET ${call}`)} />
    </>
  );
}
