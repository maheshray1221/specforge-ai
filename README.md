# SpecForge AI — Full-Stack MVP

SpecForge AI converts client requirements into clarification questions, functional requirements, user stories, technical plans, engineering tasks and sprint-ready work.

## Included MVP workflow

1. Register or log in
2. Create a workspace-backed project
3. Add and version client requirements
4. Analyze a requirement with Groq
5. Generate frontend, backend, QA, DevOps, design and documentation tasks
6. Move tasks through a Kanban workflow
7. Create sprints and assign tasks with capacity checks

## Tech stack

### Frontend

- Next.js App Router + TypeScript
- Tailwind CSS
- shadcn/ui-style components with Radix primitives
- Framer Motion
- Responsive light UI

### Backend

- Node.js + Express + TypeScript
- PostgreSQL + Prisma
- JWT access cookie + rotating refresh sessions
- Zod validation
- Groq structured JSON output (`openai/gpt-oss-120b` by default)
- Pino logging, Helmet, CORS and rate limiting
- Swagger UI

## Project structure

```text
specforge-ai-mvp/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   └── src/
│   └── frontend/
│       ├── app/
│       ├── components/
│       └── lib/
├── compose.yaml
└── package.json
```

## Local setup

### 1. Requirements

- Node.js 20.19 or newer
- Docker Desktop
- A Groq API key

### 2. Create environment files

PowerShell:

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/frontend/.env.example apps/frontend/.env.local
```

CMD:

```cmd
copy apps\backend\.env.example apps\backend\.env
copy apps\frontend\.env.example apps\frontend\.env.local
```

Add your key to `apps/backend/.env`:

```env
GROQ_API_KEY=gsk_your_key
```

Generate a strong JWT secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste the output into:

```env
JWT_ACCESS_SECRET=your_generated_secret
```

### 3. Start PostgreSQL

From the project root:

```powershell
docker compose up -d
```

The database is available on host port `5433` to avoid conflicts with a locally installed PostgreSQL service.

### 4. Install dependencies

```powershell
npm install
```

### 5. Generate Prisma Client and create tables

```powershell
npm run db:generate
npm run db:migrate -- --name init
```

### 6. Start frontend and backend

```powershell
npm run dev
```

Open:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Swagger: `http://localhost:5000/api-docs`
- Health: `http://localhost:5000/api/v1/health`

## Important environment values

Backend (`apps/backend/.env`):

```env
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/specforge?schema=public
GROQ_MODEL=openai/gpt-oss-120b
COOKIE_SECURE=false
```

For production, set `NODE_ENV=production`, use HTTPS, use a managed PostgreSQL URL, and set `FRONTEND_URL` to the deployed frontend origin. Auth cookies are configured as `Secure` + `SameSite=None` automatically in production and `SameSite=Lax` locally.

## API overview

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

POST   /api/v1/projects
GET    /api/v1/projects?workspaceId=...
GET    /api/v1/projects/:projectId
PATCH  /api/v1/projects/:projectId
DELETE /api/v1/projects/:projectId

POST   /api/v1/projects/:projectId/requirements
GET    /api/v1/projects/:projectId/requirements
GET    /api/v1/requirements/:requirementId
PATCH  /api/v1/requirements/:requirementId
DELETE /api/v1/requirements/:requirementId

POST   /api/v1/requirements/:requirementId/analyze
GET    /api/v1/requirements/:requirementId/analyses
GET    /api/v1/analyses/:analysisId

POST   /api/v1/analyses/:analysisId/tasks/generate
GET    /api/v1/projects/:projectId/tasks
PATCH  /api/v1/tasks/:taskId

POST   /api/v1/projects/:projectId/sprints
GET    /api/v1/projects/:projectId/sprints
PATCH  /api/v1/sprints/:sprintId
POST   /api/v1/sprints/:sprintId/tasks/:taskId
DELETE /api/v1/sprints/:sprintId/tasks/:taskId
```

## Notes

- No automated test or test-case files are included, as requested.
- AI calls run synchronously in the MVP. A Redis/BullMQ worker can be added later when usage grows.
- Projects are archived rather than permanently deleted.
