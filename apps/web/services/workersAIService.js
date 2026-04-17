/* eslint-disable no-undef */
/**
 * Reusable Cloudflare Workers AI client (server-side).
 *
 * Usage:
 *   const { runAI } = require("./workersAIService");
 *   const text = await runAI([{ role: "user", content: "Hello" }]);
 */

const { cfToken, cfAccountId } = require("../config/env.js");

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("[workers-ai] messages must be a non-empty array");
  }
  for (const m of messages) {
    if (!isPlainObject(m)) throw new Error("[workers-ai] invalid message item");
    if (!m.role || !m.content) throw new Error("[workers-ai] each message must have role and content");
  }
  return messages;
}

async function runAI(messages, opts = {}) {
  const model = opts.model || "@cf/meta/llama-3-8b-instruct";
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? Number(opts.timeoutMs) : 8000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(100, timeoutMs));

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfAccountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: normalizeMessages(messages) }),
        signal: controller.signal,
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const msg =
        (data && (data.errors?.[0]?.message || data.message)) ||
        `HTTP ${response.status} from Workers AI`;
      throw new Error(`[workers-ai] request failed: ${msg}`);
    }

    if (!data || data.success !== true) {
      throw new Error("[workers-ai] Workers AI failed");
    }

    const text = data?.result?.response;
    if (typeof text !== "string") {
      throw new Error("[workers-ai] unexpected response shape");
    }

    return text;
  } catch (error) {
    // Ensure abort errors are clearer for callers
    if (error && (error.name === "AbortError" || String(error.message || "").includes("aborted"))) {
      throw new Error("[workers-ai] timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { runAI };

