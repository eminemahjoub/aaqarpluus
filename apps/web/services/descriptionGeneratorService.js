/* eslint-disable no-undef */
/**
 * Property description generator using Cloudflare Workers AI.
 * - Returns a short description (<= ~120 words).
 * - Never invents missing details; only uses provided inputs.
 */

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}

function uniq(arr) {
  return Array.from(new Set((arr || []).map((x) => safeStr(x).trim()).filter(Boolean)));
}

function fallbackTemplate(input) {
  const type = safeStr(input.type || "property");
  const city = safeStr(input.city || "");
  const rooms = Number.isFinite(input.rooms) ? Number(input.rooms) : null;
  const surface = Number.isFinite(input.surface) ? Number(input.surface) : null;
  const features = uniq(input.features);
  const lang = safeStr(input.language || "en").toLowerCase();

  if (lang === "ar") {
    const parts = [
      `وصف ${type}${city ? ` في ${city}` : ""}.`,
      rooms ? `${rooms} غرف.` : "",
      surface ? `${surface} م².` : "",
      features.length ? `مزايا: ${features.join("، ")}.` : "",
      "تواصل معنا لمزيد من التفاصيل.",
    ].filter(Boolean);
    return parts.join(" ");
  }

  const parts = [
    `Professional ${type}${city ? ` in ${city}` : ""}.`,
    rooms ? `${rooms} rooms.` : "",
    surface ? `${surface} sqm.` : "",
    features.length ? `Features: ${features.join(", ")}.` : "",
    "Contact us for more details.",
  ].filter(Boolean);
  return parts.join(" ");
}

function buildPrompt(input) {
  const type = safeStr(input.type);
  const city = safeStr(input.city);
  const rooms = Number(input.rooms);
  const surface = Number(input.surface);
  const features = uniq(input.features).join(", ");
  const language = safeStr(input.language || "en").toLowerCase();

  return [
    "Return JSON only:",
    '{"description":"..."}',
    "",
    `Write a professional real estate description for a ${type} in ${city}, ${rooms} rooms, ${surface} sqm, features: ${features}.`,
    "Keep under 120 words. No fake details. Do not add any extra keys.",
    language === "ar" ? "Write in Arabic." : "Write in English.",
  ].join("\n");
}

function stripCodeFences(s) {
  const t = safeStr(s).trim();
  if (t.startsWith("```")) {
    // remove first fence line and last fence
    const lines = t.split("\n");
    const first = lines[0];
    if (first.startsWith("```")) lines.shift();
    if (lines[lines.length - 1]?.startsWith("```")) lines.pop();
    return lines.join("\n").trim();
  }
  return t;
}

function safeParseJson(text) {
  const raw = stripCodeFences(text);
  try {
    return JSON.parse(raw);
  } catch {
    // try to extract first {...} block
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

async function generateDescription(input) {
  const prompt = buildPrompt(input);
  const messages = [{ role: "user", content: prompt }];

  try {
    const { runAI } = require("./workersAIService");
    const out = await runAI(messages);
    const parsed = safeParseJson(out);
    const desc = parsed && typeof parsed.description === "string" ? parsed.description.trim() : "";
    if (!desc) throw new Error("bad_ai_json");
    return desc;
  } catch {
    return fallbackTemplate(input);
  }
}

module.exports = { generateDescription };

