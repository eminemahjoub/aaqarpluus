"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type MaterialItem = {
  name: string;
  quantity: number;
  unit_price: number;
};

/**
 * Maintenance materials editor. Tracks rows of { name, quantity, unit_price }
 * with a running total in SAR. Values are stored as JSON on the task
 * (tasks.materials) and the total feeds tasks.materials_cost.
 */
export function MaterialsEditor({
  value,
  onChange,
  disabled,
}: {
  value: MaterialItem[];
  onChange: (items: MaterialItem[]) => void;
  disabled?: boolean;
}) {
  const items = Array.isArray(value) ? value : [];

  const total = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );

  function updateRow(index: number, patch: Partial<MaterialItem>) {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  }

  function removeRow(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...items, { name: "", quantity: 1, unit_price: 0 }]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500">لا توجد مواد مضافة</p>
        )}
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={item.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
              placeholder="اسم المادة"
              disabled={disabled}
              className="flex-1"
            />
            <Input
              type="number"
              min={0}
              value={Number(item.quantity) || 0}
              onChange={(e) => updateRow(index, { quantity: Number(e.target.value) || 0 })}
              placeholder="الكمية"
              disabled={disabled}
              className="w-20 text-center"
              dir="ltr"
            />
            <Input
              type="number"
              min={0}
              value={Number(item.unit_price) || 0}
              onChange={(e) => updateRow(index, { unit_price: Number(e.target.value) || 0 })}
              placeholder="السعر"
              disabled={disabled}
              className="w-24 text-center"
              dir="ltr"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              disabled={disabled}
              aria-label="حذف المادة"
              className="h-10 w-10 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={disabled}>
          <Plus className="h-4 w-4" />
          إضافة مادة
        </Button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          الإجمالي: <span dir="ltr">{total.toLocaleString("ar-SA")} ر.س</span>
        </span>
      </div>
    </div>
  );
}