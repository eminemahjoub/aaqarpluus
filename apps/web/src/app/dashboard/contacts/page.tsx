"use client";

import * as React from "react";
import { Phone, MoreHorizontal, User } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { authFetch } from "@/lib/auth-fetch";
import { ErrorState, PageLoading } from "@/components/ui/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  alternative_phone: string | null;
  type: "tenant" | "owner" | "service_provider" | "client" | "other" | "office";
  status: string;
};

function toDbContactType(ar: string): ContactRow["type"] {
  if (ar === "مالك") return "owner";
  if (ar === "مكتب") return "office";
  if (ar === "مورد خدمة") return "service_provider";
  if (ar === "عميل") return "client";
  return "tenant";
}

function toArabicType(db: ContactRow["type"]) {
  if (db === "owner") return "مالك";
  if (db === "office") return "مكتب";
  if (db === "service_provider") return "مورد خدمة";
  if (db === "client") return "عميل";
  return "مستأجر";
}

export function ContactsContent() {
  const [newContact, setNewContact] = React.useState({ name: "", phone: "", type: "مستأجر" });

  const refreshTick = useRealtimeRefresh();
  const qc = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: ["contacts", refreshTick],
    queryFn: async () => {
      const res = await authFetch("/api/contacts");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر تحميل جهات الاتصال");
      }
      const data = await res.json();
      return Array.isArray(data) ? (data as ContactRow[]) : [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContact.name.trim(),
          phone: newContact.phone.trim() || null,
          type: toDbContactType(newContact.type),
          status: "active",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "تعذّر الإضافة");
      }
      return res.json().catch(() => null);
    },
    onSuccess: async () => {
      setNewContact({ name: "", phone: "", type: "مستأجر" });
      await qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    await addMutation.mutateAsync();
  }

  if (contactsQuery.isLoading) return <PageLoading rows={6} />;
  if (contactsQuery.isError) return <ErrorState message={(contactsQuery.error as any)?.message ?? "تعذّر تحميل البيانات"} onRetry={() => contactsQuery.refetch()} />;

  const contacts = contactsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">جهات الاتصال</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Add Contact Form */}
        <div>
          <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <h2 className="mb-4 text-center text-lg font-semibold text-gray-900 dark:text-white">إضافة جهة اتصال جديدة</h2>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="mb-2 block text-right text-sm font-medium text-gray-700 dark:text-gray-300">النوع</label>
                <select
                  value={newContact.type}
                  onChange={(e) => setNewContact({ ...newContact, type: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-right text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                >
                  <option value="مستأجر">مستأجر</option>
                  <option value="مالك">مالك</option>
                  <option value="مكتب">مكتب</option>
                  <option value="مورد خدمة">مورد خدمة</option>
                  <option value="عميل">عميل</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-right text-sm font-medium text-gray-700 dark:text-gray-300">الاسم</label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="اسم جهة الاتصال"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-right text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-right text-sm font-medium text-gray-700 dark:text-gray-300">رقم الجوال</label>
                <div className="flex">
                  <span className="flex items-center rounded-r-lg border border-r-0 border-gray-300 bg-gray-100 px-3 text-sm text-gray-600 dark:border-emerald-800/50 dark:bg-[#244033] dark:text-gray-400">966+</span>
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="5xxxxxxxx"
                    className="w-full rounded-l-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                إنشاء
              </button>
            </form>
          </div>
        </div>

        {/* Contacts List */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-white shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
            <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-emerald-800/30">
              <h2 className="font-semibold text-gray-900 dark:text-white">قائمة جهات الاتصال</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-emerald-800/30">
              {contacts.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400">لا توجد جهات اتصال</div>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#1a3528]/50"
                  >
                    <div className="flex items-center gap-4">
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${toArabicType(contact.type) === "مستأجر" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : toArabicType(contact.type) === "مورد خدمة" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : toArabicType(contact.type) === "مكتب" ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"}`}>
                        {toArabicType(contact.type)}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{contact.name}</p>
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{contact.phone || "—"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                        <User className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  return <ContactsContent />;
}
