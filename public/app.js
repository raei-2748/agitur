const log = document.getElementById("log");
const form = document.getElementById("form");
const input = document.getElementById("input");
const micBtn = document.getElementById("mic");
const speakToggle = document.getElementById("speak");

// Conversation so far, sent back with each message so Agitur remembers the thread.
const history = [];

function addLine(who, text) {
  const p = document.createElement("p");
  p.className = who;
  p.textContent = text;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
  return p;
}

function speak(text) {
  if (!speakToggle.checked || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 0.9;
  speechSynthesis.speak(utterance);
}

async function send(text) {
  text = text.trim();
  if (!text) return;

  addLine("you", text);
  input.value = "";
  const pending = addLine("bot pending", "...");
  pending.classList.add("bot");

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
    speak(reply);
  } catch {
    pending.remove();
    addLine("bot", "Connection failed. Shocking, I know.");
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
  rec.onresult = (e) => send(e.results[0][0].transcript);
  rec.onend = () => micBtn.classList.remove("listening");
  rec.onerror = () => micBtn.classList.remove("listening");
  micBtn.addEventListener("click", () => {
    micBtn.classList.add("listening");
    rec.start();
  });
} else {
  micBtn.disabled = true;
  micBtn.title = "Voice input isn't supported in this browser";
}

addLine("bot", "Oh good, you're here. Ask me about the Academic Portfolio. I'll try to look surprised.");
