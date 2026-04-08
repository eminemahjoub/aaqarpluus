import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "إنشاء حساب",
  description: "إنشاء حساب جديد على منصة عقار بلس",
};

export default function SignupPage() {
  return (
    <AuthLayout title="إنشاء حساب" subtitle="أنشئ حسابك وابدأ إدارة عقاراتك بذكاء">
      <SignupForm />
    </AuthLayout>
  );
}
