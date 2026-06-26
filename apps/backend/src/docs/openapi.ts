export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "SpecForge AI API",
    version: "1.0.0",
    description: "Requirement-to-task planning API",
  },
  servers: [{ url: "/api/v1" }],
  tags: [
    { name: "Auth" }, { name: "Projects" }, { name: "Requirements" },
    { name: "AI Analysis" }, { name: "Tasks" }, { name: "Sprints" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: { type: "object", properties: { success: { type: "boolean", example: false }, error: { type: "object", properties: { message: { type: "string" } } } } },
      Login: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } },
      Register: { type: "object", required: ["name", "email", "password"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } },
      ProjectInput: { type: "object", required: ["workspaceId", "name", "key"], properties: { workspaceId: { type: "string", format: "uuid" }, name: { type: "string" }, key: { type: "string" }, description: { type: "string" } } },
      RequirementInput: { type: "object", required: ["title", "content"], properties: { title: { type: "string" }, content: { type: "string" }, status: { type: "string", enum: ["DRAFT", "READY", "NEEDS_CLARIFICATION"] } } },
    },
  },
  paths: {
    "/auth/register": { post: { tags: ["Auth"], summary: "Register", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Register" } } } }, responses: { "201": { description: "Registered" } } } },
    "/auth/login": { post: { tags: ["Auth"], summary: "Login", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Login" } } } }, responses: { "200": { description: "Logged in" } } } },
    "/auth/me": { get: { tags: ["Auth"], summary: "Current user", security: [{ bearerAuth: [] }], responses: { "200": { description: "Current user" } } } },
    "/projects": {
      post: { tags: ["Projects"], summary: "Create project", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectInput" } } } }, responses: { "201": { description: "Created" } } },
      get: { tags: ["Projects"], summary: "List projects", security: [{ bearerAuth: [] }], parameters: [{ in: "query", name: "workspaceId", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Projects" } } },
    },
    "/projects/{projectId}/requirements": {
      post: { tags: ["Requirements"], summary: "Create requirement", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "projectId", required: true, schema: { type: "string", format: "uuid" } }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RequirementInput" } } } }, responses: { "201": { description: "Created" } } },
      get: { tags: ["Requirements"], summary: "List requirements", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "projectId", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Requirements" } } },
    },
    "/requirements/{requirementId}/analyze": { post: { tags: ["AI Analysis"], summary: "Analyze requirement", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "requirementId", required: true, schema: { type: "string", format: "uuid" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { force: { type: "boolean" } } } } } }, responses: { "201": { description: "Analyzed" } } } },
    "/analyses/{analysisId}/tasks/generate": { post: { tags: ["Tasks"], summary: "Generate tasks", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "analysisId", required: true, schema: { type: "string", format: "uuid" } }], responses: { "201": { description: "Generated" } } } },
    "/projects/{projectId}/tasks": { get: { tags: ["Tasks"], summary: "List project tasks", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "projectId", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Tasks" } } } },
    "/projects/{projectId}/sprints": {
      post: { tags: ["Sprints"], summary: "Create sprint", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "projectId", required: true, schema: { type: "string", format: "uuid" } }], responses: { "201": { description: "Created" } } },
      get: { tags: ["Sprints"], summary: "List sprints", security: [{ bearerAuth: [] }], parameters: [{ in: "path", name: "projectId", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Sprints" } } },
    },
  },
};
