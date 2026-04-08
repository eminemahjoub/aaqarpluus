"use client";

import * as React from "react";
import Link from "next/link";
import { authInputClass, authLabelClass } from "./auth-input-classes";

export function ForgotPasswordForm() {
  return (
    <div className="space-y-5 text-center">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        ميزة استعادة كلمة المرور غير متاحة حالياً. يرجى التواصل مع المسؤول.
      </p>
      <Link
        href="/login"
        className="inline-block rounded-lg bg-[#C5A021] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
      >
        العودة لتسجيل الدخول
      </Link>
    </div>
  );
}
