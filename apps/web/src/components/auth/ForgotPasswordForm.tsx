"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authInputClass, authLabelClass } from "./auth-input-classes";

/**
 * Two-state forgot-password form:
 *  (a) email request form — always shows a generic success message
 *      (anti user-enumeration); in development the API returns a devLink
 *      that is surfaced for local testing.
 *  (b) reset form — rendered when ?token & ?email are present in the URL;
 *      validates password length + confirmation, then redirects to /login.
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token");
  const urlEmail = searchParams.get("email");
  const isResetMode = Boolean(urlToken && urlEmail);

  const [email, setEmail] = React.useState(urlEmail ?? "");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [devLink, setDevLink] = React.useState<string | null>(null);

  async function onRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!value) {
      setError("يرجى إدخال البريد الإلكتروني.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "حدث خطأ. حاول مرة أخرى.");
        return;
      }
      setSent(true);
      if (process.env.NODE_ENV === "development" && typeof data?.devLink === "string") {
        setDevLink(data.devLink);
      }
    } catch {
      setError("حدث خطأ. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  async function onResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: urlToken, email: urlEmail, newPassword: password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "الرابط غير صالح أو منتهي.");
        return;
      }
      router.push("/login");
    } catch {
      setError("حدث خطأ. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  if (isResetMode) {
    return (
      <form onSubmit={onResetSubmit} className="space-y-5">
        <div>
          <label className={authLabelClass}>كلمة المرور الجديدة</label>
          <input
            type="password"
            className={authInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6 أحرف على الأقل"
            minLength={6}
            required
            dir="ltr"
          />
        </div>
        <div>
          <label className={authLabelClass}>تأكيد كلمة المرور</label>
          <input
            type="password"
            className={authInputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="أعد إدخال كلمة المرور"
            required
            dir="ltr"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C5A021] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          حفظ كلمة المرور الجديدة
        </button>
      </form>
    );
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          إذا كان البريد الإلكتروني مسجلاً في المنصة، ستصلك رسالة تحوي رابط استعادة
          كلمة المرور خلال دقائق.
        </p>
        {devLink && (
          <a
            href={devLink}
            className="block break-all rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
            dir="ltr"
          >
            وضع التطوير: {devLink}
          </a>
        )}
        <button
          onClick={() => setSent(false)}
          className="text-sm font-medium text-gray-500 hover:underline dark:text-gray-400"
        >
          العودة
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onRequestReset} className="space-y-5">
      <div>
        <label className={authLabelClass}>البريد الإلكتروني</label>
        <input
          type="email"
          className={authInputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
          dir="ltr"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C5A021] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        إرسال رابط الاستعادة
      </button>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        تذكرت كلمة المرور؟{" "}
        <Link href="/login" className="font-medium text-[#C5A021] hover:underline">
          تسجيل الدخول
        </Link>
      </p>
    </form>
  );
}