import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, badRequest, serverError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateDescription } = require("../../../../services/descriptionGeneratorService.js");

const InputSchema = z.object({
  type: z.string().min(1),
  city: z.string().min(1),
  rooms: z.number().int().min(0).max(50),
  surface: z.number().int().min(0).max(50_000),
  features: z.array(z.string()).default([]),
  language: z.enum(["en", "ar"]).default("en"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) return badRequest("بيانات غير صحيحة");

    const description = await generateDescription(parsed.data);
    return ok({ description });
  } catch (err) {
    return serverError(err);
  }
}

