import { SignJWT, jwtVerify } from "jose";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const JWT_SECRET = new TextEncoder().encode(requireEnv("JWT_SECRET"));
const JWT_REFRESH_SECRET = new TextEncoder().encode(requireEnv("JWT_REFRESH_SECRET"));

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
    .sign(JWT_SECRET);
}

export async function signRefreshToken(payload: RefreshJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_REFRESH_SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_REFRESH_SECRET);
    return payload as unknown as RefreshJwtPayload;
  } catch {
    return null;
  }
}
