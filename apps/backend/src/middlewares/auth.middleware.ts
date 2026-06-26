import type { RequestHandler } from "express";
import { ACCESS_COOKIE } from "../modules/auth/auth.cookies.js";
import { verifyAccessToken } from "../modules/auth/auth.token.js";
import { ApiError } from "../utils/api-error.js";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = bearer ?? req.cookies?.[ACCESS_COOKIE];
    if (!token) throw new ApiError(401, "Authentication required");
    const payload = await verifyAccessToken(token);
    req.user = { id: payload.userId, email: payload.email };
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, "Access token is invalid or expired"));
  }
};
