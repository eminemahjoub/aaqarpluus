"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
        <h1 className="mb-4 text-3xl font-bold text-red-600">عقار بلس</h1>
        <h2 className="mb-4 text-xl font-semibold text-gray-800">حدث خطأ جسيم</h2>
        <p className="mb-6 max-w-md text-gray-600">
          نأسف، واجه التطبيق مشكلة غير متوقعة. يمكنك المحاولة مرة أخرى أو تحديث الصفحة.
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
          >
            إعادة المحاولة
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-gray-200 px-5 py-2.5 font-medium text-gray-800 hover:bg-gray-300"
          >
            تحديث الصفحة
          </button>
        </div>
        {process.env.NODE_ENV === "development" && (
          <pre className="mt-6 max-w-2xl overflow-auto rounded bg-gray-100 p-4 text-left text-sm text-red-800">
            {error.message}
            {error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
        )}
      </body>
    </html>
  );
}
