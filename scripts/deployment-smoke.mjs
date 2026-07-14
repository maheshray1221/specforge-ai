const backendBaseUrl = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1").replace(/\/$/, "");
const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, "");

async function assertJsonEndpoint(url, expectedStatus) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (response.status !== expectedStatus) {
    throw new Error(`${url} returned ${response.status}; expected ${expectedStatus}`);
  }

  const payload = await response.json();
  if (payload?.success !== true) {
    throw new Error(`${url} did not return a successful SpecForge response`);
  }

  return payload;
}

async function assertFrontend(url) {
  const response = await fetch(url, {
    headers: { Accept: "text/html" },
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}; expected a successful frontend response`);
  }
}

console.log(`Checking backend: ${backendBaseUrl}`);
await assertJsonEndpoint(`${backendBaseUrl}/health`, 200);
await assertJsonEndpoint(`${backendBaseUrl}/ready`, 200);

if (frontendUrl) {
  console.log(`Checking frontend: ${frontendUrl}`);
  await assertFrontend(frontendUrl);
} else {
  console.log("Skipping frontend check because FRONTEND_URL is not set.");
}

console.log("Deployment smoke checks passed.");
