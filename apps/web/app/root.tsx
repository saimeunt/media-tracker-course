import { Form, Link, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteLoaderData } from "react-router";
import type { CurrentUser, ProblemDetails } from "@media-tracker/shared";
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from "remix-themes";
import { ModeToggle } from "~/components/mode-toggle";
import { Button, buttonVariants } from "~/components/ui/button";
import { ApiError, api } from "~/lib/api";
import { GraphQLRequestError } from "~/lib/graphql";
import { themeSessionResolver } from "~/sessions.server";
import type { Route } from "./+types/root";
import "./app.css";

/**
 * The signed-in user (or null) and the theme picked with the toggle (or null: the system's).
 * Runs on the web server, which forwards the browser's cookie to the API.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const theme = (await themeSessionResolver(request)).getTheme();
  try {
    return { user: await api<CurrentUser>("/api/auth/me", { request }), theme };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { user: null, theme };
    throw error;
  }
}

/** The signed-in user, from any route. */
export function useUser() {
  return useRouteLoaderData<typeof loader>("root")?.user ?? null;
}

/** Dark mode as shadcn/ui recommends for Remix and React Router: remix-themes, a `dark` class on <html>. */
export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useRouteLoaderData<typeof loader>("root")?.theme ?? null;
  return (
    <ThemeProvider specifiedTheme={theme} themeAction="/action/set-theme">
      <Document ssrTheme={theme !== null}>{children}</Document>
    </ThemeProvider>
  );
}

function Document({ children, ssrTheme }: { children: React.ReactNode; ssrTheme: boolean }) {
  const [theme] = useTheme();
  return (
    // Without a theme cookie, the server can't know the system's theme: a script sets the class before the page shows.
    <html lang="en" className={theme ?? ""} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={ssrTheme} />
        <Links />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-muted-foreground">
          Catalog from <a href="https://www.wikidata.org" className="underline">Wikidata</a> (CC0). Images from{" "}
          <a href="https://commons.wikimedia.org" className="underline">Wikimedia Commons</a>, under free licenses: each media page credits its image.
        </footer>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  const user = useUser();
  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground";
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
        <Link to="/" className="font-heading text-base font-semibold">
          Media Tracker
        </Link>
        <NavLink to="/" end className={navClass}>
          Catalog
        </NavLink>
        <NavLink to="/lists" className={navClass}>
          Lists
        </NavLink>
        <div className="ml-auto flex items-center gap-3">
          <ModeToggle />
          {user ? (
            <>
              <NavLink to={`/users/${user.id}`} className={navClass}>
                My library ({user.username})
              </NavLink>
              <Form method="post" action="/logout">
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </Form>
            </>
          ) : (
            <>
              <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link to="/register" className={buttonVariants({ size: "sm" })}>
                Create an account
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Unexpected error";
  let detail: string | undefined;
  if (error instanceof GraphQLRequestError) {
    title = error.code ?? "GraphQL error";
    detail = error.message;
  } else if (error instanceof ApiError) {
    title = `${error.status} ${error.problem.title}`;
    detail = error.problem.detail;
  } else if (isRouteErrorResponse(error)) {
    const problem = error.data as Partial<ProblemDetails> | undefined;
    title = `${error.status} ${problem?.title ?? error.statusText}`;
    detail = problem?.detail;
  }
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      {detail && <p className="text-muted-foreground">{detail}</p>}
      <Link to="/" className="text-sm underline underline-offset-4">
        Back to the catalog
      </Link>
    </div>
  );
}
