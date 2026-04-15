import { NextRequest } from "next/server";
import { z } from "zod";
import { getDataSource } from "@/lib/db/data-source";
import { getUserFromRequest, ok } from "@/lib/api-helpers";
import { badRequest, handleError, unauthorized } from "@/lib/errors";
import { parsePagination, paginated } from "@/lib/pagination";
import { badZod, UuidSchema } from "@/lib/validation";
import { ensureDirectLinkOrThrow, getPropertyAccessOrThrow, getUnitAccessOrThrow } from "@/lib/messages";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) throw unauthorized();

    const ds = await getDataSource();
    const { searchParams } = new URL(req.url);

    const page = parsePagination(searchParams) ?? { page: 1, limit: 20, offset: 0, search: null };
    const search = page.search ?? null;
    const type = searchParams.get("type"); // direct|property|unit|support
    const archived = searchParams.get("is_archived"); // true|false

    const params: any[] = [String(user.userId)];
    let idx = 2;

    // Base scope: conversations where current user is participant
    let where = `
      WHERE cp.user_id = $1
    `;
    if (type && ["direct", "property", "unit", "support"].includes(type)) {
      where += ` AND c.type = $${idx++}`;
      params.push(type);
    }
    if (archived === "true") where += ` AND c.is_archived = true`;
    if (archived === "false") where += ` AND c.is_archived = false`;

    if (search) {
      where += ` AND (
        c.subject ILIKE $${idx}
        OR EXISTS (
          SELECT 1
          FROM conversation_participants cp2
          JOIN users u2 ON u2.id = cp2.user_id
          WHERE cp2.conversation_id = c.id
            AND u2.deleted_at IS NULL
            AND (u2.full_name ILIKE $${idx} OR u2.email ILIKE $${idx} OR u2.phone ILIKE $${idx})
        )
      )`;
      params.push(`%${search}%`);
      idx++;
    }

    // total count
    const totalRows = await ds.query(
      `
      SELECT COUNT(*)::int AS total
      FROM conversation_participants cp
      JOIN conversations c ON c.id = cp.conversation_id
      ${where}
      `,
      params
    );
    const total = Number(totalRows?.[0]?.total ?? 0) || 0;

    // pagination
    params.push(page.limit, page.offset);

    const rows = await ds.query(
      `
      SELECT
        c.id,
        c.type,
        c.subject,
        c.property_id,
        p.name AS property_name,
        c.unit_id,
        u.label AS unit_label,
        c.is_archived,
        c.created_at,
        c.last_message_at,

        -- participants (with user info)
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', u3.id,
            'name', COALESCE(u3.full_name, u3.email),
            'role', cp3.role,
            'is_active', COALESCE(u3.is_active, true)
          ) ORDER BY cp3.joined_at ASC)
          FROM conversation_participants cp3
          JOIN users u3 ON u3.id = cp3.user_id
          WHERE cp3.conversation_id = c.id
            AND u3.deleted_at IS NULL
        ), '[]'::jsonb) AS participants,

        -- last message
        (
          SELECT jsonb_build_object(
            'content', m.content,
            'sender_name', COALESCE(s.full_name, s.email),
            'created_at', m.created_at,
            'type', m.type
          )
          FROM messages m
          JOIN users s ON s.id = m.sender_id
          WHERE m.conversation_id = c.id
            AND m.is_deleted = false
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message,

        -- unread count for current user
        COALESCE((
          SELECT COUNT(*)::int
          FROM messages m2
          WHERE m2.conversation_id = c.id
            AND m2.is_deleted = false
            AND m2.sender_id != $1
            AND (
              cp.last_read_at IS NULL
              OR m2.created_at > cp.last_read_at
            )
        ), 0) AS unread_count

      FROM conversation_participants cp
      JOIN conversations c ON c.id = cp.conversation_id
      LEFT JOIN properties p ON p.id = c.property_id
      LEFT JOIN units u ON u.id = c.unit_id
      ${where}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      LIMIT $${idx++} OFFSET $${idx++}
      `,
      params
    );

    const items = (rows ?? []).map((r: any) => ({
      id: String(r.id),
      type: String(r.type ?? "direct"),
      subject: r.subject ? String(r.subject) : null,
      property: r.property_id ? { id: String(r.property_id), name: String(r.property_name ?? "—") } : null,
      unit: r.unit_id ? { id: String(r.unit_id), label: String(r.unit_label ?? "—") } : null,
      participants: Array.isArray(r.participants) ? r.participants : [],
      lastMessage: r.last_message ?? null,
      unreadCount: Number(r.unread_count) || 0,
      is_archived: Boolean(r.is_archived),
      created_at: r.created_at ? String(r.created_at) : null,
    }));

    return ok(paginated({ items, total, page: page.page, limit: page.limit, search }));
  } catch (err) {
    return handleError(err);
  }
}

const CreateConversationSchema = z
  .object({
    type: z.enum(["direct", "property", "unit", "support"]),
    participant_ids: z.array(UuidSchema).min(1, "يجب اختيار مشارك واحد على الأقل"),
    property_id: UuidSchema.optional().nullable(),
    unit_id: UuidSchema.optional().nullable(),
    subject: z.string().trim().max(200).optional().nullable(),
    initial_message: z.string().trim().max(5000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "property" && !v.property_id) ctx.addIssue({ code: "custom", message: "property_id مطلوب" });
    if (v.type === "unit" && !v.unit_id) ctx.addIssue({ code: "custom", message: "unit_id مطلوب" });
  });

