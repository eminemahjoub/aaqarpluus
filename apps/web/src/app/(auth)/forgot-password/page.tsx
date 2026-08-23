import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "استعادة كلمة المرور",
  description: "إعادة تعيين كلمة المرور — عقار بلس",
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="نسيت كلمة المرور؟" subtitle="أدخل بريدك لإرسال رابط الاستعادة">
      <Suspense fallback={<p className="text-center text-sm text-gray-500">جاري التحميل...</p>}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}