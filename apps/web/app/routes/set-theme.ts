import { createThemeAction } from "remix-themes";
import { themeSessionResolver } from "~/sessions.server";

/** Saves the theme picked with the toggle: remix-themes POSTs it here, the answer sets the cookie. */
export const action = createThemeAction(themeSessionResolver);
