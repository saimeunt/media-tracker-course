import { Form, Link, useNavigate, useNavigation, useSearchParams } from "react-router";
import { ENTRY_STATUSES } from "@media-tracker/shared";
import type { Entry, OffsetPage, UserProfile, UserStats } from "@media-tracker/shared";
import { ApiCalls } from "~/components/api-calls";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import { Spinner } from "~/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { api } from "~/lib/api";
import { useUser } from "~/root";
import { STATUS_LABELS, TYPE_LABELS, formatYear } from "~/lib/media";
import type { Route } from "./+types/user";

const PAGE_SIZE = 20;

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.user.username ?? "Profile"} · Media Tracker` }];
}

/** Independent requests, sent in parallel: the profile, the stats, a page of the library, the follows. */
export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const search = new URL(request.url).searchParams;
  const query = new URLSearchParams({ limit: String(PAGE_SIZE), page: search.get("page") ?? "1" });
  if (search.get("status")) query.set("status", search.get("status")!);
  const calls = [`/api/users/${params.id}`, `/api/users/${params.id}/stats`, `/api/users/${params.id}/entries?${query}`];
  const [user, stats, library] = await Promise.all([
    api<UserProfile>(calls[0]!),
    api<UserStats>(calls[1]!),
    api<OffsetPage<Entry>>(calls[2]!),
  ]);
  return { user, stats, library, calls };
}

export function HydrateFallback() {
  return <Spinner />;
}

export default function UserPage({ loaderData, actionData }: Route.ComponentProps) {
  const { user, stats, library, calls } = loaderData;
  const operations: string[] = [];
  const me = useUser();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lastPage = Math.max(1, Math.ceil(library.total / library.limit));
  const pageLink = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    return `?${next}`;
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <h1 className="font-heading text-3xl font-semibold">{user.username}</h1>
        </div>
        <p className="text-muted-foreground">
          {stats.entryCount} titles in their library
          {stats.averageRating !== null && `, rated ${stats.averageRating.toFixed(1)} / 10 on average`}. Member since{" "}
          {new Date(user.createdAt).toLocaleDateString("en", { month: "long", year: "numeric" })}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.byType.map((type) => (
          <Card key={type.type}>
            <CardHeader>
              <CardDescription>{TYPE_LABELS[type.type]}</CardDescription>
              <CardTitle className="text-2xl">{type.entryCount}</CardTitle>
              <CardDescription>
                {type.completedCount} completed
                {type.averageRating !== null && ` · ★ ${type.averageRating.toFixed(1)}`}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-xl font-semibold">Library</h2>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[searchParams.get("status") ?? "all"]}
          onValueChange={(value) => navigate(value[0] && value[0] !== "all" ? `?status=${value[0]}` : "?")}
        >
          <ToggleGroupItem value="all">All ({stats.entryCount})</ToggleGroupItem>
          {ENTRY_STATUSES.map((status) => (
            <ToggleGroupItem key={status} value={status}>
              {STATUS_LABELS[status]} ({stats.byStatus[status]})
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {library.items.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>Nothing here</EmptyTitle>
              <EmptyDescription>
                Add titles from the <Link to="/">catalog</Link>.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col rounded-xl border">
            {library.items.map((entry) => (
              <li key={entry.mediaId} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link to={`/media/${entry.mediaId}`} className="truncate font-medium hover:underline">
                    {entry.title}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {TYPE_LABELS[entry.type]}
                    {entry.year !== null && ` · ${formatYear(entry.year)}`}
                  </span>
                  {entry.review && <p className="text-sm">“{entry.review}”</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  {entry.rating !== null && <span className="font-medium">★ {entry.rating}</span>}
                  <Badge variant="secondary">{STATUS_LABELS[entry.status]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 text-sm">
          {library.page > 1 && (
            <Link to={pageLink(library.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Previous
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {library.page} of {lastPage}
          </span>
          {library.page < lastPage && (
            <Link to={pageLink(library.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Next
            </Link>
          )}
        </div>
      </div>
      <ApiCalls calls={calls.map((call) => `GET ${call}`)} operations={operations} />
    </>
  );
}
