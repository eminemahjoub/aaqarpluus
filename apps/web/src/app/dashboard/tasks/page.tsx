"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hijriYmdFromGregorianYmd } from "@/lib/hijri";
import { occursOnCalendarDay } from "@/lib/recurring-tasks";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { authFetch } from "@/lib/auth-fetch";
import { useCanMutate } from "@/hooks/useCanMutate";
import {
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit3,
  Trash2,
  X,
  Upload,
  User,
  Building2,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// Types
interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  dateHijri?: string;
  propertyId?: string | null;
  unitId?: string | null;
  contactId?: string | null;
  propertyName?: string;
  unitLabel?: string;
  contactName?: string;
  contactType?: "tenant" | "owner" | "other";
  cost: number;
  status: "pending" | "completed" | "overdue";
  priority: "low" | "medium" | "high";
  addedBy: string;
  createdAt: string;
  allDay?: boolean;
  attachments?: string[];
  extra?: {
    recurrence?: "none" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
    attachments_before?: Array<{ id?: string; url: string; name: string }>;
    attachments_after?: Array<{ id?: string; url: string; name: string }>;
    linked_property_document_ids?: string[];
  };
}

// Tasks are loaded from Supabase.

// Calendar Component
function CalendarWidget({
  currentDate,
  selectedDate,
  onSelectDate,
  getTaskCountForDay,
}: {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  getTaskCountForDay?: (day: number) => number;
}) {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );
  const lastDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = firstDayOfMonth.getDay();

  const prevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onSelectDate(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onSelectDate(newDate);
  };

  const daysArray = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-emerald-800/30 dark:bg-[#1a3528]">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-emerald-800/30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-semibold text-gray-900 dark:text-white">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </span>
        <button
          onClick={nextMonth}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-emerald-800/30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((day) => (
          <div
            key={day}
            className="py-2 text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            {day}
          </div>
        ))}
        {daysArray.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="py-2" />;
          }
          const isSelected =
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === currentDate.getMonth() &&
            selectedDate.getFullYear() === currentDate.getFullYear();
          const isToday =
            new Date().getDate() === day &&
            new Date().getMonth() === currentDate.getMonth() &&
            new Date().getFullYear() === currentDate.getFullYear();
          const taskCount = typeof getTaskCountForDay === "function" ? getTaskCountForDay(day) : 0;
          return (
            <button
              key={day}
              type="button"
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setDate(day);
                onSelectDate(newDate);
              }}
              className={[
                "flex min-h-[2.75rem] flex-col items-center justify-center rounded-lg py-1 text-sm transition",
                isSelected
                  ? "bg-emerald-600 text-white"
                  : isToday
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-800/50 dark:text-emerald-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-emerald-800/30",
              ].join(" ")}
            >
              <span>{day}</span>
              {taskCount > 0 ? (
                <span
                  className={[
                    "mt-0.5 min-w-[1.15rem] rounded-full px-1 text-[10px] font-bold leading-4",
                    isSelected ? "bg-white/25 text-white" : "bg-emerald-600 text-white dark:bg-emerald-500",
                  ].join(" ")}
                >
                  {taskCount > 9 ? "9+" : taskCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Task Modal Component
function TaskModal({
  isOpen,
  onClose,
  task,
  onSave,
  properties,
  units,
  contacts,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (task: Partial<Task>) => void | Promise<void>;
  properties: Array<{ id: string; name: string }>;
  units: Array<{ id: string; property_id: string | null; label: string }>;
  contacts: Array<{ id: string; name: string; type: "tenant" | "owner" | "other" }>;
}) {
  const [formData, setFormData] = useState<Partial<Task>>({
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0].replace(/-/g, "/"),
    propertyId: null,
    unitId: null,
    contactId: null,
    cost: 0,
    status: "pending",
    priority: "medium",
    allDay: true,
  });

  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly">("none");
  const [linkedDocIds, setLinkedDocIds] = useState<string[]>([]);
  const [propertyDocs, setPropertyDocs] = useState<Array<{ id: string; file_name: string; public_url: string | null }>>([]);
  const [pendingBefore, setPendingBefore] = useState<File[]>([]);
  const [pendingAfter, setPendingAfter] = useState<File[]>([]);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (task) {
      setFormData({
        id: task.id,
        title: task.title,
        description: task.description,
        date: task.date,
        propertyId: task.propertyId ?? null,
        unitId: task.unitId ?? null,
        contactId: task.contactId ?? null,
        cost: task.cost,
        status: task.status,
        priority: task.priority,
        allDay: task.allDay ?? true,
        extra: task.extra,
      });
      {
        const r = task.extra?.recurrence;
        const allowed: Array<typeof recurrence> = ["none", "daily", "weekly", "monthly", "quarterly", "yearly"];
        setRecurrence(allowed.includes(r as (typeof recurrence)) ? (r as typeof recurrence) : "none");
      }
      setLinkedDocIds([...(task.extra?.linked_property_document_ids ?? [])]);
      setPendingBefore([]);
      setPendingAfter([]);
    } else {
      setFormData({
        title: "",
        description: "",
        date: new Date().toISOString().split("T")[0].replace(/-/g, "/"),
        propertyId: null,
        unitId: null,
        contactId: null,
        cost: 0,
        status: "pending",
        priority: "medium",
        allDay: true,
      });
      setRecurrence("none");
      setLinkedDocIds([]);
      setPendingBefore([]);
      setPendingAfter([]);
    }
  }, [task, isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const pid = formData.propertyId;
    if (!pid) {
      setPropertyDocs([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await authFetch(`/api/documents?property_id=${encodeURIComponent(pid)}`);
        const d = r.ok ? await r.json() : [];
        if (!cancelled) setPropertyDocs(Array.isArray(d) ? d : []);
      } catch {
        if (!cancelled) setPropertyDocs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, formData.propertyId]);

  const uploadTaskFiles = async (files: File[], propertyId: string | null | undefined) => {
    const out: Array<{ id: string; url: string; name: string }> = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      if (propertyId) fd.append("property_id", propertyId);
      const res = await authFetch("/api/documents", { method: "POST", body: fd });
      if (!res.ok) continue;
      const doc = await res.json();
      if (doc?.id && doc?.public_url) {
        out.push({ id: String(doc.id), url: String(doc.public_url), name: String(doc.file_name || file.name) });
      }
    }
    return out;
  };

  const handleModalSave = async () => {
    const uploadedBefore = await uploadTaskFiles(pendingBefore, formData.propertyId ?? undefined);
    const uploadedAfter = await uploadTaskFiles(pendingAfter, formData.propertyId ?? undefined);
    const prevBefore = task?.extra?.attachments_before ?? [];
    const prevAfter = task?.extra?.attachments_after ?? [];
    const extra: Task["extra"] = {
      recurrence,
      attachments_before: [...prevBefore, ...uploadedBefore],
      attachments_after: [...prevAfter, ...uploadedAfter],
      linked_property_document_ids: linkedDocIds.length ? linkedDocIds : undefined,
    };
    await onSave({ ...formData, extra });
    setPendingBefore([]);
    setPendingAfter([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1a3528]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {task ? "تعديل المهمة" : "إضافة مهمة"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-emerald-800/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              العنوان
            </label>
            <input
              type="text"
              value={formData.title || ""}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
              placeholder="عنوان المهمة"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              الوصف
            </label>
            <textarea
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
              placeholder="وصف المهمة..."
            />
          </div>

          {/* Date & All Day */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                تاريخ المهمة
              </label>
              <input
                type="date"
                value={(formData.date || "").replace(/\//g, "-")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    date: e.target.value.replace(/-/g, "/"),
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span>طوال اليوم</span>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      allDay: !formData.allDay,
                    })
                  }
                  className={[
                    "relative h-6 w-11 rounded-full transition-colors",
                    formData.allDay
                      ? "bg-emerald-600"
                      : "bg-gray-300 dark:bg-gray-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
                      formData.allDay ? "right-6" : "right-1",
                    ].join(" ")}
                  />
                </button>
              </label>
            </div>
          </div>

          {/* Property & Unit */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                العقار
              </label>
              <select
                value={formData.propertyId || ""}
                onChange={(e) => {
                  setLinkedDocIds([]);
                  setFormData({
                    ...formData,
                    propertyId: e.target.value ? e.target.value : null,
                    unitId: null,
                  });
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
              >
                <option value="">اختر</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                الوحدة
              </label>
              <select
                value={formData.unitId || ""}
                onChange={(e) => setFormData({ ...formData, unitId: e.target.value ? e.target.value : null })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
                disabled={!formData.propertyId}
              >
                <option value="">{formData.propertyId ? "اختر" : "اختر العقار أولاً"}</option>
                {units
                  .filter((u) => (formData.propertyId ? u.property_id === formData.propertyId : true))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Contact */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">جهة الاتصال</label>
            <select
              value={formData.contactId || ""}
              onChange={(e) => setFormData({ ...formData, contactId: e.target.value ? e.target.value : null })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
            >
              <option value="">اختر</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recurring (مهام ثابتة) */}
          <div className="rounded-lg border border-gray-200 p-4 dark:border-emerald-800/40 dark:bg-[#132a1f]/50">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">مهام ثابتة (تتكرر)</label>
            <select
              value={recurrence}
              onChange={(e) =>
                setRecurrence(e.target.value as "none" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly")
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
            >
              <option value="none">لا تكرار</option>
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
              <option value="monthly">شهري</option>
              <option value="quarterly">ربع سنوي</option>
              <option value="yearly">سنوي</option>
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              يُحفظ تكرار المهمة مع تاريخ الاستحقاق؛ يمكن لاحقاً ربطها بتنبيهات أو توليد نسخ تلقائية.
            </p>
          </div>

          {/* Priority & Cost */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                نوع المهمة
              </label>
              <select
                value={formData.priority || "medium"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as Task["priority"],
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
              >
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                التكلفة
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.cost || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-8 text-right text-sm focus:border-emerald-500 focus:outline-none dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
                  placeholder="0"
                />
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* مرفقات العمارة — existing property documents */}
          {formData.propertyId ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                مرفقات العمارة (مستندات مسجّلة للعقار)
              </label>
              {propertyDocs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-xs text-gray-500 dark:border-emerald-800/50 dark:text-gray-400">
                  لا توجد مستندات مرفوعة لهذا العقار بعد. يمكنك رفعها من صفحة المستندات.
                </p>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-emerald-800/40">
                  {propertyDocs.map((doc) => (
                    <label key={doc.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-emerald-600"
                        checked={linkedDocIds.includes(doc.id)}
                        onChange={(e) => {
                          if (e.target.checked) setLinkedDocIds((prev) => [...prev, doc.id]);
                          else setLinkedDocIds((prev) => prev.filter((x) => x !== doc.id));
                        }}
                      />
                      <span className="truncate">{doc.file_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Before / After attachments */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">مرفقات قبل</label>
              <input
                ref={beforeInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  setPendingBefore((p) => [...p, ...Array.from(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => beforeInputRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-600 transition hover:border-emerald-500 hover:bg-emerald-50/50 dark:border-emerald-800/50 dark:text-gray-300 dark:hover:bg-emerald-900/20"
              >
                <Upload className="mx-auto h-6 w-6 text-gray-400" />
                <span className="mt-1 block">إضافة ملفات (قبل)</span>
              </button>
              {pendingBefore.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  {pendingBefore.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.name}</span>
                      <button type="button" className="text-red-600 hover:underline" onClick={() => setPendingBefore((p) => p.filter((_, j) => j !== i))}>
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {(task?.extra?.attachments_before?.length ?? 0) > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {task!.extra!.attachments_before!.map((a, i) => (
                    <li key={`saved-b-${i}`}>
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-emerald-700 underline dark:text-emerald-400">
                        {a.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">مرفقات بعد</label>
              <input
                ref={afterInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  setPendingAfter((p) => [...p, ...Array.from(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => afterInputRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-600 transition hover:border-emerald-500 hover:bg-emerald-50/50 dark:border-emerald-800/50 dark:text-gray-300 dark:hover:bg-emerald-900/20"
              >
                <Upload className="mx-auto h-6 w-6 text-gray-400" />
                <span className="mt-1 block">إضافة ملفات (بعد)</span>
              </button>
              {pendingAfter.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  {pendingAfter.map((f, i) => (
                    <li key={`${f.name}-a-${i}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">{f.name}</span>
                      <button type="button" className="text-red-600 hover:underline" onClick={() => setPendingAfter((p) => p.filter((_, j) => j !== i))}>
                        حذف
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {(task?.extra?.attachments_after?.length ?? 0) > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {task!.extra!.attachments_after!.map((a, i) => (
                    <li key={`saved-a-${i}`}>
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-emerald-700 underline dark:text-emerald-400">
                        {a.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => void handleModalSave()}
            className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            {task ? "تحديث" : "إضافة"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-gray-300 dark:hover:bg-emerald-800/30"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1a3528]">
        <div className="mb-4 flex items-center gap-3 text-red-600">
          <AlertCircle className="h-6 w-6" />
          <h3 className="text-lg font-semibold">تأكيد الحذف</h3>
        </div>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            حذف
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-gray-300"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Tasks Page
export default function TasksPage() {
  const router = useRouter();
  const { canMutate } = useCanMutate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; property_id: string | null; label: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; type: "tenant" | "owner" | "other" }>>([]);
  const refreshTick = useRealtimeRefresh();
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [tasksRes, propsRes, unitsRes, contactsRes] = await Promise.all([
          authFetch("/api/tasks"),
          authFetch("/api/properties"),
          authFetch("/api/units"),
          authFetch("/api/contacts"),
        ]);
        if (cancelled) return;

        const [data, props, unitsData, contactsData] = await Promise.all([
          tasksRes.ok ? tasksRes.json() : [],
          propsRes.ok ? propsRes.json() : [],
          unitsRes.ok ? unitsRes.json() : [],
          contactsRes.ok ? contactsRes.json() : [],
        ]);
        if (cancelled) return;

        setProperties((props ?? []).map((p: any) => ({ id: String(p.id), name: String(p.name ?? "—") })));
        setUnits((unitsData ?? []).map((u: any) => ({ id: String(u.id), property_id: u.property_id ? String(u.property_id) : null, label: String(u.label ?? "—") })));
        setContacts((contactsData ?? []).map((c: any) => ({ id: String(c.id), name: String(c.name ?? "—"), type: c.type === "tenant" ? "tenant" : c.type === "owner" ? "owner" : "other" })));
        setTasks(
          (data ?? []).map((t: any) => ({
            id: String(t.id),
            title: String(t.title ?? ""),
            description: String(t.description ?? ""),
            date: t.due_date ? String(t.due_date).slice(0, 10).replace(/-/g, "/") : "",
            dateHijri: t.due_date_hijri ? String(t.due_date_hijri) : t.due_date ? hijriYmdFromGregorianYmd(String(t.due_date).slice(0, 10)) : "",
            propertyId: t.property_id ? String(t.property_id) : null,
            unitId: t.unit_id ? String(t.unit_id) : null,
            contactId: t.contact_id ? String(t.contact_id) : null,
            propertyName: t?.property?.name ? String(t.property.name) : "—",
            unitLabel: t?.unit?.label ? String(t.unit.label) : "—",
            contactName: t?.contact?.name ? String(t.contact.name) : "—",
            contactType: t?.contact?.type === "tenant" ? "tenant" : t?.contact?.type === "owner" ? "owner" : "other",
            cost: Number(t.cost_sar) || 0,
            status: t.status === "completed" ? "completed" : t.status === "overdue" ? "overdue" : "pending",
            priority: t.priority === "high" ? "high" : t.priority === "low" ? "low" : "medium",
            addedBy: "—",
            createdAt: t.created_at ? String(t.created_at) : "",
            allDay: true,
            extra: t.extra && typeof t.extra === "object" ? (t.extra as Task["extra"]) : undefined,
          }))
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshTick]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeFilter, setActiveFilter] = useState<
    "all" | "today" | "tomorrow" | "created"
  >("created");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const getTaskCountForDay = useCallback(
    (day: number) => {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      return tasks.reduce((n, t) => n + (occursOnCalendarDay(t, d) ? 1 : 0), 0);
    },
    [tasks, currentDate],
  );

  // Filter tasks (recurring مهام ثابتة match today/tomorrow on every occurrence)
  const filteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return tasks.filter((task) => {
      switch (activeFilter) {
        case "today":
          return occursOnCalendarDay(task, today);
        case "tomorrow":
          return occursOnCalendarDay(task, tomorrow);
        case "created":
          return task.status !== "completed";
        case "all":
        default:
          return true;
      }
    });
  }, [tasks, activeFilter]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      all: tasks.length,
      today: tasks.filter((t) => occursOnCalendarDay(t, today)).length,
      tomorrow: tasks.filter((t) => occursOnCalendarDay(t, tomorrow)).length,
      created: tasks.filter((t) => t.status !== "completed").length,
    };
  }, [tasks]);

  const toDueYmd = (dateStr: string | undefined | null) => {
    if (!dateStr) return null;
    const s = String(dateStr).replace(/\//g, "-").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
    void (async () => {
      const due = toDueYmd(taskData.date);
      const hijri = due ? hijriYmdFromGregorianYmd(due) : null;
      const extraPayload = taskData.extra && typeof taskData.extra === "object" ? taskData.extra : null;

      if (editingTask) {
        const res = await authFetch(`/api/tasks/${editingTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskData.title,
            description: taskData.description ?? null,
            due_date: due,
            due_date_hijri: hijri,
            status: taskData.status ?? "pending",
            priority: taskData.priority ?? "medium",
            cost_sar: taskData.cost ?? 0,
            property_id: taskData.propertyId ?? null,
            unit_id: taskData.unitId ?? null,
            contact_id: taskData.contactId ?? null,
            extra: extraPayload,
          }),
        });
        if (res.ok) {
          const nextHijri = hijri ?? "";
          const displayDate = due ? due.replace(/-/g, "/") : "";
          setTasks(
            tasks.map((t) =>
              t.id === editingTask.id
                ? { ...t, ...taskData, date: displayDate, dateHijri: nextHijri, extra: extraPayload ?? undefined }
                : t,
            ),
          );
        }
      } else {
        const res = await authFetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskData.title ?? "مهمة جديدة",
            description: taskData.description ?? null,
            due_date: due,
            due_date_hijri: hijri,
            status: "pending",
            priority: taskData.priority ?? "medium",
            cost_sar: taskData.cost ?? 0,
            property_id: taskData.propertyId ?? null,
            unit_id: taskData.unitId ?? null,
            contact_id: taskData.contactId ?? null,
            extra: extraPayload,
          }),
        });
        if (res.ok) {
          const inserted = await res.json();
          const idue = inserted.due_date ? String(inserted.due_date).slice(0, 10) : "";
          const newTask: Task = {
            id: String(inserted.id),
            title: String(inserted.title ?? ""),
            description: String(inserted.description ?? ""),
            date: idue ? idue.replace(/-/g, "/") : "",
            dateHijri: inserted.due_date_hijri ? String(inserted.due_date_hijri) : idue ? hijriYmdFromGregorianYmd(idue) : "",
            propertyId: inserted.property_id ? String(inserted.property_id) : null,
            unitId: inserted.unit_id ? String(inserted.unit_id) : null,
            contactId: inserted.contact_id ? String(inserted.contact_id) : null,
            propertyName: "—",
            unitLabel: "—",
            contactName: "—",
            contactType: "other",
            cost: Number(inserted.cost_sar) || 0,
            status: inserted.status === "completed" ? "completed" : inserted.status === "overdue" ? "overdue" : "pending",
            priority: inserted.priority === "high" ? "high" : inserted.priority === "low" ? "low" : "medium",
            addedBy: "—",
            createdAt: inserted.created_at ? String(inserted.created_at) : "",
            allDay: true,
            extra: inserted.extra && typeof inserted.extra === "object" ? (inserted.extra as Task["extra"]) : extraPayload ?? undefined,
          };
          setTasks([newTask, ...tasks]);
        }
      }
      setShowAddModal(false);
      setEditingTask(null);
    })();
  };

  const handleDeleteTask = () => {
    if (deletingTask) {
      void (async () => {
        const res = await fetch(`/api/tasks/${deletingTask.id}`, { method: "DELETE" });
        if (res.ok) {
          setTasks(tasks.filter((t) => t.id !== deletingTask.id));
        }
        setDeletingTask(null);
      })();
    }
  };

  const getStatusBadge = (status: Task["status"]) => {
    const styles = {
      pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      completed:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    const labels = {
      pending: "مستحق",
      completed: "مكتمل",
      overdue: "متأخر",
    };
    return (
      <span
        className={[
          "rounded-full px-2.5 py-0.5 text-xs font-medium",
          styles[status],
        ].join(" ")}
      >
        {labels[status]}
      </span>
    );
  };

  const getPriorityBadge = (priority: Task["priority"]) => {
    const styles = {
      low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
      medium:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    const labels = {
      low: "منخفضة",
      medium: "متوسطة",
      high: "عالية",
    };
    return (
      <span
        className={[
          "rounded-full px-2.5 py-0.5 text-xs font-medium",
          styles[priority],
        ].join(" ")}
      >
        {labels[priority]}
      </span>
    );
  };

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          {canMutate ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-xl bg-[#2D4F6E] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a52] dark:bg-[#2D4F6E] dark:hover:bg-[#1e3a52]"
            >
              <Plus className="h-4 w-4" />
              إضافة مهمة
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              المهام
              <span className="mr-2 rounded-lg bg-emerald-100 px-2 py-1 text-lg text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {stats.created}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Calendar */}
          <div className="lg:col-span-1">
            <CalendarWidget
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setCurrentDate(d);
                setSelectedDate(d);
              }}
              getTaskCountForDay={getTaskCountForDay}
            />
          </div>

          {/* Task List */}
          <div className="lg:col-span-3">
            {/* Filters */}
            <div className="mb-4 space-y-3">
              <button
                onClick={() => setActiveFilter("created")}
                className={[
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3 transition",
                  activeFilter === "created"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:hover:bg-emerald-800/20",
                ].join(" ")}
              >
                <ChevronLeft
                  className={[
                    "h-5 w-5 transition",
                    activeFilter === "created"
                      ? "text-emerald-600"
                      : "text-gray-400",
                  ].join(" ")}
                />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    المهام المنشأة
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    ({stats.created})
                  </span>
                </div>
              </button>

              {activeFilter === "created" && (
                <div className="space-y-2 pr-4">
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center dark:border-emerald-800/30 dark:bg-[#132a1f]/50">
                      <CheckCircle2 className="mx-auto h-12 w-12 text-gray-300 dark:text-emerald-700" />
                      <p className="mt-3 text-gray-500 dark:text-gray-400">
                        لا توجد مهام منشأة
                      </p>
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 dark:border-emerald-800/30 dark:bg-[#1a3528]"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-emerald-800/30"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            <div className="flex gap-2">
                              {getStatusBadge(task.status)}
                              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                {task.contactName ?? "—"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {expandedTask === task.id && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingTask(task);
                                    setShowAddModal(true);
                                  }}
                                  className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDeletingTask(task)}
                                  className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {task.title}
                            </span>
                          </div>
                        </div>

                        {/* Task Details */}
                        <div className="mt-3 grid grid-cols-5 gap-4 border-t border-gray-100 pt-3 dark:border-emerald-800/20">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              التاريخ
                            </p>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {task.date}
                            </p>
                          {task.dateHijri ? (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {task.dateHijri} هـ
                            </p>
                          ) : null}
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              التكلفة
                            </p>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {task.cost > 0
                                ? `${task.cost.toLocaleString()} ر.س`
                                : "-"}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              أضيف بواسطة
                            </p>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {task.addedBy}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              المستخدم
                            </p>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {"—"}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              جهة الاتصال
                            </p>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {task.contactName ?? "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              <button
                onClick={() => setActiveFilter("today")}
                className={[
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3 transition",
                  activeFilter === "today"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:hover:bg-emerald-800/20",
                ].join(" ")}
              >
                <ChevronLeft
                  className={[
                    "h-5 w-5 transition",
                    activeFilter === "today"
                      ? "text-emerald-600"
                      : "text-gray-400",
                  ].join(" ")}
                />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    مهام اليوم
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    ({stats.today})
                  </span>
                </div>
              </button>

              <button
                onClick={() => setActiveFilter("tomorrow")}
                className={[
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3 transition",
                  activeFilter === "tomorrow"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:hover:bg-emerald-800/20",
                ].join(" ")}
              >
                <ChevronLeft
                  className={[
                    "h-5 w-5 transition",
                    activeFilter === "tomorrow"
                      ? "text-emerald-600"
                      : "text-gray-400",
                  ].join(" ")}
                />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    الغد
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    ({stats.tomorrow})
                  </span>
                </div>
              </button>

              <button
                onClick={() => setActiveFilter("all")}
                className={[
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3 transition",
                  activeFilter === "all"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:hover:bg-emerald-800/20",
                ].join(" ")}
              >
                <ChevronLeft
                  className={[
                    "h-5 w-5 transition",
                    activeFilter === "all"
                      ? "text-emerald-600"
                      : "text-gray-400",
                  ].join(" ")}
                />
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    الكل
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    ({stats.all})
                  </span>
                </div>
              </button>
            </div>

            {/* All Tasks View */}
            {activeFilter !== "created" && (
              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-12 text-center dark:border-emerald-800/30 dark:bg-[#132a1f]/50">
                    <CheckCircle2 className="mx-auto h-16 w-16 text-gray-300 dark:text-emerald-700" />
                    <p className="mt-4 text-gray-500 dark:text-gray-400">
                      لا توجد مهام
                    </p>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 dark:border-emerald-800/30 dark:bg-[#1a3528]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setExpandedTask(
                                expandedTask === task.id ? null : task.id
                              )
                            }
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-emerald-800/30"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          <div className="flex gap-2">
                            {getStatusBadge(task.status)}
                            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                              {task.contactName ?? "—"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {expandedTask === task.id && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingTask(task);
                                  setShowAddModal(true);
                                }}
                                className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeletingTask(task)}
                                className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <span className="font-medium text-gray-900 dark:text-white">
                            {task.title}
                          </span>
                        </div>
                      </div>

                      {/* Task Details */}
                      <div className="mt-3 grid grid-cols-5 gap-4 border-t border-gray-100 pt-3 dark:border-emerald-800/20">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            التاريخ
                          </p>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {task.date}
                          </p>
                        {task.dateHijri ? (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {task.dateHijri} هـ
                          </p>
                        ) : null}
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            التكلفة
                          </p>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {task.cost > 0
                              ? `${task.cost.toLocaleString()} ر.س`
                              : "-"}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            أضيف بواسطة
                          </p>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {task.addedBy}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            المستخدم
                          </p>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {"—"}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            جهة الاتصال
                          </p>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {task.contactName ?? "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

      {/* Modals */}
      <TaskModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingTask(null);
        }}
        task={editingTask}
        onSave={handleSaveTask}
        properties={properties}
        units={units}
        contacts={contacts}
      />

      <DeleteModal
        isOpen={!!deletingTask}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleDeleteTask}
      />
      </div>
  );
}
