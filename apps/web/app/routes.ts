import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/catalog.tsx"),
  route("media/:id", "routes/media.tsx"),
  route("lists", "routes/lists.tsx"),
  route("lists/:id", "routes/list.tsx"),
  route("users/:id", "routes/user.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("logout", "routes/logout.tsx"),
  route("action/set-theme", "routes/set-theme.ts"),
] satisfies RouteConfig;
