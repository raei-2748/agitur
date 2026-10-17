// Shared helpers for Letter to Agitur. Letters live in Netlify Blobs:
//   pending/<id>   waiting for review
//   approved/<id>  checked by an admin; Agitur can use these

const { connectLambda, getStore } = require("@netlify/blobs");

const MAX_LETTER_CHARS = 1000;
const MAX_APPROVED = 80;

function openStore(event) {
  connectLambda(event);
  return getStore({ name: "letters", consistency: "strong" });
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_LETTER_CHARS);
}

async function listLetters(store, status) {
  const { blobs } = await store.list({ prefix: `${status}/` });
  const items = await Promise.all(
    blobs.map(async (b) => {
      const data = await store.get(b.key, { type: "json" });
      return data ? { id: b.key.slice(status.length + 1), ...data } : null;
    })
  );
  return items.filter(Boolean).sort((a, b) => a.created - b.created);
}

function clientIp(event) {
  const h = event.headers || {};
  return h["x-nf-client-connection-ip"] || h["client-ip"] || "unknown";
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

module.exports = { openStore, newId, cleanText, listLetters, clientIp, json, MAX_LETTER_CHARS, MAX_APPROVED };
