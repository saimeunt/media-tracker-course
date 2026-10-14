import { Form, Link, data, redirect, useNavigation } from "react-router";
import type { List, UserProfile } from "@media-tracker/shared";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { ApiCalls } from "~/components/api-calls";
import { MediaImage } from "~/components/media-image";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "~/components/ui/empty";
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { ApiError, api, attempt, fieldErrors } from "~/lib/api";
import { TYPE_LABELS, formatYear } from "~/lib/media";
import { useUser } from "~/root";
import type { Route } from "./+types/list";

async function loadList(id: string, request?: Request) {
  const list = await api<List>(`/api/lists/${id}`, { request });
  const owner = await api<UserProfile>(`/api/users/${list.ownerId}`, { request });
  return { list, owner, calls: [`GET /api/lists/${id}`, `GET /api/users/${list.ownerId}`] };
}

/**
 * Runs on the web server when the page is opened from a link: the HTML arrives complete,
 * with the meta tags that social networks read to build a preview.
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    return { ...(await loadList(params.id, request)), origin: new URL(request.url).origin };
  } catch (error) {
    // Thrown as a response so the error boundary gets the status, also after serialization.
    if (error instanceof ApiError) throw data(error.problem, { status: error.status });
    throw error;
  }
}

/** Runs in the browser when navigating from another page of the app. */
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  return { ...(await loadList(params.id)), origin: window.location.origin };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "List · Media Tracker" }];
  const { list, owner, origin } = loaderData;
  const cover = list.items.find((item) => item.image)?.image;
  const description = list.description || `${list.items.length} titles, by ${owner.username}`;
  return [
    { title: `${list.name} · Media Tracker` },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:title", content: list.name },
    { property: "og:description", content: description },
    { property: "og:url", content: `${origin}/lists/${list.id}` },
    // The first item's image, for the preview card of social networks.
    ...(cover ? [{ property: "og:image", content: cover.url }] : []),
    { name: "twitter:card", content: "summary" },
  ];
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");
  const path = `/api/lists/${params.id}`;
  switch (intent) {
    case "rename":
      return attempt(() =>
        api<List>(path, { method: "PATCH", json: { name: form.get("name"), description: form.get("description") } }),
      );
    case "toggle-visibility":
      return attempt(() => api<List>(path, { method: "PATCH", json: { visibility: form.get("visibility") } }));
    case "remove-item":
      return attempt(() => api(`${path}/items/${form.get("mediaId")}`, { method: "DELETE" }));
    case "reorder":
      // PUT sends the whole collection: all the items, in their new order.
      return attempt(() => api<List>(`${path}/items`, { method: "PUT", json: JSON.parse(String(form.get("items"))) }));
    case "delete": {
      const result = await attempt(() => api(path, { method: "DELETE" }));
      return result.ok ? redirect("/lists") : result;
    }
    default:
      throw new Error(`Unknown intent ${intent}`);
  }
}

/** The PUT body that moves the item at `index` by `offset` (-1: up, +1: down). */
function reorderedItems(list: List, index: number, offset: number) {
  const items = list.items.map(({ mediaId, note }) => ({ mediaId, ...(note && { note }) }));
  const [moved] = items.splice(index, 1);
  items.splice(index + offset, 0, moved!);
  return JSON.stringify(items);
}

/** An icon button that posts one action for a list item. */
function ItemAction(props: { intent: string; fields: Record<string, string>; label: string; disabled: boolean; children: React.ReactNode }) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={props.intent} />
      {Object.entries(props.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant="ghost" size="icon-sm" aria-label={props.label} disabled={props.disabled}>
        {props.children}
      </Button>
    </Form>
  );
}

export default function ListPage({ loaderData, actionData }: Route.ComponentProps) {
  const { list, owner, calls } = loaderData;
  const user = useUser();
  const navigation = useNavigation();
  const isOwner = user?.id === list.ownerId;
  const busy = navigation.state !== "idle";
  const errors = fieldErrors(actionData && !actionData.ok ? actionData.problem : undefined);

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            A list by{" "}
            <Link to={`/users/${owner.id}`} className="font-medium text-foreground hover:underline">
              {owner.username}
            </Link>
          </span>
          {list.visibility === "private" && <Badge variant="outline">Private</Badge>}
        </div>
        <h1 className="font-heading text-3xl font-semibold">{list.name}</h1>
        {list.description && <p className="text-muted-foreground">{list.description}</p>}
      </div>

      {actionData && !actionData.ok && !actionData.problem.errors && (
        <Alert variant="destructive">
          <AlertTitle>
            {actionData.problem.status} {actionData.problem.title}
          </AlertTitle>
          <AlertDescription>{actionData.problem.detail}</AlertDescription>
        </Alert>
      )}

      {list.items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No titles yet</EmptyTitle>
            <EmptyDescription>
              Add some from the <Link to="/">catalog</Link>.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="flex flex-col rounded-xl border">
          {list.items.map((item, index) => (
            <li key={item.mediaId} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <span className="w-6 text-right text-sm text-muted-foreground">{index + 1}</span>
              <MediaImage image={item.image} type={item.type} className="w-20 shrink-0 rounded-md [&_img]:p-1.5 [&_svg]:size-6" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Link to={`/media/${item.mediaId}`} className="truncate font-medium hover:underline">
                  {item.title}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {TYPE_LABELS[item.type]}
                  {item.year !== null && ` · ${formatYear(item.year)}`}
                  {item.note && ` · ${item.note}`}
                </span>
              </div>
              {isOwner && (
                <div className="flex gap-1">
                  <ItemAction intent="reorder" fields={{ items: index > 0 ? reorderedItems(list, index, -1) : "" }} label="Move up" disabled={busy || index === 0}>
                    <ArrowUpIcon />
                  </ItemAction>
                  <ItemAction
                    intent="reorder"
                    fields={{ items: index < list.items.length - 1 ? reorderedItems(list, index, 1) : "" }}
                    label="Move down"
                    disabled={busy || index === list.items.length - 1}
                  >
                    <ArrowDownIcon />
                  </ItemAction>
                  <ItemAction intent="remove-item" fields={{ mediaId: item.mediaId }} label="Remove" disabled={busy}>
                    <XIcon />
                  </ItemAction>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Edit list</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Form method="post">
              <input type="hidden" name="intent" value="rename" />
              <FieldGroup>
                <Field data-invalid={!!errors.name || undefined}>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" defaultValue={list.name} aria-invalid={!!errors.name || undefined} />
                  <FieldError>{errors.name}</FieldError>
                </Field>
                <Field data-invalid={!!errors.description || undefined}>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" name="description" defaultValue={list.description} aria-invalid={!!errors.description || undefined} />
                  <FieldError>{errors.description}</FieldError>
                </Field>
                <Field orientation="horizontal">
                  <Button type="submit" disabled={busy}>
                    Save
                  </Button>
                </Field>
              </FieldGroup>
            </Form>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Form method="post">
                <input type="hidden" name="intent" value="toggle-visibility" />
                <input type="hidden" name="visibility" value={list.visibility === "public" ? "private" : "public"} />
                <Button type="submit" variant="outline" disabled={busy}>
                  Make {list.visibility === "public" ? "private" : "public"}
                </Button>
              </Form>
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="destructive" />}>Delete list</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{list.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <Button type="submit" variant="destructive" disabled={busy}>
                        Delete
                      </Button>
                    </Form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
      <ApiCalls calls={calls} />
    </>
  );
}
