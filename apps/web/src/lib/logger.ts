/**
 * Structured logger that respects log levels.
 * In production, only warn/error are emitted unless DEBUG=1 is set.
 */

const isDev = process.env.NODE_ENV === "development";
const isDebug = process.env.DEBUG === "1";

function shouldLog(level: "info" | "warn" | "error") {
  if (isDev || isDebug) return true;
  return level !== "info";
}

function format(args: unknown[]) {
  return args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
}

export const log = {
  info(...args: unknown[]) {
    if (shouldLog("info")) {
      // eslint-disable-next-line no-console
      console.log(`[INFO] ${format(args)}`);
    }
  },
  warn(...args: unknown[]) {
    if (shouldLog("warn")) {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${format(args)}`);
    }
  },
  error(...args: unknown[]) {
    if (shouldLog("error")) {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${format(args)}`);
    }
  },
};
