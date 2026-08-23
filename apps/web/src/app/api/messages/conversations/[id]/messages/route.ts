export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok } from "@/lib/api-helpers";
import { badRequest, forbidden, handleError, unauthorized } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";
import { badZod } from "@/lib/validation";
import { markConversationRead, requireConversationParticipant } from "@/lib/messages";
import { logAudit } from "@/lib/audit";
import { notifications } from "@/lib/notifications";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const { id } = await params;
    const ds = await getDataSource();

    const participant = await requireConversationParticipant({ ds, userId: String(me.userId), conversationId: id });
    if (Boolean(participant.is_archived)) {
      // still allow reading archived conversations
    }

    const p = parsePagination(req.nextUrl.searchParams);
    const page = p?.page ?? 1;
    const limit = Math.min(Math.max(p?.limit ?? 50, 1), 100);
    const search = p?.search ?? null;
    const type = req.nextUrl.searchParams.get("type");
    const offset = (page - 1) * limit;

    const where: string[] = [`m.conversation_id = $1`];
    const paramsArr: any[] = [id];
    if (type && ["text", "image", "file", "system"].includes(type)) {
      paramsArr.push(type);
      where.push(`m.type = $${paramsArr.length}`);
    }
    if (search) {
      paramsArr.push(`%${search}%`);
      where.push(`m.content ILIKE $${paramsArr.length}`);
    }

    const totalRows = await ds.query(`SELECT COUNT(*)::int AS c FROM messages m WHERE ${where.join(" AND ")}`, paramsArr);
    const total = Number(totalRows?.[0]?.c ?? 0);

    paramsArr.push(limit);
    paramsArr.push(offset);
    const rows = await ds.query(
      `
      SELECT
        m.id,
        m.sender_id,
        COALESCE(u.full_name, u.email) AS sender_name,
        u.user_type AS sender_role,
        m.content,
        m.type,
        m.file_url,
        m.file_name,
        m.file_size,
        m.file_type,
        m.is_edited,
        m.edited_at,
        m.is_deleted,
        m.read_by,
        m.created_at
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE ${where.join(" AND ")}
      ORDER BY m.created_at DESC
      LIMIT $${paramsArr.length - 1} OFFSET $${paramsArr.length}
      `,
      paramsArr
    );

    await markConversationRead({ ds, userId: String(me.userId), conversationId: id });

    const items = (rows ?? []).map((r: any) => ({
      id: String(r.id),
      sender: { id: String(r.sender_id), name: String(r.sender_name ?? "—"), role: String(r.sender_role ?? "owner") },
      content: r.is_deleted ? null : (r.content ?? null),
      type: String(r.type ?? "text"),
      file_url: r.file_url ?? null,
      file_name: r.file_name ?? null,
      file_size: r.file_size ?? null,
      file_type: r.file_type ?? null,
      is_edited: Boolean(r.is_edited),
      edited_at: r.edited_at ? String(r.edited_at) : null,
      is_deleted: Boolean(r.is_deleted),
      read_by: r.read_by ?? [],
      created_at: r.created_at ? String(r.created_at) : null,
    }));

    return ok(paginated({ items, page, limit, total }));
  } catch (err) {
    return handleError(err);
  }
}

const SendJsonSchema = z.object({
  content: z.string().trim().max(5000).optional(),
  type: z.enum(["text", "image", "file"]).default("text"),
});

