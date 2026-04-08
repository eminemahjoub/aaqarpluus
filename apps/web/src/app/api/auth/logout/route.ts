import { TOKEN_COOKIE } from "@/lib/auth";
import { ok } from "@/lib/api-helpers";

export async function POST() {
  const response = ok({ success: true });
  response.headers.set(
    "Set-Cookie",
    `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return response;
}
