import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

const isProduction = process.env.NODE_ENV === "production";
const cookieSameSite = process.env.COOKIE_SAME_SITE || "lax";
if (!["lax", "strict", "none"].includes(cookieSameSite)) {
  throw new Error("COOKIE_SAME_SITE must be lax, strict, or none");
}
if (cookieSameSite === "none" && process.env.COOKIE_SECURE !== "true") {
  throw new Error("COOKIE_SECURE must be true when COOKIE_SAME_SITE is none");
}

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigin: required(
    "CLIENT_ORIGIN",
    isProduction ? undefined : "http://localhost:5173",
  ),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || "adb_refresh_token",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  cookieSameSite: cookieSameSite as "lax" | "strict" | "none",
  cookieDomain: process.env.COOKIE_DOMAIN,
};
