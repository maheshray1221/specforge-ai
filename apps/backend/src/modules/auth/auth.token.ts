import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export const createAccessToken = async (payload: { userId: string; email: string }): Promise<string> =>
  new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .setIssuer("specforge-api")
    .setAudience("specforge-web")
    .sign(secret);

export const verifyAccessToken = async (token: string): Promise<{ userId: string; email: string }> => {
  const { payload } = await jwtVerify(token, secret, {
    issuer: "specforge-api",
    audience: "specforge-web",
  });
  if (!payload.sub || typeof payload.email !== "string") throw new Error("Invalid access token");
  return { userId: payload.sub, email: payload.email };
};

export const createRefreshToken = (): string => randomBytes(48).toString("base64url");
export const hashRefreshToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const refreshExpiry = (): Date => new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
