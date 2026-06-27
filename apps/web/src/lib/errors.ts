export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "INTERNAL";

export class AppError extends Error {
  status: number;
  code: ErrorCode;
  details?: unknown;

  constructor(args: { message: string; status?: number; code?: ErrorCode; details?: unknown; cause?: unknown }) {
    super(args.message);
    this.name = "AppError";
    this.status = args.status ?? 500;
    this.code = args.code ?? (this.status >= 500 ? "INTERNAL" : "BAD_REQUEST");
    this.details = args.details;
    if (args.cause !== undefined) (this as any).cause = args.cause;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new AppError({ status: 400, code: "BAD_REQUEST", message, details });
}
export function unauthorized(message = "غير مصرح") {
  return new AppError({ status: 401, code: "UNAUTHORIZED", message });
}
export function forbidden(message = "ممنوع") {
  return new AppError({ status: 403, code: "FORBIDDEN", message });
}
export function notFound(message = "غير موجود") {
  return new AppError({ status: 404, code: "NOT_FOUND", message });
}
export function rateLimited(message = "طلبات كثيرة، حاول لاحقاً") {
  return new AppError({ status: 429, code: "RATE_LIMITED", message });
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractUniqueField(message: string): string | null {
  const m = message.match(/Key \(([^)]+)\)=/);
  if (!m) return null;
  const column = m[1];
  const map: Record<string, string> = {
    phone: "رقم الجوال",
    email: "البريد الإلكتروني",
    id_number: "رقم الهوية",
  };
  return map[column] ?? column;
}

export function handleError(err: unknown) {
  const isDev = process.env.NODE_ENV === "development";
  if (err instanceof AppError) {
    return jsonResponse(
      {
        error: err.message,
        code: err.code,
        ...(isDev && err.details !== undefined ? { details: err.details } : {}),
      },
      err.status
    );
  }
  const pgErr = err as { code?: string; message?: string };
  if (pgErr.code === "23505" && pgErr.message) {
    const field = extractUniqueField(pgErr.message);
    return jsonResponse({ error: `${field} مستخدم مسبقاً.`, code: "DUPLICATE" }, 400);
  }
  console.error(err);
  return jsonResponse({ error: "خطأ في الخادم", code: "INTERNAL" }, 500);
}

