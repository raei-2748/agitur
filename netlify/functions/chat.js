// Serverless function: receives a chat message, adds the Agitur persona and Knox
// context, calls the Gemini API with the key kept in an environment variable,
// and returns the reply. The API key never reaches the browser.

const { SYSTEM_PROMPT } = require("./context");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY_TURNS = 12;
const MAX_REPLY_TOKENS = 300;

// Simple per-IP limit. Best effort only: serverless instances may not share memory.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { reply: "Wrong door. Use the chat box." });
  }

  const ip =
    (event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"])) ||
    "unknown";
  if (rateLimited(ip)) {
    return json(429, { reply: "That's a lot of messages. Even I need a break. Try again later." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { reply: "That didn't parse. Neither did my morning." });
  }

  const message = String(body.message || "").trim().slice(0, MAX_MESSAGE_CHARS);
  if (!message) {
    return json(400, { reply: "You sent nothing. Bold, but unhelpful." });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  const contents = [];
  for (const turn of history) {
    if (turn && (turn.role === "user" || turn.role === "model") && typeof turn.text === "string") {
      contents.push({
        role: turn.role,
        parts: [{ text: turn.text.slice(0, MAX_MESSAGE_CHARS * 2) }],
      });
    }
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  // Accepts either variable name set in Netlify.
  const apiKey = process.env.GEMINI_API_KEY || process.env.gemini_agitur;
  if (!apiKey) {
    return json(500, { reply: "The site owner forgot the API key. Classic." });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 1.0, maxOutputTokens: MAX_REPLY_TOKENS },
        }),
      }
    );

    if (!res.ok) {
      console.error("Gemini error", res.status, await res.text());
      return json(502, { reply: "The model is having a worse day than you. Try again shortly." });
    }

    const data = await res.json();
    const reply = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();

    if (!reply) {
      return json(502, { reply: "I had nothing to say, which for me is a rare kind of progress. Try again." });
    }
    return json(200, { reply });
  } catch (err) {
    console.error("Request failed", err);
    return json(502, { reply: "Connection failed. Shocking, I know." });
  }
};