export async function POST(req: NextRequest) {
  try {
    const me = await getUserFromRequest(req);
    if (!me) throw unauthorized();

    const body = await req.json();
    const parsed = CreateConversationSchema.safeParse(body);
    if (!parsed.success) throw badRequest(badZod(parsed.error));

    const ds = await getDataSource();
    const meId = String(me.userId);
    const meType = String(me.userType ?? "");

    // participant_ids are user ids, but owner UI may pass officeId.
    const rawIds = await Promise.all(
      parsed.data.participant_ids.map(async (v) => {
        const id = String(v);
        const u = await ds.query(`SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [id]);
        if (u?.[0]?.id) return id;
        if (parsed.data.type === "direct" && meType === "owner") {
          const agency = await ds.query(
            `SELECT id FROM users WHERE office_id = $1 AND user_type = 'agency' AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
            [id]
          );
          if (agency?.[0]?.id) return String(agency[0].id);
        }
        return id;
      })
    );
    const unique = Array.from(new Set([meId, ...rawIds])).filter(Boolean);
    const others = unique.filter((id) => id !== meId);
    if (others.length === 0) throw badRequest("لا يمكن إنشاء محادثة مع نفسك فقط");

    // Authorization by type
    if (parsed.data.type === "property") {
      await getPropertyAccessOrThrow({ ds, user: me, propertyId: String(parsed.data.property_id) });
    }
    if (parsed.data.type === "unit") {
      await getUnitAccessOrThrow({ ds, user: me, unitId: String(parsed.data.unit_id) });
    }
    if (parsed.data.type === "direct") {
      // every other participant must be linked
      for (const otherId of others) {
        await ensureDirectLinkOrThrow({ ds, me, otherUserId: otherId });
      }

      // Reuse existing direct conversation when it's exactly 1:1 (me + one other)
      if (others.length === 1) {
        const otherId = String(others[0]);
        const existing = await ds.query(
          `
          SELECT c.id
          FROM conversations c
          JOIN conversation_participants cp ON cp.conversation_id = c.id
          WHERE c.type = 'direct'
            AND c.property_id IS NULL
            AND c.unit_id IS NULL
            AND cp.user_id IN ($1, $2)
          GROUP BY c.id
          HAVING COUNT(*) = 2
          LIMIT 1
          `,
          [meId, otherId]
        );
        const ex = existing?.[0]?.id ? String(existing[0].id) : null;
        if (ex) {
          return ok({ id: ex, reused: true });
        }
      }
    }

    // Create conversation
    const convRepo = ds.getRepository("Conversation");
    const conv = convRepo.create({
      type: parsed.data.type,
      property_id: parsed.data.property_id ?? null,
      unit_id: parsed.data.unit_id ?? null,
      subject: parsed.data.subject?.trim() ? parsed.data.subject.trim() : null,
      created_by: meId,
      is_archived: false,
      last_message_at: null,
    } as any);
    await convRepo.save(conv);

    // Add participants
    const partRepo = ds.getRepository("ConversationParticipant");
    const meRole = String(me.userType ?? "") === "agency" ? "agency" : "owner";
    const participantsToInsert = unique.map((uid) =>
      partRepo.create({
        conversation_id: (conv as any).id,
        user_id: uid,
        role: uid === meId ? meRole : "owner",
        last_read_at: uid === meId ? new Date().toISOString() : null,
        is_muted: false,
      } as any)
    );
    await partRepo.save(participantsToInsert);

    // Initial message
    if (parsed.data.initial_message?.trim()) {
      const msgRepo = ds.getRepository("Message");
      const message = msgRepo.create({
        conversation_id: (conv as any).id,
        sender_id: meId,
        content: parsed.data.initial_message.trim(),
        type: "text",
        is_deleted: false,
        read_by: [{ user_id: meId, read_at: new Date().toISOString() }],
      } as any);
      await msgRepo.save(message);
      await ds.query(`UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`, [(conv as any).id]);

      // notifications for others
      const notifRepo = ds.getRepository("MessageNotification");
      for (const uid of others) {
        await notifRepo.save(
          notifRepo.create({
            user_id: uid,
            conversation_id: (conv as any).id,
            message_id: (message as any).id,
            is_read: false,
          } as any)
        );
      }
    }

    const participants = await ds.query(
      `SELECT u.id, COALESCE(u.full_name, u.email) AS name, cp.role
       FROM conversation_participants cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.conversation_id = $1 AND u.deleted_at IS NULL
       ORDER BY cp.joined_at ASC`,
      [(conv as any).id]
    );

    logAudit({
      userId: meId,
      action: "create",
      entityType: "conversation",
      entityId: String((conv as any).id),
      metadata: { type: parsed.data.type },
      req,
    });

    return ok({
      id: String((conv as any).id),
      type: String((conv as any).type),
      subject: (conv as any).subject ?? null,
      property_id: (conv as any).property_id ?? null,
      unit_id: (conv as any).unit_id ?? null,
      participants: participants ?? [],
    });
  } catch (err) {
    return handleError(err);
  }
}

