import { Form, Link, redirect, useNavigation } from "react-router";
import { LIST_VISIBILITIES } from "@media-tracker/shared";
import type { List, ListSummary, OffsetPage, UserProfile } from "@media-tracker/shared";
import { ApiCalls } from "~/components/api-calls";
import { Badge } from "~/components/ui/badge";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { api, attempt, fieldErrors } from "~/lib/api";
import { useUser } from "~/root";
import type { Route } from "./+types/lists";

const PAGE_SIZE = 12;

export function meta() {
  return [{ title: "Lists · Media Tracker" }];
}

/**
 * One request for the lists, then one per owner to show their name: REST resources only
 * hold the owner's id. GraphQL (module 3) fetches both in a single request.
 */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
  const call = `/api/lists?page=${page}&limit=${PAGE_SIZE}`;
  const lists = await api<OffsetPage<ListSummary>>(call);
  const ownerIds = [...new Set(lists.items.map((list) => list.ownerId))];
  const owners = await Promise.all(ownerIds.map((id) => api<UserProfile>(`/api/users/${id}`)));
  return {
    lists,
    owners: Object.fromEntries(owners.map((owner) => [owner.id, owner.username])),
    calls: [`GET ${call}`, ...ownerIds.map((id) => `GET /api/users/${id}`)],
  };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const result = await attempt(() =>
    api<List>("/api/lists", {
      method: "POST",
      json: { name: form.get("name"), description: form.get("description"), visibility: form.get("visibility") },
    }),
  );
  return result.ok ? redirect(`/lists/${result.data.id}`) : result;
}

export function HydrateFallback() {
  return <Spinner />;
}

const visibilityItems = LIST_VISIBILITIES.map((value) => ({
  value,
  label: value === "public" ? "Public: anyone can see it" : "Private: only you",
}));

export default function Lists({ loaderData, actionData }: Route.ComponentProps) {
  const { lists, owners, calls } = loaderData;
  const user = useUser();
  const navigation = useNavigation();
  const errors = fieldErrors(actionData?.problem);
  const lastPage = Math.max(1, Math.ceil(lists.total / lists.limit));

  return (
    <>
      <h1 className="font-heading text-3xl font-semibold">Lists</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lists.items.map((list) => (
          // The title's link covers the whole card (its ::after); the owner's link sits above it.
          <Card key={list.id} className="relative h-full transition-colors hover:bg-muted/50 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
            <CardHeader>
              <CardTitle>
                <Link to={`/lists/${list.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                  {list.name}
                </Link>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span>
                  by{" "}
                  <Link to={`/users/${list.ownerId}`} className="relative z-10 font-medium hover:underline">
                    {owners[list.ownerId] ?? "someone"}
                  </Link>
                </span>
                <span>{list.itemCount} items</span>
                {list.visibility === "private" && <Badge variant="outline">Private</Badge>}
              </CardDescription>
            </CardHeader>
            {list.description && <CardContent className="text-sm text-muted-foreground">{list.description}</CardContent>}
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm">
        {lists.page > 1 && (
          <Link to={`?page=${lists.page - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Previous
          </Link>
        )}
        <span className="text-muted-foreground">
          Page {lists.page} of {lastPage} ({lists.total} lists)
        </span>
        {lists.page < lastPage && (
          <Link to={`?page=${lists.page + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Next
          </Link>
        )}
      </div>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>New list</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post">
              <FieldGroup>
                <Field data-invalid={!!errors.name || undefined}>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input id="name" name="name" aria-invalid={!!errors.name || undefined} />
                  <FieldError>{errors.name}</FieldError>
                </Field>
                <Field data-invalid={!!errors.description || undefined}>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" name="description" aria-invalid={!!errors.description || undefined} />
                  <FieldError>{errors.description}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="visibility">Visibility</FieldLabel>
                  <Select name="visibility" items={visibilityItems} defaultValue="public">
                    <SelectTrigger id="visibility" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {visibilityItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal">
                  <Button type="submit" disabled={navigation.state === "submitting"}>
                    {navigation.state === "submitting" && <Spinner data-icon="inline-start" />}
                    Create list
                  </Button>
                </Field>
              </FieldGroup>
            </Form>
          </CardContent>
        </Card>
      )}
      <ApiCalls calls={calls} />
    </>
  );
}
