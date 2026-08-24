/**
 * Saudi regions/cities/neighborhoods seed data with coordinates.
 * Structured as an async "lookup" surface so a real GEO API can be swapped
 * in later without touching the form (GEO_API_BASE hook in lookupRegion).
 */

export type Region = { id: string; nameAr: string; nameEn: string };
export type City = { id: string; regionId: string; nameAr: string; nameEn: string; lat: number; lng: number };
export type Neighborhood = { id: string; cityId: string; nameAr: string };

export const REGIONS: Region[] = [
  { id: "riyadh", nameAr: "الرياض", nameEn: "Riyadh" },
  { id: "makkah", nameAr: "مكة المكرمة", nameEn: "Makkah" },
  { id: "madinah", nameAr: "المدينة المنورة", nameEn: "Madinah" },
  { id: "eastern", nameAr: "الشرقية", nameEn: "Eastern" },
  { id: "asir", nameAr: "عسير", nameEn: "Asir" },
  { id: "tabuk", nameAr: "تبوك", nameEn: "Tabuk" },
  { id: "qassim", nameAr: "القصيم", nameEn: "Qassim" },
  { id: "jazan", nameAr: "جازان", nameEn: "Jazan" },
  { id: "hail", nameAr: "حائل", nameEn: "Hail" },
  { id: "najran", nameAr: "نجران", nameEn: "Najran" },
  { id: "bahah", nameAr: "الباحة", nameEn: "Al-Bahah" },
  { id: "jouf", nameAr: "الجوف", nameEn: "Al-Jouf" },
  { id: "northern", nameAr: "الحدود الشمالية", nameEn: "Northern Borders" },
];

export const CITIES: City[] = [
  { id: "riyadh-city", regionId: "riyadh", nameAr: "الرياض", nameEn: "Riyadh", lat: 24.7136, lng: 46.6753 },
  { id: "jeddah", regionId: "makkah", nameAr: "جدة", nameEn: "Jeddah", lat: 21.4858, lng: 39.1925 },
  { id: "makkah-city", regionId: "makkah", nameAr: "مكة", nameEn: "Makkah", lat: 21.3891, lng: 39.8579 },
  { id: "taif", regionId: "makkah", nameAr: "الطائف", nameEn: "Taif", lat: 21.2703, lng: 40.4158 },
  { id: "madinah-city", regionId: "madinah", nameAr: "المدينة", nameEn: "Madinah", lat: 24.5247, lng: 39.5692 },
  { id: "dammam", regionId: "eastern", nameAr: "الدمام", nameEn: "Dammam", lat: 26.4207, lng: 50.0888 },
  { id: "khobar", regionId: "eastern", nameAr: "الخبر", nameEn: "Khobar", lat: 26.2172, lng: 50.1971 },
  { id: "abha", regionId: "asir", nameAr: "أبها", nameEn: "Abha", lat: 18.2164, lng: 42.5053 },
  { id: "tabuk-city", regionId: "tabuk", nameAr: "تبوك", nameEn: "Tabuk", lat: 28.3835, lng: 36.5662 },
  { id: "buraidah", regionId: "qassim", nameAr: "بريدة", nameEn: "Buraidah", lat: 26.3592, lng: 43.9818 },
];

export const NEIGHBORHOODS: Neighborhood[] = [
  { id: "malaz", cityId: "riyadh-city", nameAr: "الملز" },
  { id: "olaya", cityId: "riyadh-city", nameAr: "العليا" },
  { id: "nasriya", cityId: "riyadh-city", nameAr: "الناصرية" },
  { id: "sharafiya", cityId: "jeddah", nameAr: "الشرفية" },
  { id: "rawdah", cityId: "jeddah", nameAr: "الروضة" },
  { id: "aziziyah", cityId: "makkah-city", nameAr: "العزيزية" },
  { id: "qurban", cityId: "madinah-city", nameAr: "القربان" },
  { id: "shati", cityId: "dammam", nameAr: "الشاطئ" },
];

// Async lookup surface (swap with a real API behind GEO_API_BASE later).
function delay<T>(v: T, ms = 120): Promise<T> {
  return new Promise((res) => setTimeout(() => res(v), ms));
}

export async function lookupRegions(): Promise<Region[]> {
  return delay(REGIONS, 60);
}

export async function lookupCities(regionId: string): Promise<City[]> {
  return delay(CITIES.filter((c) => c.regionId === regionId));
}

export async function lookupNeighborhoods(cityId: string): Promise<Neighborhood[]> {
  return delay(NEIGHBORHOODS.filter((n) => n.cityId === cityId));
}

/** Reverse-geocode stub — returns the nearest seed city (real GEO API later). */
export async function reverseGeocode(lat: number, lng: number): Promise<City | null> {
  await delay(null, 200);
  let best: City | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}