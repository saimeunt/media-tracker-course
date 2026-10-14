import { redirect } from "react-router";
import { api } from "~/lib/api";

/** The header's "Sign out" button posts here. The API clears the cookie. */
export async function clientAction() {
  await api("/api/auth/logout", { method: "POST" });
  return redirect("/");
}
