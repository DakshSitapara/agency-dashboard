import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt";
import { env } from "../config/env";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshCookieOptions() {
  return {
    httpOnly: true, // never readable from JS - mitigates XSS token theft
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

async function issueTokenPair(userId: string, role: any) {
  const accessToken = signAccessToken({ sub: userId, role });

  // Create the DB row first so we have an id to embed in the JWT, then sign
  // the refresh JWT around that id. This lets us revoke individual refresh
  // tokens (logout, rotation, or an admin force-revoking a user) without
  // needing a blocklist of raw tokens.
  const dummyHash = crypto.randomBytes(32).toString("hex");
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: dummyHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const refreshToken = signRefreshToken({ sub: userId, tokenId: row.id });
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { tokenHash: hashToken(refreshToken) },
  });

  return { accessToken, refreshToken };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const { accessToken, refreshToken } = await issueTokenPair(
    user.id,
    user.role,
  );
  res.cookie(env.refreshCookieName, refreshToken, refreshCookieOptions());

  res.json({
    success: true,
    data: {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[env.refreshCookieName];
  if (!token) throw ApiError.unauthorized("Missing refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const row = await prisma.refreshToken.findUnique({
    where: { id: payload.tokenId },
  });
  if (
    !row ||
    row.revoked ||
    row.expiresAt < new Date() ||
    row.tokenHash !== hashToken(token)
  ) {
    throw ApiError.unauthorized("Refresh token is no longer valid");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.unauthorized("User no longer exists");

  // Rotate: revoke the used token, issue a brand new pair. Prevents replay
  // of a stolen refresh token beyond a single use.
  const revoked = await prisma.refreshToken.updateMany({
    where: { id: row.id, revoked: false, tokenHash: hashToken(token) },
    data: { revoked: true },
  });
  if (revoked.count !== 1) {
    throw ApiError.unauthorized("Refresh token is no longer valid");
  }
  const { accessToken, refreshToken } = await issueTokenPair(
    user.id,
    user.role,
  );
  res.cookie(env.refreshCookieName, refreshToken, refreshCookieOptions());

  res.json({
    success: true,
    data: {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[env.refreshCookieName];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await prisma.refreshToken.updateMany({
        where: { id: payload.tokenId },
        data: { revoked: true },
      });
    } catch {
      // token already invalid - nothing to revoke
    }
  }
  res.clearCookie(env.refreshCookieName, { path: "/api/auth" });
  res.json({ success: true, data: null });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: req.user });
});

// Admin-only: onboard new team members.
export const registerUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, email, password, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      throw ApiError.conflict("A user with this email already exists");

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
    });
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  },
);
