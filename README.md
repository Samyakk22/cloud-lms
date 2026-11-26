# Lectern: a simple MERN-style learning management system (React, Express, Node, PostgreSQL)

Instructors create courses, upload materials and build quizzes. Students enroll, open materials and take quizzes.

## Run it locally

You need Node.js 20+ and PostgreSQL 14+.

**1. Create the database** (once)
```bash
psql -U postgres -c "CREATE DATABASE lms;"
```
Then open `backend/.env` and set the password in `DATABASE_URL` to match your local PostgreSQL install:
`postgres://postgres:YOUR_PASSWORD@localhost:5432/lms`

**2. Backend** (terminal 1)
```bash
cd backend
npm install
npm run dev          # http://localhost:5000
```
The tables are created automatically on start (`src/db/migrations/`). Nothing else to run.

**3. Frontend** (terminal 2)
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Open http://localhost:5173. Create an **instructor** account, make a course, upload a file and add a quiz. Then sign up as a **student** in a private window, enroll, and take the quiz.

## Tests

```bash
cd backend
npm test                                   # no database needed
TEST_DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/lms_test npm test   # adds the full-flow test (create the lms_test database first; it is wiped on every run)
```

## Using it on AWS later

- **Database:** point `DATABASE_URL` at your RDS PostgreSQL endpoint and set `DB_SSL=true`. URL-encode special characters in the password, or use an alphanumeric one. Put both values in SSM Parameter Store.
- **Migrations:** the API applies them on startup, guarded by a database lock, so several instances starting together are safe. A container only needs `node src/server.js`.
- **Files:** set `S3_BUCKET` (and `AWS_REGION`) to switch uploads from the local disk to S3 presigned URLs. No code changes. The bucket needs CORS for `PUT` from your CloudFront domain.
- **Health checks:** `GET /api/health` is the liveness check (always 200 while the process runs, with a `db` flag). Use it for the ALB target group. `GET /api/ready` returns 503 when the database is unreachable. Use it for the post-deploy check.
- **Routing:** the frontend calls the API at the relative path `/api`, so route `/api/*` to the backend (CloudFront behavior or proxy). In dev, Vite proxies it to port 5000.

## Structure

```
backend/
  src/
    app.js, server.js      Express app and startup
    db/                    pg pool, migration runner, migrations/001_init.sql
    routes/                auth.js, courses.js
    lib/                   storage (S3 or local disk), helpers
  tests/
frontend/
  src/                     React app (pages, components, styles)
```

## API

| Method | Path | Who |
|---|---|---|
| GET | `/api/health`, `/api/ready` | anyone |
| POST | `/api/auth/register`, `/api/auth/login` | anyone |
| GET | `/api/auth/me` | signed in |
| GET | `/api/courses`, `/api/courses/mine`, `/api/courses/:id` | signed in |
| POST | `/api/courses` | instructor |
| POST | `/api/courses/:id/enroll` | student |
| POST | `/api/courses/:id/materials/upload-url`, `/api/courses/:id/materials` | course owner |
| GET | `/api/courses/:id/materials/:materialId/download-url` | owner or enrolled student |
| PUT | `/api/courses/:id/quiz` | course owner |
| POST | `/api/courses/:id/quiz/submit` | enrolled student |
