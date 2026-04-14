"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Search,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Trash2,
  MoreVertical,
  Eye,
  FolderOpen,
  ChevronDown,
  FileSpreadsheet,
  FileCode,
  Plus,
} from "lucide-react";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { authFetch } from "@/lib/auth-fetch";

// Types
interface Document {
  id: string;
  name: string;
  fileName: string;
  fileId: string;
  type: "image" | "pdf" | "excel" | "doc" | "other";
  size: string;
  url: string;
  thumbnailUrl?: string;
  propertyName: string;
  unitName?: string;
  uploadedAt: string;
  uploadedBy: string;
  category?: string;
}

const categories = [
  { id: "all", name: "جميع الفئات" },
  { id: "photos", name: "صور" },
  { id: "contracts", name: "عقود" },
  { id: "bills", name: "فواتير" },
  { id: "reports", name: "تقارير" },
  { id: "other", name: "أخرى" },
];

// File Icon Component
function FileIconComponent({ type, className }: { type: Document["type"]; className?: string }) {
  const icons = {
    image: ImageIcon,
    pdf: FileText,
    excel: FileSpreadsheet,
    doc: FileText,
    other: File,
  };
  const colors = {
    image: "text-purple-600 dark:text-purple-400",
    pdf: "text-red-600 dark:text-red-400",
    excel: "text-green-600 dark:text-green-400",
    doc: "text-blue-600 dark:text-blue-400",
    other: "text-gray-600 dark:text-gray-400",
  };
  const Icon = icons[type] || File;
  return <Icon className={`${colors[type]} ${className}`} />;
}

