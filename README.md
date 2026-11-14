# Jem AI V2.4 — Groq Free API Edition

This version uses Groq's OpenAI-compatible Chat Completions API as its AI backend. The existing Jem AI interface, modes, styling, icons, and PWA assets are preserved.

## Important about free usage
Groq offers a free API tier subject to model-specific rate limits and usage policies. It is not unlimited and availability/limits can change. No paid OpenAI API is used by this project. If the free-tier limit is reached, Jem AI displays a message asking the user to wait.

Default model: `openai/gpt-oss-20b`

## Deploy to Vercel

1. Extract this ZIP file.
2. Upload the **contents** of the `Jem-AI-V2` folder to the root of your GitHub repository (keep `api/chat.js` in the `api` folder).
3. Import/redeploy that repository in Vercel. Framework Preset: **Other**.
4. Create a free account at https://console.groq.com/ and create an API key.
5. In Vercel open **Project → Settings → Environment Variables**.
6. Add:
   - Name: `GROQ_API_KEY`
   - Value: paste your Groq API key
   - Environments: Production, Preview, Development (select the ones you use)
7. Save, then go to **Deployments** and redeploy the latest deployment.
8. Open the deployed Jem AI website and send a test message.

Optional:
- `GROQ_MODEL` can override the default model. Leave it unset to use `openai/gpt-oss-20b`.

## Security
- Never put `GROQ_API_KEY` in `index.html`, `app.js`, CSS, or any public file.
- Keep the key only in Vercel Environment Variables.
- If a key is accidentally published, revoke it in Groq Console and create a new one.

## Local development
Install Vercel CLI and run `npm run dev` from this folder. Put `GROQ_API_KEY=your_key` in a local `.env.local` file. Do not commit `.env.local` to GitHub.

## Troubleshooting
- `GROQ_API_KEY is missing`: check the Environment Variable name and redeploy.
- `invalid API key`: create/check the key in Groq Console.
- `free Groq usage limit has been reached`: wait for the limit reset; the free tier is rate-limited.
- `model unavailable`: remove `GROQ_MODEL` or choose a currently supported model in Groq's model list.
