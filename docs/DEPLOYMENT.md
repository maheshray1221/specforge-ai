# Deployment Guide

SpecForge AI is ready to deploy after the release gate and CI pass.

## Current target

Use Render for the first production pilot:

- PostgreSQL: Render managed PostgreSQL
- Backend: Render Node web service
- Frontend: Render Node web service running Next.js

The repository includes a `render.yaml` Blueprint for this setup.

## Before creating the Blueprint

Confirm CI is green on `main`, then keep these values ready:

- `GROQ_API_KEY`
- Backend `SENTRY_DSN`
- Frontend `NEXT_PUBLIC_SENTRY_DSN`

Render will generate:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `INTEGRATION_SECRET_KEY`

## Render Blueprint steps

1. Open Render Dashboard.
2. Create a new Blueprint from this GitHub repository.
3. Select `render.yaml`.
4. Fill the prompted secret values:
   - backend `GROQ_API_KEY`
   - backend `SENTRY_DSN`
   - frontend `NEXT_PUBLIC_SENTRY_DSN`
   - backend `FRONTEND_URL`
   - frontend `NEXT_PUBLIC_API_URL`
5. Use the deployed frontend URL for backend `FRONTEND_URL`.
6. Use the deployed backend API prefix for frontend `NEXT_PUBLIC_API_URL`, for example:

   ```text
   https://specforge-ai-api.onrender.com/api/v1
   ```

7. Let Render build and deploy both services.

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
