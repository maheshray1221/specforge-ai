import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error.js";
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "./auth.cookies.js";
import * as authService from "./auth.service.js";

export const register: RequestHandler = async (req, res) => {
  const result = await authService.register(req.body);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(201).json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
};

export const login: RequestHandler = async (req, res) => {
  const result = await authService.login(req.body);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
};

export const refresh: RequestHandler = async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!rawToken) throw new ApiError(401, "Refresh token is missing");
  const result = await authService.refresh(rawToken);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  res.status(204).send();
};

export const me: RequestHandler = async (req, res) => {
  res.json({ success: true, data: { user: await authService.getMe(req.user!.id) } });
};
