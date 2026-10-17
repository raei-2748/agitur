// Receives a Letter to Agitur and files it in the review queue.
// Nothing reaches Agitur until an admin approves it.

const { openStore, newId, cleanText, clientIp, json } = require("../lib/letters");

const MIN_CHARS = 10;
const MAX_PENDING = 200;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Use the letter form." });

  const ip = clientIp(event);
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return json(429, { error: "You've sent a few letters already. Try again in an hour." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "That letter didn't arrive properly. Try sending it again." });
  }

  // Hidden field that people never see. Bots tend to fill it in.
  if (body.website) return json(200, { ok: true });

  const text = cleanText(body.text);
  if (text.length < MIN_CHARS) {
    return json(400, { error: "Write at least a sentence so the team knows what you mean." });
  }

  try {
    const store = openStore(event);
    const { blobs } = await store.list({ prefix: "pending/" });
    if (blobs.length >= MAX_PENDING) {
      return json(503, { error: "The mailbox is full until the team catches up. Try again later." });
    }
    await store.setJSON(`pending/${newId()}`, { text, created: now });
    recent.push(now);
    hits.set(ip, recent);
    return json(200, { ok: true });
  } catch (err) {
    console.error("Letter save failed", err);
    return json(502, { error: "The letter couldn't be saved. Try again in a minute." });
  }
};
