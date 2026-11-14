# Jem AI V2.2 — Google Gemini Edition

A responsive, installable PWA built with HTML, CSS and vanilla JavaScript, with a Vercel serverless backend powered by the Google Gemini API.

## V2.2 updates
- Replaced the previous OpenAI backend with Google Gemini API.
- Uses `gemini-3.8-flash` by default, with `gemini-3.7-flash` as a fallback.
- Added safer API response parsing and clearer deployment errors in the chat UI.
- Keeps the Gemini API key on the server; it is never placed in browser JavaScript.
- Preserves the existing Jem AI interface, themes, seven assistant modes, app icons and PWA setup.
- Updated service-worker cache version to prevent old frontend files from being served.

## Deploy on Vercel
1. Extract this ZIP and upload the contents of the `Jem-AI-V2` folder to the root of a GitHub repository. Keep the `api` folder.
2. Import the repository into Vercel. Framework preset: **Other**. Build command and output directory can remain empty.
3. In Vercel → Project → Settings → Environment Variables, add:
   - `GEMINI_API_KEY` = your Google Gemini API key from Google AI Studio.
   - Optional: `GEMINI_MODEL` = a Gemini model ID available to your API key. Default: `gemini-3.8-flash`.
4. Redeploy the project after adding or changing environment variables.
5. Open the deployed site and test the AI Assistant.

## Important
- Do not add your API key to `app.js`, `index.html`, or any public file.
- Do not use the old `OPENAI_API_KEY` or `OPENAI_MODEL` variables for this Gemini version.
- The backend tries `gemini-3.8-flash` first and then `gemini-3.7-flash` if the first model is unavailable.
- This version provides AI text chat and guided modes. Image generation, voice conversations, file uploads/analysis, web search, user accounts, cloud-synced chat history, payments and subscriptions are not implemented.
- AI can make mistakes. Verify important decisions and religious rulings with trusted sources.

## Local development
Install the Vercel CLI, then run:

```bash
npm run dev
```

Set `GEMINI_API_KEY` in your local Vercel environment or `.env.local` before testing the API.
