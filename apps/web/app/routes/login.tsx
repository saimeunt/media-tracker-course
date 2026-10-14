import { Link, redirect } from "react-router";
import type { CurrentUser } from "@media-tracker/shared";
import { AuthForm } from "~/components/auth-form";
import { api, attempt } from "~/lib/api";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in · Media Tracker" }];
}

/** The API answers with a Set-Cookie header: the browser stores the session cookie itself. */
export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const result = await attempt(() =>
    api<CurrentUser>("/api/auth/login", {
      method: "POST",
      json: { email: form.get("email"), password: form.get("password") },
    }),
  );
  return result.ok ? redirect("/") : result;
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <AuthForm
      title="Sign in"
      description={
        <>
          Try alice@example.com with password123, or{" "}
          <Link to="/register" className="underline underline-offset-4">
            create an account
          </Link>
          .
        </>
      }
      fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      submitLabel="Sign in"
      problem={actionData?.problem}
    />
  );
}
