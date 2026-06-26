import { ApiError } from "./api-error.js";

export function getRouteParam(value: unknown, parameterName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(
      400,
      `Missing or invalid route parameter: ${parameterName}`,
    );
  }

  return value.trim();
}
