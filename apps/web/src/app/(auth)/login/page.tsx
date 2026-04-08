import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
  description: "تسجيل الدخول إلى منصة عقار بلس",
};

export default function LoginPage() {
  return (
    <AuthLayout title="تسجيل الدخول" subtitle="أدخل بياناتك للمتابعة في منصة عقار بلس">
      <LoginForm />
    </AuthLayout>
  );
}
