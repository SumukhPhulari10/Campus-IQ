# CampusIQ Backend

Express API for CampusIQ. Deploy this folder as a separate Node.js service from `frontend/`.

## Setup

1. Install dependencies from this folder with `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `GEMINI_API_KEY`, and any SMTP credentials you use.
3. Set `FRONTEND_URL` to the frontend origin. Multiple allowed origins can be comma-separated.
4. Set `API_URL` to this backend's public origin so email verification links reach the API.

Run locally with `npm run dev`. The API listens on `PORT` (default `3000`). Run `npm run build` and `npm start` for production.

## Database

SQL migrations and database scripts are in `sql/`. The server also initializes its tables on startup.

## Deployment

Configure the frontend build with `VITE_API_BASE_URL` set to this service's public origin. Keep all backend secrets in the backend host's environment variables; never add them to the frontend build.