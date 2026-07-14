# Production Readiness Runbook

SpecForge AI can move to a production pilot only after this checklist passes in the target environment. Billing remains intentionally out of scope.

## Required production environment

Backend:

- `NODE_ENV=production`
- `PORT` is provided by the hosting platform or set explicitly.
- `API_PREFIX=/api/v1`
- `DATABASE_URL` points to the managed production PostgreSQL database.
- `JWT_ACCESS_SECRET` is a unique high-entropy secret, not shared with development.
- `FRONTEND_URL` is the exact HTTPS frontend origin, with no trailing slash.
- `COOKIE_SECURE=true`
- `LOG_LEVEL=info` or stricter.
- `GROQ_API_KEY` is configured for the production AI provider account.
- `GROQ_BASE_URL`, `GROQ_MODEL`, and `GROQ_REASONING_EFFORT` are set intentionally.
- `AI_MAX_INPUT_CHARACTERS`, `AI_REQUEST_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_MONTHLY_JOB_QUOTA`, and `AI_MONTHLY_TOKEN_QUOTA` are reviewed before launch.

Frontend:

- `NEXT_PUBLIC_API_URL` points to the deployed backend API prefix, for example `https://api.example.com/api/v1`.

Infrastructure:

- Backend and frontend are served over HTTPS.
- Production, staging, and local development use separate databases, secrets, provider keys, and frontend origins.
- Automated database backups are enabled before external users are invited.

## Pre-deployment release gate

Run from the repository root before every production deployment:

```powershell
npm ci
npm run db:generate
npm run release:check
```

The release is blocked if dependency installation, lint, type checking, production build, or the critical Playwright E2E flow fails.

## Deployment sequence

1. Confirm the release commit is pushed and CI is green.
2. Apply committed migrations against the target database:

   ```powershell
   npm run db:deploy
   ```

3. Build the backend and frontend:

   ```powershell
   npm run build
   ```

4. Deploy the backend.
5. Verify backend liveness and readiness:

   ```powershell
   $env:BACKEND_URL="https://api.example.com/api/v1"
   npm run deploy:smoke
   ```

6. Deploy the frontend.
7. Verify backend and frontend together:

   ```powershell
   $env:BACKEND_URL="https://api.example.com/api/v1"
   $env:FRONTEND_URL="https://app.example.com"
   npm run deploy:smoke
   ```

8. Run the manual pilot smoke flow in a browser:
   - register or log in;
   - refresh the page and confirm the session restores;
   - create a project;
   - create and edit a requirement;
   - run AI analysis;
   - answer required clarifications if any;
   - approve the requirement;
   - generate tasks;
   - move a task through the board;
   - create a sprint and assign a task;
   - verify usage, analytics, collaboration, integrations, and export UI load without errors.

## Health checks

- Liveness: `GET /api/v1/health`
- Readiness: `GET /api/v1/ready`

`/ready` validates database connectivity and returns AI job status counts. A failing readiness check blocks rollout.

## Backup and restore drill

- Configure automated database backups in the managed PostgreSQL provider.
- Before private beta, restore the latest backup into staging.
- Verify restored data by loading `/api/v1/ready` and logging in against staging.
- Record restore time, backup timestamp, and any data-loss window.
- Repeat the restore drill after major schema changes.

## Monitoring checks

Production monitoring must cover:

- API 5xx errors and latency spikes.
- Auth failures, refresh failures, and suspicious rate-limit spikes.
- Database connectivity/readiness.
- AI job failures, retries, duration, token usage, and quota exhaustion.
- Activation funnel drop-offs and AI feedback events.
- Background job backlog and stuck `PROCESSING` jobs.

## Rollback

If backend readiness fails after deployment:

1. Stop frontend rollout.
2. Roll the backend back to the previous healthy version.
3. Do not roll back database migrations unless a tested down-migration or restore plan exists.
4. Confirm `/api/v1/ready` returns healthy before resuming.

If frontend deployment fails:

1. Keep the previous frontend version active.
2. Confirm the backend still passes `npm run deploy:smoke`.
3. Fix and redeploy the frontend from a new commit.
