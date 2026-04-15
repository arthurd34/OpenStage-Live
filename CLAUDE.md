# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenStage Live is a real-time, moderation-first audience interaction platform for live theatrical performances. Audience members submit proposals on their phones; a production team moderates them before displaying selected ones on a large projection screen. The app supports show packages (ZIP files with JSON config + assets), scoring, access control (public code or per-user whitelist), and bilingual (FR/EN) content.

## Commands

### Development

```bash
# Backend (hot reload via nodemon)
cd backend && npm install && npm run dev

# Frontend (Vite dev server on port 5173)
cd frontend && npm install && npm run dev
```

### Production build

```bash
cd frontend && npm run build   # outputs to dist/ with legacy browser support
cd frontend && npm run preview # preview the production build locally
```

### Docker

```bash
# Development with hot reload
docker-compose up --build

# Production
docker-compose -f docker-compose.prod.yml up
```

### Environment

Copy `.env.example` to `.env` before running locally. Key variables:
- `PORT` — backend HTTP/Socket.io port (default 3000)
- `ADMIN_PASSWORD` — admin login password
- `SECRET_TOKEN` — HMAC signing secret for session tokens
- `VITE_BACKEND_URL` — backend URL used by the frontend at build time
- `CORS_ORIGIN` — allowed origin for CORS and Socket.io

There is no test suite and no linter configured.

## Architecture

### Three views, one Socket.io server

The app has three distinct browser views, all connected to the same Express + Socket.io backend:

| View | Route | Purpose |
|------|-------|---------|
| Public | `/` | Mobile audience interface — connect, submit proposals, see leaderboard |
| Admin | `/admin` | Production team dashboard — moderate proposals, control scenes, manage users |
| Screen | `/screen` | Large projection display — shows approved proposals and leaderboard |

### Backend (`backend/src/`)

- **`server.js`** — Single entry point (~534 lines). Boots Express + Socket.io, defines all socket event handlers, mounts HTTP routes (file upload, asset serving). Most business logic flows through here.
- **`admin.js`** — Admin action handlers: user approval/rejection/kick, score management, access control toggling.
- **`scenes/`** — Scene-type handlers (`proposal.js`, `waiting.js`, etc.) dispatched by `scenes/index.js`. A "scene" is one step of a show (e.g. a proposal round, a waiting screen, or a leaderboard display).
- **`db.js`** — SQLite wrapper using `better-sqlite3`. The **entire app state** (users, proposals, scores, access config, admin tokens) is persisted as a **single JSON document** in one table. No relational schema.
- **`showManager.js`** — Handles show ZIP upload and deletion from `backend/shows/`.
- **`i18n.js`** — French translation strings dictionary; English translations live in the frontend.

### Frontend (`frontend/src/`)

- **`App.jsx`** — React Router setup. Three top-level routes → three view components.
- **`views/`** — `Public.jsx`, `Admin.jsx`, `Screen.jsx`. Each manages its own Socket.io connection and local state.
- **`components/`** — Subcomponents split by view: `scenes/` (per-scene-type UI), `admin/` (ShowLibrary, AccessControl, SceneControl, UserManagement, ScoringSystem, ProposalAdmin), `screen/`, `overlays/`.
- **`utils/useCustomTheme.js`** — Applies per-show CSS custom properties loaded from the show's theme config.
- **`utils/useAssetPreloader.js`** — Preloads show assets before a scene change.
- **`utils/i18n.js`** — Translation lookup; the active translation set is received from the server at connection time.

### Key architectural points

- **Show packages** — Shows are ZIP files unpacked into `backend/shows/<showId>/`. Each contains a `show.json` (scene list, theme, language) and optional static assets (images, audio). The frontend fetches assets directly from the backend's `/shows/:id/assets/` static route.
- **Real-time flow** — All state changes originate as socket events. Admins emit actions → server mutates in-memory state + persists to SQLite → server broadcasts updated state to all connected clients.
- **Token auth** — Admin password → HMAC-signed session token. Up to 50 active tokens kept in memory (sliding window). No persistent sessions.
- **Moderation gate** — Proposals move through states (`pending` → `approved`/`rejected` → `displayed`/`winner`). Nothing reaches the Screen view without explicit admin action.
- **Legacy browser support** — Vite is configured with `@vitejs/plugin-legacy` for IE11 / iOS 9 target, reflecting venue hardware constraints.
- **Latency monitoring** — Public clients ping the server every 3 s; the admin dashboard displays per-user latency.
