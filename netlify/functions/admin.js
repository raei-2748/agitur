// Review queue for Letter to Agitur. Protected by the ADMIN_PASSWORD
// environment variable set in Netlify.
//
// GET  -> { pending: [...], approved: [...] }
// POST { action, id?, text? } where action is one of:
//   approve  move a pending letter to approved (optionally with edited text)
//   reject   delete a pending letter
//   edit     change the text of an approved note
//   remove   delete an approved note
//   add      write a new approved note directly

const crypto = require("crypto");
const { openStore, newId, cleanText, listLetters, clientIp, json, MAX_APPROVED } = require("../lib/letters");

const FAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map();

function passwordMatches(given, expected) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

const ID_PATTERN = /^[a-z0-9]{6,32}$/;

exports.handler = async (event) => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return json(503, { error: "Set ADMIN_PASSWORD in Netlify's environment variables, then redeploy." });
  }

  const ip = clientIp(event);
  const now = Date.now();
  const recentFails = (fails.get(ip) || []).filter((t) => now - t < FAIL_WINDOW_MS);
  if (recentFails.length >= MAX_FAILS) {
    return json(429, { error: "Too many wrong passwords. Wait 15 minutes and try again." });
  }

  const headers = event.headers || {};
  if (!passwordMatches(headers["x-admin-password"], expected)) {
    recentFails.push(now);
    fails.set(ip, recentFails);
    return json(401, { error: "Wrong password." });
  }

  let store;
  try {
    store = openStore(event);
  } catch (err) {
    console.error("Store unavailable", err);
    return json(502, { error: "Storage isn't available. Check the deploy log." });
  }

  try {
    if (event.httpMethod === "GET") {
      const [pending, approved] = await Promise.all([
        listLetters(store, "pending"),
        listLetters(store, "approved"),
      ]);
      return json(200, { pending, approved });
    }

    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });

    const body = JSON.parse(event.body || "{}");
    const { action } = body;
    const id = String(body.id || "");
    if (action !== "add" && !ID_PATTERN.test(id)) return json(400, { error: "Missing or invalid letter id." });

    if (action === "approve") {
      const letter = await store.get(`pending/${id}`, { type: "json" });
      if (!letter) return json(404, { error: "That letter is no longer in the queue." });
      const { blobs } = await store.list({ prefix: "approved/" });
      if (blobs.length >= MAX_APPROVED) {
        return json(400, { error: `Agitur already has ${MAX_APPROVED} notes. Remove some before approving more.` });
      }
      const text = body.text !== undefined ? cleanText(body.text) : letter.text;
      if (!text) return json(400, { error: "A note can't be empty." });
      await store.setJSON(`approved/${id}`, { text, created: letter.created, approved: now });
      await store.delete(`pending/${id}`);
      return json(200, { ok: true });
    }

    if (action === "reject") {
      await store.delete(`pending/${id}`);
      return json(200, { ok: true });
    }

    if (action === "edit") {
      const note = await store.get(`approved/${id}`, { type: "json" });
      if (!note) return json(404, { error: "That note doesn't exist any more." });
      const text = cleanText(body.text);
      if (!text) return json(400, { error: "A note can't be empty." });
      await store.setJSON(`approved/${id}`, { ...note, text, edited: now });
      return json(200, { ok: true });
    }

    if (action === "remove") {
      await store.delete(`approved/${id}`);
      return json(200, { ok: true });
    }

    if (action === "add") {
      const text = cleanText(body.text);
      if (!text) return json(400, { error: "Write the note first." });
      const { blobs } = await store.list({ prefix: "approved/" });
      if (blobs.length >= MAX_APPROVED) {
        return json(400, { error: `Agitur already has ${MAX_APPROVED} notes. Remove some first.` });
      }
      await store.setJSON(`approved/${newId()}`, { text, created: now, approved: now });
      return json(200, { ok: true });
    }

    return json(400, { error: "Unknown action." });
  } catch (err) {
    console.error("Admin action failed", err);
    return json(502, { error: "That didn't save. Try again." });
  }
};
