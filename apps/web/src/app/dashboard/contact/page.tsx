"use client";

import type { Metadata } from "next";
import { Phone, Mail, MessageCircle, Clock, MapPin } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

const metadata: Metadata = {
  title: "تواصل معنا",
  description: "تواصل مع فريق عقار بلس للدعم والاستفسارات",
};

function ContactContent() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a1f16]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-right text-3xl font-bold text-gray-900 dark:text-white">
          تواصل معنا
        </h1>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
              <h2 className="mb-6 text-right text-xl font-semibold text-gray-900 dark:text-white">
                الإشتراكات والدعم الفني
              </h2>

              <form className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                      الاسم
                    </label>
                    <input
                      type="text"
                      placeholder="اسم العميل"
                      className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-right text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white dark:placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                      رقم الجوال
                    </label>
                    <input
                      type="tel"
                      placeholder="05xxxxxxxx"
                      className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-right text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    placeholder="name@domain.com"
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-right text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                    نوع الرسالة
                  </label>
                  <select className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-right text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white">
                    <option value="">الرجاء الاختيار</option>
                    <option value="support">دعم فني</option>
                    <option value="subscription">استفسار عن الاشتراك</option>
                    <option value="feedback">اقتراح أو شكوى</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                    الرسالة
                  </label>
                  <textarea
                    rows={5}
                    placeholder="معلومات الرسالة..."
                    className="w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-right text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-emerald-800/50 dark:bg-[#1a3528] dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>

                <div className="flex justify-start">
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-8 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-600 dark:hover:bg-indigo-700"
                  >
                    إرسال
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <div className="rounded-xl bg-white p-6 shadow-sm dark:border dark:border-emerald-800/30 dark:bg-[#132a1f]">
              <h2 className="mb-6 text-right text-xl font-semibold text-gray-900 dark:text-white">
                قنوات التواصل
              </h2>

              <div className="space-y-4">
                <a
                  href="tel:0594362853"
                  className="flex items-center justify-end gap-3 text-gray-600 transition hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                >
                  <span className="text-sm">0594362853</span>
                  <Phone className="h-5 w-5 text-indigo-600" />
                </a>

                <a
                  href="https://wa.me/0594362853"
                  className="flex items-center justify-end gap-3 text-gray-600 transition hover:text-green-600 dark:text-gray-400 dark:hover:text-green-500"
                >
                  <span className="text-sm">0594362853</span>
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </a>

                <a
                  href="mailto:support@aaqarplus.sa"
                  className="flex items-center justify-end gap-3 text-gray-600 transition hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                >
                  <span className="text-sm">support@aaqarplus.sa</span>
                  <Mail className="h-5 w-5 text-indigo-600" />
                </a>

                <a
                  href="https://twitter.com/aaqarplus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-end gap-3 text-gray-600 transition hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                >
                  <span className="text-sm">@aaqarplus</span>
                  <svg className="h-5 w-5 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>

                <div className="flex items-center justify-end gap-3 text-gray-600 dark:text-gray-400">
                  <span className="text-sm">العمل: السبت - الخميس 9:00 - 17:00</span>
                  <Clock className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return <ContactContent />;
}
