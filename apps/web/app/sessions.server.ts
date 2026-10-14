import { createCookieSessionStorage } from "react-router";
import { createThemeSessionResolver } from "remix-themes";

/**
 * The theme picked with the toggle (light or dark), in a cookie the web server reads, so the
 * HTML it renders already has the right theme. Without the cookie, the system's theme applies.
 * The cookie is signed with THEME_SECRET (a default is fine: a theme isn't sensitive).
 */
const themeStorage = createCookieSessionStorage({
  cookie: {
    name: "theme",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    secrets: [process.env.THEME_SECRET ?? "media-tracker-theme"],
  },
});

export const themeSessionResolver = createThemeSessionResolver(themeStorage);
