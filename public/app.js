const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const micBtn = document.getElementById("mic");
const speakToggle = document.getElementById("speak");

// Conversation so far, sent back with each message so Agitur remembers the thread.
const history = [];

// The page's state drives the cloud: idle, listening, thinking, speaking.
function setState(state) {
  document.body.dataset.state = state;
}

// A different forecast each visit.
const FORECASTS = [
  "Forecast: overcast, with a 90% chance of sarcasm.",
  "Forecast: light drizzle of motivation, clearing by never.",
  "Forecast: grey skies and high pressure from assessments.",
  "Forecast: fog in the morning, deadlines by the afternoon.",
  "Forecast: mostly cloudy, with occasional helpful spells.",
];
document.getElementById("forecast").textContent = FORECASTS[Math.floor(Math.random() * FORECASTS.length)];

function scrollToEnd() {
  log.scrollTop = log.scrollHeight;
}

function addYou(text) {
  const p = document.createElement("p");
  p.className = "you new";
  p.textContent = text;
  log.appendChild(p);
  scrollToEnd();
}

// Agitur's lines sit unboxed beside a small cloud.
function addBot(text, extraClass = "") {
  const row = document.createElement("div");
  row.className = `bot new ${extraClass}`.trim();
  row.innerHTML = '<svg class="mini" viewBox="0 0 200 150" aria-hidden="true"><use href="#puff"/></svg>';
  const p = document.createElement("p");
  p.textContent = text;
  row.appendChild(p);
  log.appendChild(row);
  scrollToEnd();
  return row;
}

// Voice output: the browser's built-in speech. Free; quality depends on the device.
const PREFERRED_VOICES = [
  "Google UK English Female",
  "Microsoft Libby Online (Natural)",
  "Microsoft Aria Online (Natural)",
  "Microsoft Sonia Online (Natural)",
  "Samantha",
  "Karen",
  "Google US English",
];

let chosenVoice = null;

function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  if (!voices.length) return;
  for (const name of PREFERRED_VOICES) {
    const match = voices.find((v) => v.name.includes(name));
    if (match) {
      chosenVoice = match;
      return;
    }
  }
  chosenVoice = voices[0];
}

if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function speak(text) {
  if (!speakToggle.checked || !("speechSynthesis" in window)) {
    setState("idle");
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (chosenVoice) utterance.voice = chosenVoice;
  utterance.onstart = () => setState("speaking");
  utterance.onend = () => setState("idle");
  utterance.onerror = () => setState("idle");
  speechSynthesis.speak(utterance);
}

async function send(text) {
  text = text.trim();
  if (!text) return;

  document.body.classList.add("chatting");
  addYou(text);
  input.value = "";
  const pending = addBot("Thinking it over…", "pending");
  setState("thinking");

  try {
    const res = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history.slice(-12) }),
    });
    const data = await res.json();
    pending.remove();
    const reply = data.reply || "No reply came back. Try asking again.";
    addBot(reply);
    history.push({ role: "user", text });
    history.push({ role: "model", text: reply });
    speak(reply);
  } catch {
    pending.remove();
    addBot("I couldn't reach the server. Check your connection and try again.");
    setState("idle");
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  send(input.value);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => send(chip.textContent));
});

// Voice input uses the browser's built-in speech recognition (Chrome, Edge, Safari).
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRec) {
  const rec = new SpeechRec();
  rec.lang = "en-AU";
  rec.interimResults = false;
  rec.onresult = (e) => {
    micBtn.classList.remove("listening");
    send(e.results[0][0].transcript);
  };
  rec.onend = () => {
    micBtn.classList.remove("listening");
    if (document.body.dataset.state === "listening") setState("idle");
  };
  rec.onerror = () => {
    micBtn.classList.remove("listening");
    setState("idle");
  };
  micBtn.addEventListener("click", () => {
    micBtn.classList.add("listening");
    setState("listening");
    rec.start();
  });
} else {
  micBtn.disabled = true;
  micBtn.title = "Voice input isn't supported in this browser";
}

// Letter to Agitur
const dialog = document.getElementById("letter");
const letterText = document.getElementById("letter-text");
const letterCount = document.getElementById("letter-count");
const letterError = document.getElementById("letter-error");
const letterSend = document.getElementById("letter-send");
const compose = document.getElementById("letter-compose");
const posted = document.getElementById("letter-posted");

function openLetter() {
  compose.hidden = false;
  posted.hidden = true;
  letterError.textContent = "";
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  letterText.focus();
}

function closeLetter() {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

letterText.addEventListener("input", () => {
  letterCount.textContent = `${letterText.value.length} / 1000`;
});

document.getElementById("open-letter").addEventListener("click", openLetter);
document.getElementById("letter-cancel").addEventListener("click", closeLetter);
document.getElementById("letter-done").addEventListener("click", closeLetter);
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) closeLetter();
});

letterSend.addEventListener("click", async () => {
  const text = letterText.value.trim();
  letterError.textContent = "";
  if (text.length < 10) {
    letterError.textContent = "Write at least a sentence so the team knows what you mean.";
    return;
  }
  letterSend.disabled = true;
  letterSend.textContent = "Posting…";
  try {
    const res = await fetch("/.netlify/functions/letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, website: document.getElementById("letter-website").value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      letterError.textContent = data.error || "The letter couldn't be posted. Try again in a minute.";
      return;
    }
    letterText.value = "";
    letterCount.textContent = "0 / 1000";
    compose.hidden = true;
    posted.hidden = false;
  } catch {
    letterError.textContent = "The letter couldn't be posted. Check your connection and try again.";
  } finally {
    letterSend.disabled = false;
    letterSend.textContent = "Post letter";
  }
});
