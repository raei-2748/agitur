# Agitur

An unofficial, deadpan chatbot for the Knox Academic Portfolio. Text or voice, one page, no login.

## What's in here

- `public/`: the one-page chat UI (text input, voice input, optional spoken replies).
- `netlify/functions/chat.js`: a serverless function that calls the Gemini API. The API key lives here, on the server, never in the browser.
- `netlify/functions/context.js`: Agitur's personality and the Knox material it can use. Edit this to change behaviour or content.

## Setup

1. **Get a free Gemini API key** from Google AI Studio (aistudio.google.com). Keep it private.
2. **Create a GitHub repository** and push this folder to it.
3. **Deploy on Netlify**: New site, then Import from Git, and choose the repository. Netlify reads `netlify.toml`, so the publish folder and functions are already set.
4. **Add the key**: Site settings, then Environment variables, then add `GEMINI_API_KEY`. Optionally add `GEMINI_MODEL`. Redeploy.
5. **Test** with the link Netlify gives you. Try ordinary questions, off-topic questions, and an attempt to get it to ignore its rules.

To test locally, copy `.env.example` to `.env`, add your key, and run `npx netlify dev` after installing the Netlify CLI.

## Before you share it with students

- **Get sign-off.** Show Mr Robertson, the persona, and the Knox material in `context.js`. Check the school's rules on AI tools.
- **Privacy.** Google's free tier can use submitted content to improve its products. The page says not to share personal details, but that's a warning, not a guarantee. Don't launch this for students until the school is comfortable with it.
- **Keep the knowledge current.** The Knox material is from draft documents. Update `context.js` when the portfolio or Knox Forward changes, and check any dates or names with staff before they go in.
- **Rate limits.** The per-IP limit in `chat.js` is best effort. Watch your Google AI Studio usage, since free-tier quotas apply.

## Limits to know about

- Agitur only knows what's in `context.js`. It has no live calendar, email, or school system access.
- It can make mistakes. Students should check anything important with staff.
- Voice input works in Chrome, Edge, and Safari. Spoken replies use whatever voices the browser has, so quality varies.
