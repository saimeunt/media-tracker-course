import { z } from "zod";

/** A user as anyone can see them. */
export interface UserProfile {
  id: string;
  username: string;
  createdAt: string;
}

/** The signed-in user, as GET /api/auth/me returns them: the profile plus private fields. */
export interface CurrentUser extends UserProfile {
  email: string;
}

/** Body of POST /api/auth/register. */
export const registerSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "3 to 20 characters: letters, digits and underscores"),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
});
export type Register = z.infer<typeof registerSchema>;

/** Body of POST /api/auth/login. */
export const loginSchema = z.strictObject({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});
export type Login = z.infer<typeof loginSchema>;