// Document Viewer Modal
function DocumentViewerModal({
  document,
  isOpen,
  onClose,
}: {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative max-h-[90vh] w-full max-w-4xl rounded-2xl bg-white p-4 dark:bg-[#1a3528]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {document.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {document.fileName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-emerald-800/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-xl bg-gray-100 dark:bg-[#132a1f]">
          {document.type === "image" ? (
            <img
              src={document.url}
              alt={document.name}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 p-12">
              <FileIconComponent type={document.type} className="h-24 w-24" />
              <p className="text-gray-600 dark:text-gray-300">
                المعاينة غير متاحة لهذا النوع من الملفات
              </p>
              <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                تحميل الملف
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex gap-4">
            <span>الحجم: {document.size}</span>
            <span>تاريخ الرفع: {document.uploadedAt}</span>
            <span>بواسطة: {document.uploadedBy}</span>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 dark:border-emerald-800/50 dark:hover:bg-emerald-800/30">
              <Download className="h-4 w-4" />
              تحميل
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Upload Modal
function UploadModal({
  isOpen,
  onClose,
  onUpload,
  properties,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: FileList, propertyId: string | null) => void;
  properties: Array<{ id: string; name: string }>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      selectedFiles.forEach((file) => dataTransfer.items.add(file));
      const propId = selectedProperty && selectedProperty !== "all" ? selectedProperty : null;
      onUpload(dataTransfer.files, propId);
      setSelectedFiles([]);
      setSelectedProperty("");
      setSelectedCategory("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1a3528]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            رفع المستندات
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-emerald-800/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Property & Category Selection */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              العقار
            </label>
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-right text-sm dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
            >
              <option value="">اختر العقار</option>
              {properties.filter(p => p.id !== "all").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              الفئة
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-white"
            >
              <option value="">اختر الفئة</option>
              {categories.filter(c => c.id !== "all").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition",
            isDragging
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
              : "border-gray-300 hover:border-emerald-400 dark:border-emerald-800/50 dark:hover:border-emerald-600",
          ].join(" ")}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-emerald-600" />
          <p className="mt-3 font-medium text-gray-700 dark:text-gray-300">
            إسحب الملفات هنا أو انقر للاختيار
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            يدعم الصور، PDF، Word، Excel
          </p>
        </div>

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              الملفات المحددة ({selectedFiles.length})
            </p>
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-emerald-800/30 dark:bg-[#132a1f]"
              >
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  onClick={() =>
                    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
                  }
                  className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0}
            className={[
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium",
              selectedFiles.length === 0
                ? "cursor-not-allowed bg-gray-300 text-gray-500"
                : "bg-emerald-700 text-white hover:bg-emerald-800",
            ].join(" ")}
          >
            رفع ({selectedFiles.length})
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
function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  documentName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  documentName: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#1a3528]">
        <div className="mb-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            حذف المستند
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            هل أنت متأكد من حذف "{documentName}"؟ لا يمكن التراجع عن هذا
            الإجراء.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
          >
            حذف
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-emerald-800/50 dark:bg-[#132a1f] dark:text-gray-300"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Documents Page
export function DocumentsContent() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([{ id: "all", name: "جميع العقارات" }]);
  const refreshTick = useRealtimeRefresh();
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [docsRes, propsRes] = await Promise.all([
          authFetch("/api/documents"),
          authFetch("/api/properties"),
        ]);
        if (cancelled) return;
        const [docs, props] = await Promise.all([
          docsRes.ok ? docsRes.json() : [],
          propsRes.ok ? propsRes.json() : [],
        ]);
        if (cancelled) return;

        const propMap = new Map((props ?? []).map((p: any) => [String(p.id), String(p.name)]));
        setProperties([{ id: "all", name: "جميع العقارات" }, ...(props ?? []).map((p: any) => ({ id: String(p.id), name: String(p.name) }))]);

        setDocuments(
          (docs ?? []).map((d: any) => {
            const mime = String(d.mime_type ?? "");
            const type: Document["type"] =
              mime.startsWith("image/") ? "image"
              : mime === "application/pdf" ? "pdf"
              : mime.includes("sheet") ? "excel"
              : mime.includes("word") || mime.includes("document") ? "doc"
              : "other";
            const sizeBytes = Number(d.size_bytes) || 0;
            const sizeLabel = sizeBytes > 0 ? `${(sizeBytes / 1024 / 1024).toFixed(2)} MB` : "—";
            return {
              id: String(d.id),
              name: String(d.file_name ?? "مستند"),
              fileName: String(d.file_name ?? ""),
              fileId: String(d.id),
              type,
              size: sizeLabel,
              url: String(d.public_url ?? ""),
              propertyName: d.property_id ? (propMap.get(String(d.property_id)) ?? "—") : "—",
              uploadedAt: d.created_at ? String(d.created_at).split("T")[0] : "",
              uploadedBy: "—",
            } as Document;
          }),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshTick]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProperty =
      selectedProperty === "all" ||
      doc.propertyName === properties.find((p) => p.id === selectedProperty)?.name;
    const matchesCategory =
      selectedCategory === "all" || doc.category === categories.find((c) => c.id === selectedCategory)?.name;
    return matchesSearch && matchesProperty && matchesCategory;
  });

  const handleUpload = (files: FileList, propertyId: string | null) => {
    void (async () => {
      const uploaded: Document[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        if (propertyId) formData.append("property_id", propertyId);

        const res = await authFetch("/api/documents", { method: "POST", body: formData });
        if (!res.ok) continue;
        const inserted = await res.json();

        const mime = file.type;
        const ext = (file.name.split(".").pop() ?? "").toLowerCase();
        const type: Document["type"] =
          mime.startsWith("image/") ? "image"
          : ext === "pdf" || mime === "application/pdf" ? "pdf"
          : mime.includes("sheet") || ext === "xlsx" || ext === "xls" ? "excel"
          : mime.includes("word") || mime.includes("document") || ext === "doc" || ext === "docx" ? "doc"
          : "other";

        uploaded.push({
          id: String(inserted.id),
          name: file.name,
          fileName: file.name,
          fileId: String(inserted.id),
          type,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          url: String(inserted.public_url ?? ""),
          thumbnailUrl: type === "image" ? String(inserted.public_url ?? "") : undefined,
          propertyName: propertyId ? (properties.find((p) => p.id === propertyId)?.name ?? "—") : "—",
          uploadedAt: inserted.created_at ? String(inserted.created_at).split("T")[0] : "",
          uploadedBy: "—",
        });
      }
      if (uploaded.length > 0) {
        setDocuments((prev) => [...uploaded, ...prev]);
      }
    })();
  };

  const handleDelete = () => {
    if (deletingDocument) {
      void (async () => {
        const res = await fetch(`/api/documents/${deletingDocument.id}`, { method: "DELETE" });
        if (res.ok) {
          setDocuments((prev) => prev.filter((d) => d.id !== deletingDocument.id));
        }
        setDeletingDocument(null);
      })();
    }
  };

  const handleDownload = (doc: Document) => {
    if (!doc.url) return;
    const link = document.createElement("a");
    link.href = doc.url;
    link.download = doc.fileName;
    link.target = "_blank";
    link.click();
  };

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#2D4F6E] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a52] dark:bg-[#2D4F6E] dark:hover:bg-[#1e3a52]"
          >
            <Plus className="h-4 w-4" />
            رفع مستند
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              المستندات
            </h1>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-[#1a3528]">
              <FolderOpen className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث في المستندات..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-10 text-right text-sm outline-none focus:border-emerald-500 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
            />
          </div>

          {/* Property Filter */}
          <div className="relative min-w-[180px]">
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-right text-sm outline-none focus:border-emerald-500 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          {/* Category Filter */}
          <div className="relative min-w-[160px]">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-right text-sm outline-none focus:border-emerald-500 dark:border-emerald-800/30 dark:bg-[#1a3528] dark:text-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {/* Upload Area (Quick Access) */}
        <div
          onClick={() => setShowUploadModal(true)}
          className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-6 text-center transition hover:border-emerald-400 hover:bg-gray-100/50 dark:border-emerald-800/30 dark:bg-[#132a1f]/50 dark:hover:border-emerald-600 dark:hover:bg-[#132a1f]"
        >
          <Upload className="mx-auto h-8 w-8 text-gray-400 dark:text-emerald-600" />
          <p className="mt-2 font-medium text-gray-600 dark:text-gray-300">
            إرفع الملفات
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            اسحب الملفات هنا أو انقر للاختيار
          </p>
        </div>

        {/* Documents Grid */}
        {filteredDocuments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-12 text-center dark:border-emerald-800/30 dark:bg-[#132a1f]/50">
            <FolderOpen className="mx-auto h-16 w-16 text-gray-300 dark:text-emerald-700" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              لا توجد مستندات
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              رفع مستند جديد
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-lg dark:border-emerald-800/30 dark:bg-[#1a3528]"
              >
                {/* Preview */}
                <div
                  onClick={() => setViewingDocument(doc)}
                  className="relative aspect-video cursor-pointer overflow-hidden bg-gray-100 dark:bg-[#132a1f]"
                >
                  {doc.thumbnailUrl || doc.type === "image" ? (
                    <img
                      src={doc.thumbnailUrl || doc.url}
                      alt={doc.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <FileIconComponent type={doc.type} className="h-16 w-16" />
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                    <Eye className="h-8 w-8 text-white opacity-0 transition group-hover:opacity-100" />
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 text-right">
                      <h3 className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {doc.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {doc.fileName}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {doc.fileId}
                      </p>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {doc.uploadedAt}
                      </p>
                    </div>
                    {/* Actions Menu */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setMenuOpenId(menuOpenId === doc.id ? null : doc.id)
                        }
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-emerald-800/30"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuOpenId === doc.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpenId(null)}
                          />
                          <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-emerald-800/30 dark:bg-[#1a3528]">
                            <button
                              onClick={() => {
                                setViewingDocument(doc);
                                setMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-emerald-800/30"
                            >
                              <Eye className="h-4 w-4" />
                              معاينة
                            </button>
                            <button
                              onClick={() => {
                                handleDownload(doc);
                                setMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-emerald-800/30"
                            >
                              <Download className="h-4 w-4" />
                              تحميل
                            </button>
                            <button
                              onClick={() => {
                                setDeletingDocument(doc);
                                setMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                              حذف
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Property Tag */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {doc.size}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {doc.propertyName}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {filteredDocuments.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-sm text-gray-500 dark:border-emerald-800/30 dark:text-gray-400">
            <p>
              إجمالي المستندات: {filteredDocuments.length} من {documents.length}
            </p>
            <p>
              {selectedProperty !== "all" &&
                `العقار: ${properties.find((p) => p.id === selectedProperty)?.name}`}
            </p>
          </div>
        )}
      {/* Modals */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        properties={properties}
      />

      <DocumentViewerModal
        document={viewingDocument}
        isOpen={!!viewingDocument}
        onClose={() => setViewingDocument(null)}
      />

      <DeleteConfirmationModal
        isOpen={!!deletingDocument}
        onClose={() => setDeletingDocument(null)}
        onConfirm={handleDelete}
        documentName={deletingDocument?.name || ""}
      />
      </div>
  );
}

export default function DocumentsPage() {
  return (
    <DashboardLayout role="owner">
      <DocumentsContent />
    </DashboardLayout>
  );
}
