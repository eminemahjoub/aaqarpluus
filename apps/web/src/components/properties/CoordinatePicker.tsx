"use client";

import { useState } from "react";
import { Crosshair, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Coordinate picker: OSM preview map + "use my location" + manual override.
 * (A full drag-to-pick map needs Leaflet/Google Maps — add via CDN later;
 * this preview is dependency-free and keeps coordinates editable.)
 */
export function CoordinatePicker({
  latitude,
  longitude,
  onLatitudeChange,
  onLongitudeChange,
  cityName,
}: {
  latitude: number | undefined;
  longitude: number | undefined;
  onLatitudeChange: (v: number | undefined) => void;
  onLongitudeChange: (v: number | undefined) => void;
  cityName?: string;
}) {
  const [locating, setLocating] = useState(false);

  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
  const bbox = hasCoords
    ? `${(longitude! - 0.02).toFixed(4)}%2C${(latitude! - 0.015).toFixed(4)}%2C${(longitude! + 0.02).toFixed(4)}%2C${(latitude! + 0.015).toFixed(4)}`
    : "46.6%2C24.6%2C46.8%2C24.8";

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLatitudeChange(Number(pos.coords.latitude.toFixed(6)));
        onLongitudeChange(Number(pos.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="mb-0 flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-gray-400" />
          الإحداثيات {cityName ? `— ${cityName}` : ""}
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
          <Crosshair className="h-4 w-4" />
          {locating ? "جاري التحديد..." : "استخدام موقعي"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <iframe
          title="خريطة الموقع"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude ?? 24.7136}%2C${longitude ?? 46.6753}`}
          className="h-40 w-full border-0"
          loading="lazy"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>خط العرض (تعديل يدوي)</Label>
          <Input
            type="number"
            step="any"
            dir="ltr"
            value={latitude ?? ""}
            onChange={(e) => onLatitudeChange(e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder="24.7136"
          />
        </div>
        <div>
          <Label>خط الطول (تعديل يدوي)</Label>
          <Input
            type="number"
            step="any"
            dir="ltr"
            value={longitude ?? ""}
            onChange={(e) => onLongitudeChange(e.target.value === "" ? undefined : Number(e.target.value))}
            placeholder="46.6753"
          />
        </div>
      </div>
    </div>
  );
}