import { Link, redirect } from "react-router";
import type { CurrentUser } from "@media-tracker/shared";
import { AuthForm } from "~/components/auth-form";
import { api, attempt } from "~/lib/api";
import type { Route } from "./+types/register";

export function meta() {
  return [{ title: "Create an account · Media Tracker" }];
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const result = await attempt(() =>
    api<CurrentUser>("/api/auth/register", {
      method: "POST",
      json: { username: form.get("username"), email: form.get("email"), password: form.get("password") },
    }),
  );
  return result.ok ? redirect("/") : result;
}

export default function Register({ actionData }: Route.ComponentProps) {
  return (
    <AuthForm
      title="Create an account"
      description={
        <>
          Already have one?{" "}
          <Link to="/login" className="underline underline-offset-4">
            Sign in
          </Link>
          .
        </>
      }
      fields={[
        { name: "username", label: "Username", type: "text", autoComplete: "username" },
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password (8 characters or more)", type: "password", autoComplete: "new-password" },
      ]}
      submitLabel="Create account"
      problem={actionData?.problem}
    />
  );
}
