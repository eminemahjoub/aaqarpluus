import { SignJWT, jwtVerify } from "jose";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const JWT_SECRET = new TextEncoder().encode(requireEnv("JWT_SECRET"));
const JWT_REFRESH_SECRET = new TextEncoder().encode(requireEnv("JWT_REFRESH_SECRET"));

// Cookies
const TOKEN_COOKIE = "aaqar_token"; // access token
const REFRESH_COOKIE = "aaqar_refresh_token";

// Expirations
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export { TOKEN_COOKIE, REFRESH_COOKIE, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY };

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
