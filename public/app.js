const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const micBtn = document.getElementById("mic");
const speakToggle = document.getElementById("speak");
const statusEl = document.getElementById("status");

// Conversation so far, sent back with each message so Agitur remembers the thread.
const history = [];

// The page's visual state drives the orb: idle, listening, thinking, speaking.
function setState(state, label = "") {
  document.body.dataset.state = state;
  statusEl.textContent = label;
}

function addLine(who, text) {
  const p = document.createElement("p");
  p.className = who;
  p.textContent = text;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
  return p;
}

// Voice output: the browser's built-in speech. It is free, and the quality depends
// on the voices installed. This picks the most natural English voice available.
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
  if (!speakToggle.checked || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (chosenVoice) utterance.voice = chosenVoice;
  // Close to normal speed and pitch. Exaggerated values sound robotic.
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.onstart = () => setState("speaking", "Speaking");
  utterance.onend = () => setState("idle");
  utterance.onerror = () => setState("idle");
  speechSynthesis.speak(utterance);
}

async function send(text) {
  text = text.trim();
  if (!text) return;

  addLine("you", text);
  input.value = "";
  const pending = addLine("bot pending", "···");
  pending.classList.add("bot");
  setState("thinking", "Thinking");

  try {
    const res = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history.slice(-12) }),
    });
    const data = await res.json();
    pending.remove();
    const reply = data.reply || "No reply. Suspicious.";
    addLine("bot", reply);
    history.push({ role: "user", text });
    history.push({ role: "model", text: reply });
    if (speakToggle.checked) {
      speak(reply);
    } else {
      setState("idle");
    }
  } catch {
    pending.remove();
    addLine("bot", "Connection failed. Shocking, I know.");
    setState("idle");
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  send(input.value);
});

// Voice input uses the browser's built-in speech recognition (Chrome, Edge, Safari).
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRec) {
  const rec = new SpeechRec();
  rec.lang = "en-AU";
  rec.interimResults = false;
  rec.onresult = (e) => {
    setState("idle");
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
    setState("listening", "Listening");
    rec.start();
  });
} else {
  micBtn.disabled = true;
  micBtn.title = "Voice input isn't supported in this browser";
}

addLine("bot", "Oh good, you're here. Ask me about the Academic Portfolio. I'll try to look surprised.");
