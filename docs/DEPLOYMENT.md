# Deployment Guide

SpecForge AI is ready to deploy after the release gate and CI pass.

## Current target

Use Render for the backend production pilot:

- PostgreSQL: existing Neon database
- Backend: Render Node web service
- Frontend: existing deployed frontend

The repository includes a backend-only `render.yaml` Blueprint for this setup.

## Before creating the Blueprint

Confirm CI is green on `main`, then keep these values ready:

- `GROQ_API_KEY`
- Neon `DATABASE_URL` with `sslmode=require`
- Existing frontend URL for `FRONTEND_URL`
- Backend `SENTRY_DSN`

Render will generate:

- `JWT_ACCESS_SECRET`
- `INTEGRATION_SECRET_KEY`

## Render Blueprint steps

1. Open Render Dashboard.
2. Create a new Blueprint from this GitHub repository.
3. Select `render.yaml`.
4. Fill the prompted secret values:
   - backend `DATABASE_URL` from Neon
   - backend `GROQ_API_KEY`
   - backend `SENTRY_DSN`
   - backend `FRONTEND_URL`
5. Use the deployed frontend URL for backend `FRONTEND_URL`.
6. Let Render build and deploy the backend service.
7. After backend deployment, update the existing frontend environment with the backend API prefix:

   ```text
   https://specforge-ai-api.onrender.com/api/v1
   ```

8. Redeploy the existing frontend so it uses the new backend.

## Post-deployment smoke checks

From the repository root:

```powershell
$env:BACKEND_URL="https://your-backend-host/api/v1"
$env:FRONTEND_URL="https://your-frontend-host"
npm run deploy:smoke
```

Then manually verify:

1. Register or log in.
2. Refresh the page and confirm the session restores.
3. Create a project.
4. Create and edit a requirement.
5. Run AI analysis.
6. Approve the requirement.
7. Generate tasks.
8. Create a sprint and assign a task.
9. Confirm exports and integrations screens load.

## Monitoring verification

Before inviting users:

- Trigger a backend 500 and confirm it appears in backend Sentry.
- Trigger a frontend error and confirm it appears in frontend Sentry.
- Add uptime monitoring for:
  - `GET https://your-backend-host/api/v1/health`
  - `GET https://your-backend-host/api/v1/ready`

## Rollback

If `/api/v1/ready` fails after deployment, roll back the backend service to the previous healthy deploy before continuing frontend rollout.
