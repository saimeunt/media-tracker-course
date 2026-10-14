import { Form, Link, useNavigation } from "react-router";
import { ENTRY_STATUSES } from "@media-tracker/shared";
import type { CurrentUser, Entry, ListItem, ListSummary, Media, OffsetPage } from "@media-tracker/shared";
import { ApiCalls } from "~/components/api-calls";
import { ImageCredit, MediaImage } from "~/components/media-image";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { ApiError, api, attempt, fieldErrors } from "~/lib/api";
import { STATUS_LABELS, TYPE_LABELS, formatYear } from "~/lib/media";
import type { Route } from "./+types/media";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.media.title ?? "Media"} · Media Tracker` }];
}

/** Returns null instead of throwing on 404. */
async function orNull<T>(call: Promise<T>) {
  try {
    return await call;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The media and who is signed in, then their entry for it and their lists (to add it to one). */
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const calls = [`GET /api/media/${params.id}`, "GET /api/auth/me"];
  const [media, user] = await Promise.all([
    api<Media>(`/api/media/${params.id}`),
    api<CurrentUser>("/api/auth/me").catch((error) => {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }),
  ]);
  let lists: ListSummary[] = [];
  let entry: Entry | null = null;
  if (user) {
    const listsCall = `/api/lists?ownerId=${user.id}&limit=50`;
    const entryCall = `/api/users/${user.id}/entries/${params.id}`;
    calls.push(`GET ${listsCall}`, `GET ${entryCall}`);
    const [page, found] = await Promise.all([api<OffsetPage<ListSummary>>(listsCall), orNull(api<Entry>(entryCall))]);
    lists = page.items;
    entry = found;
  }
  return { media, user, lists, entry, calls };
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));
  if (intent === "save-entry" || intent === "remove-entry") {
    const path = `/api/users/${form.get("userId")}/entries/${params.id}`;
    if (intent === "remove-entry") return { intent, call: `DELETE ${path}`, ...(await attempt(() => api(path, { method: "DELETE" }))) };
    const rating = String(form.get("rating") ?? "");
    const result = await attempt(() =>
      api<Entry>(path, {
        method: "PUT",
        json: { status: form.get("status"), rating: rating ? Number(rating) : null, review: form.get("review") },
      }),
    );
    return { intent, call: `PUT ${path}`, ...result };
  }
  const listId = String(form.get("listId") ?? "");
  const note = String(form.get("note") ?? "").trim();
  const result = await attempt(() =>
    api<ListItem>(`/api/lists/${listId}/items`, {
      method: "POST",
      json: { mediaId: params.id, ...(note && { note }) },
    }),
  );
  return { intent, call: `POST /api/lists/${listId}/items`, ...result, listId };
}

export function HydrateFallback() {
  return <Spinner />;
}

/** Type-specific fields, as label/value pairs. */
function details(media: Media): [string, string | number | null][] {
  const join = (values: string[]) => (values.length > 0 ? values.join(", ") : null);
  switch (media.type) {
    case "movie":
      return [
        ["Directed by", join(media.directors)],
        ["Cast", join(media.cast)],
        ["Runtime", media.runtimeMinutes && `${media.runtimeMinutes} min`],
      ];
    case "book":
      return [
        ["Written by", join(media.authors)],
        ["Language", media.language],
        ["Series", media.bookSeries],
      ];
    case "game":
      return [
        ["Developed by", join(media.developers)],
        ["Published by", join(media.publishers)],
        ["Platforms", join(media.platforms)],
      ];
    case "series":
      return [
        ["Created by", join(media.creators)],
        ["Ended", media.endYear],
        ["Seasons", media.seasons],
        ["Episodes", media.episodes],
      ];
  }
}

const statusItems = ENTRY_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));
const ratingItems = [{ value: "", label: "No rating" }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(10 - i), label: `${10 - i} / 10` }))];

export default function MediaPage({ loaderData, actionData }: Route.ComponentProps) {
  const { media, user, lists, entry, calls } = loaderData;
  const operations: string[] = [];
  const navigation = useNavigation();
  const listItems = lists.map((list) => ({ value: list.id, label: list.name }));
  const listResult = actionData?.intent === "add-to-list" ? actionData : undefined;
  const entryResult = actionData && actionData.intent !== "add-to-list" ? actionData : undefined;
  const addedTo = listResult?.ok && "listId" in listResult ? lists.find((list) => list.id === listResult.listId) : undefined;
  const entryErrors = fieldErrors(entryResult && !entryResult.ok ? entryResult.problem : undefined);
  const busy = navigation.state === "submitting";

  return (
    <>
      <div className="flex flex-col gap-6 sm:flex-row">
        <figure className="flex shrink-0 flex-col gap-1 sm:w-72">
          <MediaImage image={media.image} type={media.type} className="rounded-xl" />
          {media.image && (
            <figcaption>
              <ImageCredit image={media.image} />
            </figcaption>
          )}
        </figure>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{TYPE_LABELS[media.type]}</Badge>
            {media.year !== null && <span>{formatYear(media.year)}</span>}
            <span>Known in {media.popularity} Wikipedia languages</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {media.stats.averageRating !== null && (
              <span className="font-medium text-foreground">
                ★ {media.stats.averageRating.toFixed(1)} / 10 from {media.stats.ratingCount} ratings
              </span>
            )}
            <span>In {media.stats.entryCount} libraries</span>
          </div>
          <h1 className="font-heading text-3xl font-semibold">{media.title}</h1>
          {media.description && <p className="text-muted-foreground">{media.description}</p>}
        </div>
      </div>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        {details(media)
          .filter(([, value]) => value !== null)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {media.tags.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {media.tags.map((tag) => (
              <Badge key={tag} variant="outline" render={<Link to={`/?genre=${encodeURIComponent(tag)}`} />}>
                {tag}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Wikidata genres: {media.genres.join(", ")}</p>
        </div>
      )}

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Your library</CardTitle>
            <CardDescription>
              {entry ? `In your library since ${new Date(entry.createdAt).toLocaleDateString("en")}.` : "Not in your library yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {entryResult && !entryResult.ok && !entryResult.problem.errors && (
              <Alert variant="destructive">
                <AlertTitle>
                  {entryResult.problem.status} {entryResult.problem.title}
                </AlertTitle>
                <AlertDescription>{entryResult.problem.detail}</AlertDescription>
              </Alert>
            )}
            <Form method="post" key={entry?.updatedAt ?? "new"}>
              <input type="hidden" name="intent" value="save-entry" />
              <input type="hidden" name="userId" value={user.id} />
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={!!entryErrors.status || undefined}>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <Select name="status" items={statusItems} defaultValue={entry?.status ?? "completed"}>
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {statusItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError>{entryErrors.status}</FieldError>
                  </Field>
                  <Field data-invalid={!!entryErrors.rating || undefined}>
                    <FieldLabel htmlFor="rating">Rating</FieldLabel>
                    <Select name="rating" items={ratingItems} defaultValue={entry?.rating ? String(entry.rating) : ""}>
                      <SelectTrigger id="rating" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {ratingItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError>{entryErrors.rating}</FieldError>
                  </Field>
                </div>
                <Field data-invalid={!!entryErrors.review || undefined}>
                  <FieldLabel htmlFor="review">Review (optional)</FieldLabel>
                  <Textarea id="review" name="review" defaultValue={entry?.review ?? ""} maxLength={2000} />
                  <FieldError>{entryErrors.review}</FieldError>
                </Field>
                <Field orientation="horizontal">
                  <Button type="submit" disabled={busy}>
                    {entry ? "Save" : "Add to my library"}
                  </Button>
                </Field>
              </FieldGroup>
            </Form>
            {entry && (
              <Form method="post">
                <input type="hidden" name="intent" value="remove-entry" />
                <input type="hidden" name="userId" value={user.id} />
                <Button type="submit" variant="outline" disabled={busy}>
                  Remove from my library
                </Button>
              </Form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add to a list</CardTitle>
          {!user && (
            <CardDescription>
              <Link to="/login" className="underline underline-offset-4">
                Sign in
              </Link>{" "}
              to add it to one of your lists.
            </CardDescription>
          )}
          {user && lists.length === 0 && (
            <CardDescription>
              You have no lists yet.{" "}
              <Link to="/lists" className="underline underline-offset-4">
                Create one
              </Link>
              .
            </CardDescription>
          )}
        </CardHeader>
        {user && lists.length > 0 && (
          <CardContent className="flex flex-col gap-4">
            {listResult && !listResult.ok && (
              <Alert variant="destructive">
                <AlertTitle>
                  {listResult.problem.status} {listResult.problem.title}
                </AlertTitle>
                <AlertDescription>{listResult.problem.detail}</AlertDescription>
              </Alert>
            )}
            {addedTo && (
              <Alert>
                <AlertTitle>Added</AlertTitle>
                <AlertDescription>
                  <span>
                    {media.title} is now in <Link to={`/lists/${addedTo.id}`}>{addedTo.name}</Link>.
                  </span>
                </AlertDescription>
              </Alert>
            )}
            <Form method="post">
              <input type="hidden" name="intent" value="add-to-list" />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="listId">List</FieldLabel>
                  <Select name="listId" items={listItems} defaultValue={listItems[0]?.value}>
                    <SelectTrigger id="listId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {listItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="note">Note (optional)</FieldLabel>
                  <Input id="note" name="note" maxLength={500} />
                </Field>
                <Field orientation="horizontal">
                  <Button type="submit" disabled={busy}>
                    {busy && <Spinner data-icon="inline-start" />}
                    Add to list
                  </Button>
                </Field>
              </FieldGroup>
            </Form>
          </CardContent>
        )}
      </Card>
      <ApiCalls calls={actionData ? [...calls, actionData.call] : calls} operations={operations} />
    </>
  );
}
