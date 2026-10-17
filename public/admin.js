const ENDPOINT = "/.netlify/functions/admin";
const msg = document.getElementById("msg");
const loginForm = document.getElementById("login");
const pwField = document.getElementById("pw");
const room = document.getElementById("room");
const logoutBtn = document.getElementById("logout");

let password = "";
try { password = sessionStorage.getItem("agitur-admin") || ""; } catch {}

function say(text, kind = "") {
  msg.textContent = text;
  msg.className = `msg ${kind}`;
}

function when(ts) {
  return new Date(ts).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

async function call(method, body) {
  const res = await fetch(ENDPOINT, {
    method,
    headers: { "Content-Type": "application/json", "x-admin-password": password },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function button(label, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${cls}`;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function card(item, waiting) {
  const el = document.createElement("div");
  el.className = waiting ? "card waiting" : "card";
  const ta = document.createElement("textarea");
  ta.maxLength = 1000;
  ta.value = item.text;
  ta.setAttribute("aria-label", waiting ? "Letter text" : "Note text");
  el.appendChild(ta);

  const row = document.createElement("div");
  row.className = "row";
  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = waiting ? `Received ${when(item.created)}` : `Approved ${when(item.approved || item.created)}`;
  row.appendChild(meta);

  if (waiting) {
    row.appendChild(button("Bin", "danger", () => act({ action: "reject", id: item.id }, "Letter binned.")));
    row.appendChild(button("Approve", "solid", () => act({ action: "approve", id: item.id, text: ta.value }, "Approved. Agitur will know within a minute.")));
  } else {
    row.appendChild(button("Remove", "danger", () => {
      if (confirm("Remove this note from Agitur?")) act({ action: "remove", id: item.id }, "Note removed.");
    }));
    row.appendChild(button("Save changes", "ghost", () => act({ action: "edit", id: item.id, text: ta.value }, "Changes saved.")));
  }
  el.appendChild(row);
  return el;
}

function fill(listEl, countEl, items, waiting, emptyText) {
  listEl.replaceChildren();
  countEl.textContent = `(${items.length})`;
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = emptyText;
    listEl.appendChild(p);
    return;
  }
  for (const item of waiting ? items : [...items].reverse()) listEl.appendChild(card(item, waiting));
}

async function load() {
  try {
    const data = await call("GET");
    fill(document.getElementById("pending"), document.getElementById("pending-n"), data.pending, true, "No letters waiting. Enjoy the quiet.");
    fill(document.getElementById("approved"), document.getElementById("approved-n"), data.approved, false, "Agitur hasn't been told anything yet. Approve a letter or add a note below.");
    loginForm.hidden = true;
    room.hidden = false;
    logoutBtn.hidden = false;
    try { sessionStorage.setItem("agitur-admin", password); } catch {}
  } catch (err) {
    if (err.status === 401) {
      password = "";
      try { sessionStorage.removeItem("agitur-admin"); } catch {}
      loginForm.hidden = false;
      room.hidden = true;
      logoutBtn.hidden = true;
    }
    say(err.message, "bad");
  }
}

async function act(body, done) {
  try {
    await call("POST", body);
    say(done, "good");
    await load();
  } catch (err) {
    say(err.message, "bad");
  }
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  password = pwField.value;
  say("");
  load();
});

logoutBtn.addEventListener("click", () => {
  password = "";
  try { sessionStorage.removeItem("agitur-admin"); } catch {}
  location.reload();
});

document.getElementById("add").addEventListener("click", () => {
  const ta = document.getElementById("new-note");
  const text = ta.value.trim();
  if (!text) return say("Write the note first.", "bad");
  act({ action: "add", text }, "Note added.").then(() => { ta.value = ""; });
});

if (password) load();
