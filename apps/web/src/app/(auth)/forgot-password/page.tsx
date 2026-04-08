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
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
