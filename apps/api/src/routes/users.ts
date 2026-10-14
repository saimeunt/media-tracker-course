import { Router } from "express";
import type { CurrentUser, UserProfile } from "@media-tracker/shared";
import { HttpError } from "../http/problem.ts";
import type { Store, User } from "../store/types.ts";

export function toUserProfile(user: User): UserProfile {
  return { id: user.id, username: user.username, createdAt: user.createdAt.toISOString() };
}

export function toCurrentUser(user: User): CurrentUser {
  return { ...toUserProfile(user), email: user.email };
}

export function usersRouter(store: Store) {
  const router = Router();

  router.get("/users/:id", async (req, res) => {
    const user = await store.users.findById(req.params.id);
    if (!user) throw new HttpError(404, `No user with id ${req.params.id}`);
    res.json(toUserProfile(user));
  });

  return router;
}
