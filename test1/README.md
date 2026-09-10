# The Most Dangerous Games Locator

A Vercel-ready Next.js web app that turns the calibrated book-search workflow from the ChatGPT conversation into a standalone fuzzy passage locator.

## What it does

- Accepts inexact descriptions, quotes, scene questions, and location questions.
- Searches a pre-extracted local index of the uploaded PDF.
- Optionally uses the OpenAI Responses API to expand fuzzy queries and rerank/answer from candidate excerpts.
- Maps the selected source location to the **physical page in your copy** using the hand-verified calibration anchors from the conversation.
- Exact text/page anchors override interpolation.
- Shows PDF page and chapter for debugging.

The app works in a basic local-search mode without an API key. For the closest behavior to the ChatGPT agent, set `OPENAI_API_KEY`.

## Deploy to Vercel

1. Unzip this project and put it in a GitHub repository (or import the folder with the Vercel CLI).
2. In Vercel, create a new project from the repo.
3. Add environment variable `OPENAI_API_KEY`.
4. Optional: set `OPENAI_MODEL`. The included default is `gpt-5.6-sol` for accuracy.
5. Deploy. Vercel detects Next.js automatically.

Local development:

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Important accuracy note

The PDF-to-physical-page mapping is edition-specific. The calibration data in `data/calibration.json` is built from the page/line anchors and special-layout corrections supplied in the conversation, including chapter-start resets and known image/blank pages. A result marked `medium` or `low` is interpolated rather than directly anchored.

To improve the locator later, add more verified anchors to the calibration source and regenerate `data/calibration.json`.
