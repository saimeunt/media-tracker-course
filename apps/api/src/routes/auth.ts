import { Router } from "express";
import { loginSchema, registerSchema } from "@media-tracker/shared";
import { hashPassword, verifyPassword } from "../auth/password.ts";
import { clearTokenCookie, requireUser, setTokenCookie } from "../http/auth.ts";
import { HttpError } from "../http/problem.ts";
import { parseBody } from "../http/validation.ts";
import { DuplicateKeyError } from "../store/types.ts";
import type { Store } from "../store/types.ts";
import { toCurrentUser } from "./users.ts";

// Checked when the email is unknown, so that case takes as long as a wrong password
// and response times don't reveal which emails have an account.
const DUMMY_HASH = await hashPassword("not-a-real-password");

export function authRouter(store: Store) {
  const router = Router();

  router.post("/auth/register", async (req, res) => {
    const { username, email, password } = parseBody(req, registerSchema);
    try {
      const user = await store.users.create({ username, email, passwordHash: await hashPassword(password) });
      setTokenCookie(res, user.id);
      res.status(201).location(`/api/users/${user.id}`).json(toCurrentUser(user));
    } catch (error) {
      if (!(error instanceof DuplicateKeyError)) throw error;
      throw new HttpError(409, `This ${error.field} is already taken`, {
        errors: [{ pointer: `#/${error.field}`, detail: "Already taken" }],
      });
    }
  });

  router.post("/auth/login", async (req, res) => {
    const { email, password } = parseBody(req, loginSchema);
    const user = await store.users.findByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    // Same answer for an unknown email and a wrong password.
    if (!user || !valid) throw new HttpError(401, "Wrong email or password");
    setTokenCookie(res, user.id);
    res.json(toCurrentUser(user));
  });

  router.post("/auth/logout", (_req, res) => {
    clearTokenCookie(res);
    res.status(204).end();
  });

  router.get("/auth/me", async (req, res) => {
    const userId = requireUser(req.user);
    const user = await store.users.findById(userId);
    // A valid token for a deleted user.
    if (!user) throw new HttpError(401, "Sign in to do this");
    res.json(toCurrentUser(user));
  });

  return router;
}
