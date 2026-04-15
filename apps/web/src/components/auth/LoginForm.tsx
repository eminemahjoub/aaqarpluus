"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authInputClass, authLabelClass } from "./auth-input-classes";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const idValue = identifier.trim();
    const pass = password.trim();

    if (!idValue) { setError("يرجى إدخال البريد الإلكتروني أو رقم الجوال."); return; }
    if (!pass) { setError("يرجى إدخال كلمة المرور."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: idValue, password: pass }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "تعذّر تسجيل الدخول. حاول مرة أخرى.");
        return;
      }

      const ut = String(data?.user?.userType ?? "");
      const nextPath =
        ut === "superadmin"
          ? "/admin"
          : ut === "agency"
            ? "/agency"
            : "/dashboard";
      // Force full navigation so auth cookie is applied.
      window.location.assign(nextPath);
    } catch {
      setError("تعذّر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="login-identifier" className={authLabelClass}>البريد الإلكتروني أو رقم الجوال</label>
        <input
          id="login-identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          dir="ltr"
          className={authInputClass}
          placeholder="name@example.com أو 05xxxxxxxx"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="login-password" className={authLabelClass}>
          كلمة المرور
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={authInputClass}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C5A021] px-4 py-3 text-base font-semibold text-white shadow-md transition hover:scale-[1.01] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A021]/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            جاري تسجيل الدخول…
          </>
        ) : (
          "تسجيل الدخول"
        )}
      </button>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        ليس لديك حساب؟{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary underline-offset-4 transition hover:text-secondary hover:underline"
        >
          إنشاء حساب
        </Link>
      </p>
    </form>
  );
}
