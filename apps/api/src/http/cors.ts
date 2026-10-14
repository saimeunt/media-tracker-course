import type { RequestHandler } from "express";

/**
 * Cross-Origin Resource Sharing. Browsers block a page from reading responses from another
 * origin (scheme + host + port) unless the server allows it with these headers.
 * The web app doesn't need it: its dev server proxies /api, so the browser sees one origin.
 */
export function cors(allowedOrigins: string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.get("Origin");
    // The response depends on the Origin header, so caches must store one copy per origin.
    res.vary("Origin");
    if (!origin || !allowedOrigins.includes(origin)) {
      next();
      return;
    }
    res.set("Access-Control-Allow-Origin", origin);
    // Lets the browser send and receive cookies. Requires a specific origin, never "*".
    res.set("Access-Control-Allow-Credentials", "true");
    // Preflight: before a "non-simple" request (e.g. JSON body, PATCH, DELETE), the browser
    // asks with OPTIONS whether the real request is allowed.
    if (req.method === "OPTIONS" && req.get("Access-Control-Request-Method")) {
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, If-None-Match");
      res.set("Access-Control-Max-Age", "600");
      res.status(204).end();
      return;
    }
    next();
  };
}
