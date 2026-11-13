# Jem AI V2.0 — Your AI Workspace

A responsive, installable PWA built with HTML, CSS and vanilla JavaScript, with a Vercel serverless backend and the OpenAI Responses API.

## What's new in V2.0
- Redesigned responsive interface with dark and light themes
- General-purpose AI assistant (no longer restricted to Islamic topics)
- Focus modes: Writing, Learning, Coding, Translation, Islamic Learning and Creative Studio
- Context-aware mode instructions sent securely by the backend
- Updated OpenAI Responses API integration
- Uses `gpt-6-luna` by default; override with `OPENAI_MODEL`
- API key remains server-side
- Service worker cache version updated

## Deploy on Vercel
1. Upload the project files to the root of a GitHub repository. Keep the `api` folder.
2. Import the repository into Vercel. Framework preset: **Other**. Build command and output directory can remain empty.
3. In Vercel → Project → Settings → Environment Variables, add:
   - `OPENAI_API_KEY` = your OpenAI API key
   - Optional: `OPENAI_MODEL` = another model available to your API account (default: `gpt-6-luna`)
4. Redeploy the project after adding environment variables.

## Important limitations
This version provides AI text chat and guided modes. Image generation, voice conversations, file uploads/analysis, web search, user accounts, cloud-synced chat history, payments and subscriptions are not implemented yet. These require additional API integrations and product setup. Do not advertise them as working until implemented and tested.

## Security
- Never put your API key in `app.js`, `index.html`, or any public file.
- Keep API secrets in Vercel Environment Variables.
- AI can make mistakes. Verify important decisions and religious rulings with trusted sources.