async function ensureUploadsDir() {
  const dir = path.join(process.cwd(), "public", "uploads", "messages");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

function validateServerFile(file: File, opts: { maxBytes: number; allowedMime: string[] }) {
  if (!file) return "الملف غير موجود";
  if (file.size > opts.maxBytes) return `حجم الملف كبير`;
  if (opts.allowedMime.length && !opts.allowedMime.includes(file.type)) return "نوع الملف غير مدعوم";
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();
    const { id } = await params;
    const ds = await getDataSource();

    const participant = await requireConversationParticipant({ ds, userId: String(me.userId), conversationId: id });
    if (Boolean(participant.is_archived)) throw forbidden("المحادثة مؤرشفة");

    const ct = req.headers.get("content-type") ?? "";
    let payload: { content?: string; type: "text" | "image" | "file" } = { type: "text" };
    let file: File | null = null;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const type = String(form.get("type") ?? "text");
      const content = form.get("content");
      const f = form.get("file");
      payload = SendJsonSchema.safeParse({ type, content: typeof content === "string" ? content : undefined }).success
        ? (SendJsonSchema.parse({ type, content: typeof content === "string" ? content : undefined }) as any)
        : (() => {
            throw badRequest(badZod(SendJsonSchema.safeParse({ type, content }).error!));
          })();
      file = f instanceof File ? f : null;
    } else {
      const body = await req.json();
      const parsed = SendJsonSchema.safeParse(body);
      if (!parsed.success) throw badRequest(badZod(parsed.error));
      payload = parsed.data;
    }

    if (payload.type === "text") {
      if (!payload.content?.trim()) throw badRequest("المحتوى مطلوب");
    } else {
      if (!file) throw badRequest("الملف مطلوب");
    }

    let file_url: string | null = null;
    let file_name: string | null = null;
    let file_size: number | null = null;
    let file_type: string | null = null;

    if (payload.type === "image" || payload.type === "file") {
      const isImage = payload.type === "image";
      const err = validateServerFile(file!, {
        maxBytes: isImage ? 10 * 1024 * 1024 : 20 * 1024 * 1024,
        allowedMime: isImage
          ? ["image/png", "image/jpeg", "image/webp", "image/gif"]
          : ["application/pdf", "application/zip", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      });
      if (err) throw badRequest(err);

      const dir = await ensureUploadsDir();
      // Extension comes from the client-supplied file name. The base name is a
      // server-generated UUID; keep only a short alphanumeric extension so the
      // final name can never contain path separators (MIME is validated above).
      const rawExt = path.extname(file!.name || "").toLowerCase();
      const ext = /^\.[a-zA-Z0-9]{1,10}$/.test(rawExt) ? rawExt : (isImage ? ".png" : "");
      const safeName = `${randomUUID()}${ext}`;
      // Defense-in-depth: keep the write inside the upload directory.
      // nosemgrep: path-join-resolve-traversal — safeName is a server-generated UUID
      // with a constrained extension suffix, so it cannot traverse; the guard below
      // enforces this regardless.
      const abs = path.resolve(dir, safeName); // nosemgrep: path-join-resolve-traversal
      if (!abs.startsWith(path.resolve(dir) + path.sep)) {
        throw badRequest("مسار الملف غير صالح");
      }
      const buf = Buffer.from(await file!.arrayBuffer());
      await fs.writeFile(abs, buf);
      file_url = `/uploads/messages/${safeName}`;
      file_name = file!.name ?? null;
      file_size = file!.size ?? null;
      file_type = file!.type ?? null;
    }

    const msgRepo = ds.getRepository("Message");
    const message = msgRepo.create({
      conversation_id: id,
      sender_id: String(me.userId),
      content: payload.type === "text" ? payload.content!.trim() : null,
      type: payload.type,
      file_url,
      file_name,
      file_size,
      file_type,
      is_deleted: false,
      read_by: [{ user_id: String(me.userId), read_at: new Date().toISOString() }],
    } as any);
    await msgRepo.save(message);

    await ds.query(`UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);

    // notify others
    const others = await ds.query(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id <> $2`,
      [id, String(me.userId)]
    );
    const notifRepo = ds.getRepository("MessageNotification");
    for (const r of others ?? []) {
      await notifRepo.save(
        notifRepo.create({
          user_id: String(r.user_id),
          conversation_id: id,
          message_id: String((message as any).id),
          is_read: false,
        } as any)
      );
      // Channel notification (in-app at minimum) for each participant
      await notifications
        .dispatch({
          type: "message.received",
          recipientId: String(r.user_id),
          actorId: String(me.userId),
          officeId: String((me as any).officeId ?? ""),
          priority: "normal",
          channels: [],
          metadata: {
            conversationId: id,
            senderName: String(me.email ?? "—"),
            preview: payload.type === "text" ? String(payload.content ?? "").slice(0, 120) : "[ملف مرفق]",
          },
        })
        .catch(() => {});
    }

    logAudit({
      userId: String(me.userId),
      action: "create",
      entityType: "message",
      entityId: String((message as any).id),
      metadata: { conversation_id: id, type: payload.type },
      req,
    });

    return ok({
      id: String((message as any).id),
      sender: { id: String(me.userId), name: String(me.email ?? "—"), role: String(me.userType ?? "owner") },
      content: payload.type === "text" ? payload.content!.trim() : null,
      type: payload.type,
      file_url,
      file_name,
      file_size,
      file_type,
      is_edited: false,
      is_deleted: false,
      read_by: [{ user_id: String(me.userId), read_at: new Date().toISOString() }],
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}

