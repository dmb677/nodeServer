# Copilot instructions for nodeServer

## Build, test, and validation commands

Use the repo scripts in `package.json` as the source of truth:

- Install dependencies: `npm install`
- Start one site instance: `node app.js <site-name>`
  - `<site-name>` must match a directory under `sites/` that contains a `.env` file, for example `node app.js DieWhenYouDie`.
- Start all configured site instances: `npm run start:sites`
- Stop the background site processes: `npm run stop`
- Smoke-test every configured site: `npm test`
  - This script starts each site listed under `sites/*/.env`, checks that it boots and serves `/`, and fails on any startup/HTTP issues.
- There is no lint script in `package.json`; if this repo adds one later, prefer using that script instead of ad hoc linting.
- Runtime requirement: Node >= 22.20.0 (`package.json` `engines.node`).

There is no single-test selector: `tools/testSites.js` always discovers and checks every site with a `.env` file. For a single-site smoke check, run `node app.js <site-name>` and request `http://127.0.0.1:<port>/`, using that site's `port` from `sites/<site-name>/.env`. Stop the foreground server with `Ctrl+C`.

## High-level architecture

This repo is a multi-site Express app that boots a different website configuration per site name:

- `app.js` is the entry point. It reads `process.argv[2]` as the site name and loads `sites/<site-name>/.env`.
- Each site config defines runtime variables such as `port`, `sessionDB`, `userDB`, `gameDB`, `LogIPDB`, `logfile`, and `imagePath`; `fortunesDB` enables the optional fortune feature.
- `app.js` creates storage directories if they do not exist, configures Express session storage (`express-session` + `session-file-store`), mounts route modules, serves static files, and exposes per-site EJS views.
- The EJS view lookup checks the active site's `views/` before `sites/any/`. Site-specific partials therefore override shared partials with the same path. Static assets are served in the same order: active site `httpdocs/`, shared `sites/any/`, then the configured image directory.
- Route logic is split into dedicated modules under `routes/`:
  - `auth.js` handles sign-in, sign-up, and session-based identity checks.
  - `game-routes.js` manages the scoreboard and game session state.
  - `log.js` records access logs, processes IP metadata, and exposes log/dashboard endpoints.
  - `fortune.js` is conditionally mounted when a site provides `fortunesDB`.
- `tools/testSites.js` is the repo’s health check; it validates each site by starting the server and requesting `/`.

## Key repository conventions

- Site identity is explicit: every site is discovered from `sites/<name>/.env`; do not assume a single global config.
- Config is environment-driven: when changing behavior, check the site's `.env` first, then update the code that consumes those variables in `app.js` or the route modules. The smoke test requires every declared config value to be non-empty and validates all of its required keys before starting a site.
- Persistence is JSON-based: `simple-json-db` is used for user, game, and log-related data, not a database server.
- Sessions are file-backed and per-site: session files are stored under the path from `sessionDB`, and authentication is stored in `req.session`.
- View rendering is EJS-based. The final catch-all route turns an unmatched path into an EJS template name, so adding a view can expose it at the matching URL; reserve explicit routes for behavior that needs data, validation, or a non-HTML response.
- Route modules are created as factory functions (`module.exports = function (...) { ... return router; }`) and are passed the relevant DB path(s) from `app.js`.
- Prefer site-scoped or route-scoped changes rather than adding one-off global logic in `app.js` unless the change truly applies to the entire server process.
- Preserve middleware order in `app.js`: request logging precedes JSON parsing and static-file serving, then mounted feature routers, uploads, explicit pages, and the EJS catch-all. Changing that order can alter logging, asset precedence, or fallback rendering.
- The repo does not appear to include a formal lint, typecheck, or test framework beyond the startup smoke check; treat `npm test` as the baseline verification command for site health.

## Working style notes for this codebase

- Keep changes compatible with multi-site startup, because the same app can boot different sites using different `.env` files.
- When adding a new endpoint, mirror the existing route style: use Express router modules, `res.render(...)` for EJS pages, and JSON responses for API or app-state operations.
- Preserve the current environment-variable contract for `app.js` and the route factories; many modules depend on exact keys such as `port`, `userDB`, `sessionDB`, and `imagePath`.
- The shared `auth` router serves every site, but some authenticated features are site-specific. Keep server-side validation in `routes/auth.js` aligned with the request shape and allowed values used by the site's browser assets.
- Validate config changes against the site-specific `.env` values before assuming a default path or port.
