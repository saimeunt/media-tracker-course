/** Settings read from environment variables. */

export const isProduction = process.env.NODE_ENV === "production";

/** Secret that signs the JWTs. Anyone who knows it can sign in as anyone. */
export const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? undefined : "local-development-secret");
if (!jwtSecret) throw new Error("Set JWT_SECRET in production");

/** Origins allowed to call the API from a browser (comma-separated), e.g. "http://localhost:8080". */
export const corsOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
