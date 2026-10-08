# Copilot instructions for nodeServer

## Build, test, and validation commands

Use the repo scripts in `package.json` as the source of truth:

- Install dependencies: `npm install`
- Start one site instance: `node app.js <site-name>`
  - `<site-name>` must match a directory under `sites/` that contains a `.env` file, for example `node app.js MeditationTimer`.
- Start all configured site instances: `npm run start:sites`
- Stop the background site processes: `npm run stop`
- Smoke-test every configured site: `npm test`
  - This script starts each site listed under `sites/*/.env`, checks that it boots and serves `/`, and fails on any startup/HTTP issues.
- There is no lint script in `package.json`; if this repo adds one later, prefer using that script instead of ad hoc linting.
- Runtime requirement: Node >= 22.20.0 (`package.json` `engines.node`).

For a single-site validation, the practical workflow is to run `node app.js <site-name>` and then request the root page (for example `http://127.0.0.1:<port>/`) or use the site’s configured port from its `.env` file.

## High-level architecture

This repo is a multi-site Express app that boots a different website configuration per site name:

- `app.js` is the entry point. It reads `process.argv[2]` as the site name and loads `sites/<site-name>/.env`.
- Each site config defines runtime variables such as `port`, `sessionDB`, `userDB`, `gameDB`, `logfile`, and `imagePath`.
- `app.js` creates storage directories if they do not exist, configures Express session storage (`express-session` + `session-file-store`), mounts route modules, serves static files, and exposes per-site EJS views.
- Shared UI fragments live in `sites/any/` and are used across sites; site-specific files sit under `sites/<site>/`.
- Route logic is split into dedicated modules under `routes/`:
  - `auth.js` handles sign-in, sign-up, and session-based identity checks.
  - `game-routes.js` manages the scoreboard and game session state.
  - `log.js` records access logs, processes IP metadata, and exposes log/dashboard endpoints.
  - `fortune.js` is conditionally mounted when a site provides `fortunesDB`.
- `tools/testSites.js` is the repo’s health check; it validates each site by starting the server and requesting `/`.

## Key repository conventions

- Site identity is explicit: every site is discovered from `sites/<name>/.env`; do not assume a single global config.
- Config is environment-driven: when changing behavior, check the site `.env` first, then update the code that consumes those variables in `app.js` or the route modules.
- Persistence is JSON-based: `simple-json-db` is used for user, game, and log-related data, not a database server.
- Sessions are file-backed and per-site: session files are stored under the path from `sessionDB`, and authentication is stored in `req.session`.
- View rendering is EJS-based; static site assets live under each site’s `httpdocs` or shared `sites/any/` directories.
- Route modules are created as factory functions (`module.exports = function (...) { ... return router; }`) and are passed the relevant DB path(s) from `app.js`.
- Prefer site-scoped or route-scoped changes rather than adding one-off global logic in `app.js` unless the change truly applies to the entire server process.
- The repo does not appear to include a formal lint, typecheck, or test framework beyond the startup smoke check; treat `npm test` as the baseline verification command for site health.

## Working style notes for this codebase

- Keep changes compatible with multi-site startup, because the same app can boot different sites using different `.env` files.
- When adding a new endpoint, mirror the existing route style: use Express router modules, `res.render(...)` for EJS pages, and JSON responses for API or app-state operations.
- Preserve the current environment-variable contract for `app.js` and the route factories; many modules depend on exact keys such as `port`, `userDB`, `sessionDB`, and `imagePath`.
- Validate config changes against the site-specific `.env` values before assuming a default path or port.
