"use client";

import * as React from "react";
import { Phone, Plus, MoreHorizontal, User, PhoneCall } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";

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

function ContactsContent() {
  const [loading, setLoading] = React.useState(true);
  const [contacts, setContacts] = React.useState<ContactRow[]>([]);
  const [newContact, setNewContact] = React.useState({ name: "", phone: "", alternativePhone: "", type: "مستأجر" });

  const refreshTick = useRealtimeRefresh();

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/contacts");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setContacts(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshTick]);

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newContact.name.trim(),
        phone: newContact.phone.trim() || null,
        alternative_phone: newContact.alternativePhone.trim() || null,
        type: toDbContactType(newContact.type),
        status: "active",
      }),
    });
    if (!res.ok) return;

    const refresh = await fetch("/api/contacts");
    if (refresh.ok) setContacts(await refresh.json());
    setNewContact({ name: "", phone: "", alternativePhone: "", type: "مستأجر" });
  }

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

              <div>
                <label className="mb-2 block text-right text-sm font-medium text-gray-700 dark:text-gray-300">رقم الجوال البديل</label>
                <div className="flex">
                  <span className="flex items-center rounded-r-lg border border-r-0 border-gray-300 bg-gray-100 px-3 text-sm text-gray-600 dark:border-emerald-800/50 dark:bg-[#244033] dark:text-gray-400">966+</span>
                  <input
                    type="tel"
                    value={newContact.alternativePhone}
                    onChange={(e) => setNewContact({ ...newContact, alternativePhone: e.target.value })}
                    placeholder="5xxxxxxxx"
                    className="w-full rounded-l-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white"
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
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : contacts.length === 0 ? (
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
                          {contact.alternative_phone && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs">رقم بديل</span>
                              <PhoneCall className="h-3 w-3" />
                              <span dir="ltr">{contact.alternative_phone}</span>
                            </div>
                          )}
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
  return (
    <DashboardLayout role="owner">
      <ContactsContent />
    </DashboardLayout>
  );
}
