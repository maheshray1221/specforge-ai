# Production Readiness Runbook

SpecForge AI is production-ready only after this checklist passes in the target environment.

## Required environment

- `NODE_ENV=production`
- `DATABASE_URL` points to the production PostgreSQL database.
- `JWT_ACCESS_SECRET` is a unique 32+ character secret.
- `FRONTEND_URL` is the exact HTTPS frontend origin.
- `COOKIE_SECURE=true`
- `GROQ_API_KEY` is configured for the production provider account.
- `AI_MONTHLY_JOB_QUOTA` and `AI_MONTHLY_TOKEN_QUOTA` are set intentionally.
- Frontend `NEXT_PUBLIC_API_URL` points to the deployed backend API prefix.

## Deployment sequence

1. Install dependencies with `npm ci`.
2. Generate Prisma client with `npm run db:generate`.
3. Apply committed migrations with `npm run db:deploy`.
4. Build with `npm run build`.
5. Deploy backend.
6. Verify `GET /api/v1/health`.
7. Verify `GET /api/v1/ready`.
8. Deploy frontend.
9. Run the complete smoke flow: register/login, create project, create requirement, analyze, approve, generate tasks, create sprint.

## Release gate

Run before every production release:

```powershell
npm run release:check
```

The release is blocked if lint, typecheck, build, migration deploy, health/readiness, or the critical E2E flow fails.

## Backup and restore drill

- Configure automated database backups in the managed PostgreSQL provider.
- Before public launch, run a restore drill into a staging database.
- Verify restored data by loading `/api/v1/ready` and logging in against staging.
- Record restore time, backup timestamp, and any data loss window.

## Monitoring checks

Production monitoring must cover:

- API 5xx errors and latency spikes.
- Auth failures and refresh failures.
- Database connectivity/readiness.
- AI job failures, retries, and quota exhaustion.
- Activation funnel drop-offs and AI feedback events.

## Rollback

If backend readiness fails after deployment:

1. Stop frontend rollout.
2. Roll backend back to the previous healthy version.
3. Do not roll back database migrations unless a tested down-migration or restore plan exists.
4. Confirm `/api/v1/ready` returns healthy before resuming.
