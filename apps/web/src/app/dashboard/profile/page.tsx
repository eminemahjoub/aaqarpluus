"use client";

import * as React from "react";
import { User, Phone, Mail, Building2, Edit2, Check, X } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export function ProfileContent() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [userData, setUserData] = React.useState({
    fullName: "",
    email: "",
    phone: "",
    userType: "",
  });
  const [formData, setFormData] = React.useState(userData);

  React.useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const user = await res.json();
        const data = {
          fullName: user.fullName || "",
          email: user.email || "",
          phone: user.phone || "",
          userType: user.userType === "owner" ? "مالك" : user.userType === "agency" ? "مكتب" : "شخصي",
        };
        setUserData(data);
        setFormData(data);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: formData.fullName, phone: formData.phone }),
      });
      if (res.ok) {
        setUserData(formData);
        setEditMode(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">الملف الشخصي</h1>
        {!editMode ? (
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
          >
            <Edit2 className="h-4 w-4" />
            تعديل
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {saving ? "جاري الحفظ..." : "حفظ"}
            </button>
            <button
              onClick={() => { setFormData(userData); setEditMode(false); }}
              className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300 dark:bg-[#1a3528] dark:text-gray-300 dark:hover:bg-[#244033]"
            >
              <X className="h-4 w-4" />
              إلغاء
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <User className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{userData.fullName}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{userData.userType}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">المعلومات الشخصية</h3>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">الاسم الكامل</label>
              {editMode ? (
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-emerald-800/50 dark:bg-[#1a3528]">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900 dark:text-white">{userData.fullName}</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">رقم الجوال</label>
              {editMode ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                />
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-emerald-800/50 dark:bg-[#1a3528]">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900 dark:text-white" dir="ltr">{userData.phone || "—"}</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">البريد الإلكتروني</label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-emerald-800/50 dark:bg-[#1a3528]">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white" dir="ltr">{userData.email}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">معلومات الحساب</h3>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">نوع الحساب</label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-emerald-800/50 dark:bg-[#1a3528]">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{userData.userType}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <DashboardLayout role="owner">
      <ProfileContent />
    </DashboardLayout>
  );
}
