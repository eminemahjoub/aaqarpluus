import { SignJWT, jwtVerify } from "jose";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getJwtSecret() {
  return new TextEncoder().encode(requireEnv("JWT_SECRET"));
}

function getJwtRefreshSecret() {
  return new TextEncoder().encode(requireEnv("JWT_REFRESH_SECRET"));
}

// Cookies
const TOKEN_COOKIE_BASE = "aaqar_token";
const REFRESH_COOKIE_BASE = "aaqar_refresh_token";

const isProd = process.env.NODE_ENV === "production";

// __Host- prefix requires Secure, Path=/, and no Domain attribute
const TOKEN_COOKIE = isProd ? `__Host-${TOKEN_COOKIE_BASE}` : TOKEN_COOKIE_BASE;
const REFRESH_COOKIE = isProd ? `__Host-${REFRESH_COOKIE_BASE}` : REFRESH_COOKIE_BASE;

// Expirations
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export { TOKEN_COOKIE, REFRESH_COOKIE, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY };

export function serializeAuthCookie(name: string, token: string, maxAgeSeconds: number) {
  const secure = isProd ? "; Secure" : "";
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
}

export interface JwtPayload {
  userId: string;
  email: string;
  userType: string;
  officeId?: string | null;
}

export interface RefreshJwtPayload {
  userId: string;
  tokenVersion: number;
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export async function signRefreshToken(payload: RefreshJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(getJwtRefreshSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtRefreshSecret());
    return payload as unknown as RefreshJwtPayload;
  } catch {
    return null;
  }
}

// CSRF Double Submit Cookie
const CSRF_COOKIE = isProd ? "__Host-csrf_token" : "csrf_token";

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function serializeCsrfCookie(token: string) {
  const secure = isProd ? "; Secure" : "";
  return `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax${secure}; Max-Age=86400`;
}

export function validateCsrfToken(req: { cookies: { get: (name: string) => { value?: string } | undefined }; headers: { get: (name: string) => string | null } }): boolean {
  const headerToken = req.headers.get("x-csrf-token");
  if (!headerToken) return false;
  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value ?? req.cookies.get("csrf_token")?.value;
  if (!cookieToken) return false;
  return cookieToken === headerToken;
}
