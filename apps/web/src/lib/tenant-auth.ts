import { SignJWT, jwtVerify } from "jose";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const JWT_SECRET = new TextEncoder().encode(requireEnv("JWT_SECRET"));

const isProd = process.env.NODE_ENV === "production";

export const TENANT_TOKEN_COOKIE = isProd ? "__Host-tenant_token" : "tenant_token";

export function serializeTenantCookie(token: string, maxAgeSeconds: number) {
  const secure = isProd ? "; Secure" : "";
  return `${TENANT_TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAgeSeconds}`;
}

export interface TenantJwtPayload {
  tenantId: string;
  email: string;
  name: string;
  userType: "tenant";
}

export async function signTenantToken(payload: TenantJwtPayload): Promise<string> {
  return new SignJWT({ ...payload, userType: "tenant" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyTenantToken(token: string): Promise<TenantJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.userType !== "tenant") return null;
    return {
      tenantId: String(payload.tenantId),
      email: String(payload.email),
      name: String(payload.name),
      userType: "tenant",
    };
  } catch {
    return null;
  }
}
