"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authInputClass, authLabelClass } from "./auth-input-classes";

const USER_TYPES = [
  { value: "owner" as const, label: "مالك" },
  { value: "agency" as const, label: "مكتب" },
];

export type UserTypeValue = (typeof USER_TYPES)[number]["value"];

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [userType, setUserType] = React.useState<UserTypeValue | "">("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{ userType?: string; phone?: string }>({});

  function handlePhoneChange(value: string) {
    setPhone(value);
    const trimmed = value.trim();
    if (!trimmed) { setFieldErrors((p) => ({ ...p, phone: undefined })); return; }
    if (!/^[0-9]+$/.test(trimmed)) { setFieldErrors((p) => ({ ...p, phone: "أدخل أرقاماً فقط" })); return; }
    if (!trimmed.startsWith("05") || trimmed.length !== 10) {
      setFieldErrors((p) => ({ ...p, phone: "يجب أن يبدأ بـ 05 ويتكون من 10 أرقام" }));
      return;
    }
    setFieldErrors((p) => ({ ...p, phone: undefined }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!userType) { setFieldErrors({ userType: "يرجى اختيار نوع الحساب" }); return; }
    const name = fullName.trim();
    if (!name) { setError("يرجى إدخال الاسم الكامل."); return; }
    const phoneValue = phone.trim();
    if (!phoneValue) { setFieldErrors({ phone: "رقم الجوال مطلوب" }); return; }
    if (!email.trim()) { setError("يرجى إدخال البريد الإلكتروني."); return; }
    if (password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل."); return; }

    if (!/^[0-9]+$/.test(phoneValue)) {
      setFieldErrors({ phone: "أدخل أرقاماً فقط" });
      return;
    }
    if (!phoneValue.startsWith("05") || phoneValue.length !== 10) {
      setError("رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          fullName: name,
          phone: `+966${phoneValue.substring(1)}`,
          userType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "تعذّر إنشاء الحساب. حاول مرة أخرى.");
        return;
      }

      const nextPath =
        String(data?.user?.userType ?? userType) === "agency"
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
        <label htmlFor="signup-name" className={authLabelClass}>الاسم الكامل</label>
        <input
          id="signup-name"
          name="fullName"
          type="text"
          autoComplete="name"
          className={authInputClass}
          placeholder="الاسم كما سيظهر في حسابك"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
        />
      </div>

      <fieldset className="space-y-3 border-0 p-0">
        <legend id="user-type-label" className={authLabelClass}>نوع الحساب</legend>
        <div role="radiogroup" aria-labelledby="user-type-label" aria-required="true" className="grid gap-2">
          {USER_TYPES.map((opt) => {
            const selected = userType === opt.value;
            return (
              <label
                key={opt.value}
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-3 transition-all duration-200",
                  selected
                    ? "border-primary bg-primary/[0.06] shadow-sm ring-2 ring-primary/20 dark:bg-primary/15"
                    : "border-gray-200 bg-white hover:border-primary/40 dark:border-emerald-800/60 dark:bg-[#132a1f] dark:hover:border-emerald-600/60",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="user_type"
                  value={opt.value}
                  checked={selected}
                  onChange={() => { setUserType(opt.value); setFieldErrors({}); }}
                  disabled={loading}
                  className="h-4 w-4 shrink-0 border-gray-300 text-primary focus:ring-primary dark:border-emerald-700 dark:bg-[#1a3528]"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{opt.label}</span>
              </label>
            );
          })}
        </div>
        {fieldErrors.userType && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{fieldErrors.userType}</p>
        )}
      </fieldset>

      <div>
        <label htmlFor="signup-phone" className={authLabelClass}>رقم الجوال</label>
        <input
          id="signup-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="numeric"
          dir="ltr"
          className={authInputClass}
          placeholder="0512345678"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          disabled={loading}
          maxLength={10}
          required
        />
        {fieldErrors.phone && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.phone}</p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">مثال: 0512345678 (يبدأ بـ 05)</p>
      </div>

      <div>
        <label htmlFor="signup-email" className={authLabelClass}>البريد الإلكتروني</label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          className={authInputClass}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="signup-password" className={authLabelClass}>كلمة المرور</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          className={authInputClass}
          placeholder="6 أحرف على الأقل"
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
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-base font-semibold text-white shadow-md transition hover:scale-[1.01] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            جاري إنشاء الحساب…
          </>
        ) : "إنشاء حساب"}
      </button>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        لديك حساب بالفعل؟{" "}
        <Link href="/login" className="font-semibold text-primary underline-offset-4 transition hover:text-accent hover:underline">
          تسجيل الدخول
        </Link>
      </p>
    </form>
  );
}
