# Media Tracker: REST / MongoDB / GraphQL course

Companion app for a course on REST APIs, MongoDB and GraphQL: a media tracker for movies, books, video games and TV series.

| Path | What |
|---|---|
| `apps/web` | Frontend: React Router (framework mode) + shadcn/ui |
| `apps/api` | Backend: Express 5, the REST API, then MongoDB (module 2) and GraphQL (module 3) |
| `apps/api/exercises` | Files for the exercises that aren't code in the app (queries) |
| `packages/shared` | Zod schemas and types shared by web and api |
| `packages/seed-data` | Media catalog: a Wikidata snapshot (CC0) |
| `bruno` | Requests for [Bruno](https://www.usebruno.com), an open-source API client |

## Run it

Requirements: [Docker](https://docs.docker.com/get-docker/) (Docker Desktop, OrbStack or Podman). To run the tests on your machine rather than in Docker, Node 24+ and pnpm too.

```sh
docker compose up --build
```

| Service | URL |
|---|---|
| Web | http://localhost:5173 |
| API health check | http://localhost:4000/api/health |
| MongoDB | `mongodb://localhost:27017/media-tracker?directConnection=true` |

The first build downloads all dependencies and can take a few minutes. Code changes in `apps/api/src`, `apps/web/app` and `packages/shared/src` reload automatically. After changing dependencies or any `package.json`, rebuild with `--build`.

If a port is already taken on your machine, override it, for example `WEB_PORT=5175 docker compose up --build`. The variables are `WEB_PORT`, `API_PORT` and `MONGO_PORT`.

Media images are loaded from [Wikimedia Commons](https://commons.wikimedia.org) (free licenses, credited on each media page): without an internet connection, an icon replaces them.

Two demo accounts exist: `alice@example.com` and `bob@example.com`, both with the password `password123`.

In module 1, the API keeps its data in memory: it starts from the catalog and the demo accounts, and forgets every change when it restarts.

The API also reads `JWT_SECRET` (the key that signs session tokens; a development default is used outside production) and `CORS_ORIGINS` (comma-separated origins allowed to call the API from a browser, empty by default).

Stop everything with `docker compose down` (add `-v` to also delete the database).

## Exercises

Each exercise has a `TODO <id>` comment where its code goes (search the code for `TODO R2`, for example), and tests that check it. Run the tests of one exercise with:

```sh
pnpm exercise R2                              # on your machine (Node 24+ and pnpm, after pnpm install)
docker compose exec api pnpm exercise R2      # or in the api container
```

An exercise is done when its tests pass. Until then, the code it replaces answers `501 Not Implemented`.

| Exercise | What |
|---|---|
| R1 | Observe the API with `curl -v`, the browser's developer tools and Bruno |
| R2 | `PATCH` and `DELETE /api/lists/:id` |
| R3 | Readable validation errors: Zod issues as problem details |
| R4 | Filter and paginate the catalog: `GET /api/media` |
| R5 | HTTP caching: ETag and `304 Not Modified` |
| R6 | Protect the list routes: 401 and 403 |

## Moving to the next module

Each module has its own branch: `module-1` first, then `module-2` and `module-3` appear when the previous module ends. A new module's branch starts with the previous module solved, so everyone starts from working code. Keep your work on your branch, then switch:

```sh
git add --all && git commit -m "My module 1"   # your work stays on module-1
git fetch
git switch module-2
docker compose up --build
```

`git diff module-1 module-2` then compares your work with the solution, and `git diff origin/module-1 module-2` shows the solution alone.

## Working outside containers

With Node 24+ and pnpm installed, run MongoDB alone in Docker and the apps on your machine:

```sh
pnpm install
docker compose up mongo
pnpm --filter @media-tracker/api dev
pnpm --filter @media-tracker/web dev
```

## Tests and requests

- `pnpm test` runs the API's HTTP tests (no Docker needed: each test file starts the API on a fresh in-memory store).
- `bruno/` is a collection for Bruno: open the folder in Bruno, pick the `local` environment, and send the requests in order. Each has a short explanation in its Docs tab. `pnpm requests` runs the whole collection from the terminal against the running API.
