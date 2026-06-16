# TTB Label Verification Tool

An AI-powered web application that verifies alcohol beverage labels against application data, automating routine compliance checks for the Alcohol and Tobacco Tax and Trade Bureau (TTB).

**Deployed application:** https://labelverification.vercel.app

## What It Does

A compliance agent uploads a label image along with the expected application data (brand name, class/type, ABV, net contents). The app uses OpenAI's GPT-4o vision model to read the label, then compares what it finds against the application data.

### Checks Performed

| Check | Method |
|-------|--------|
| Brand name | Normalized match (case-insensitive, punctuation-tolerant) |
| Class/type designation | Normalized match |
| Alcohol content (ABV) | Numeric comparison |
| Net contents | Normalized match (e.g., "750 mL" = "750mL") |
| Government warning text | Exact wording match per 27 CFR Part 16 |
| Warning heading caps | "GOVERNMENT WARNING:" must be ALL CAPS |
| Warning heading bold | Visual weight check (approximate — see limitations) |
| Image quality | Confidence rating; unreadable images fail with guidance |

### Two Modes

- **Single Label** — enter application data + upload one label image, get a detailed pass/fail report.
- **Batch Upload** — upload a CSV of application data + multiple label images, matched by filename. Results displayed in a summary table with expandable detail rows.

## Installation

```bash
git clone https://github.com/hme222/Verification-App.git
cd Verification-App
npm install
```

## Required Environment Variables

Create a `.env.local` file in the project root:

```
OPENAI_API_KEY=your-openai-api-key-here
```

You need an OpenAI API key with access to the `gpt-4o` model.

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other commands:

```bash
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Batch CSV Format

The batch upload expects a CSV with these columns (headers are flexible — the parser matches on keywords):

```csv
filename,brand_name,class_type,abv,net_contents
label_001.jpg,Stone's Throw,Kentucky Straight Bourbon Whiskey,45,750 mL
label_002.jpg,Coastal IPA,India Pale Ale,6.5,12 FL OZ
```

The `filename` column must match the uploaded image filenames exactly.

## Approach and Tools

- **Next.js 16** (App Router) — React framework with server-side API routes
- **OpenAI GPT-4o** — Vision model for label OCR and structured text extraction
- **Tailwind CSS 4** — Utility-first styling
- **System fonts** — No external font requests (compatible with government network firewalls)

### Architecture

The design is intentionally simple: one page with two modes (single/batch), two API routes. Uploaded images are converted to base64 and sent to GPT-4o with a structured prompt requesting JSON output. The server runs deterministic comparison logic and returns a compliance report. Batch mode processes labels in parallel (3 at a time) to balance speed with API rate limits.

### UX Approach

The interface is designed for government compliance agents (ages 50+, varying tech comfort):
- High contrast, large text, clear labels
- No ambiguous icons — text labels on everything
- Skip-navigation link for keyboard users
- `aria-live` region announces results to screen readers
- Progress feedback during AI processing
- Error states shown inline (no alert popups)

## Assumptions

- Single-label and small-batch verification are the primary use cases for this prototype
- The OpenAI API is accessible from the deployment environment
- GPT-4o's vision capabilities are sufficient for reading standard printed label text
- Bold detection is approximate — the model infers boldness from visual weight
- Labels are expected to be in English

## Known Limitations and Tradeoffs

- **Batch scale** — tested with small batches (5–10 labels). For 200–300+ labels, a queue-based architecture with progress streaming would be more appropriate. The current implementation processes synchronously.
- **Bold detection is approximate** — there is no reliable way to detect CSS-style "bold" from a photograph; the AI makes its best visual judgment and this is documented in the results.
- **Image size limits** — very large images may hit OpenAI's payload limits; standard phone photos work fine.
- **No persistent storage** — results are not saved between sessions.
- **Speed** — single labels return in ~3–8 seconds. Batch processing adds ~3–8 seconds per label (3 processed concurrently).
- **Government warning match is strict** — minor OCR misreads are normalized (smart quotes, extra whitespace), but significant wording differences will fail as required.
- **No FedRAMP compliance** — this is a prototype; production deployment on Azure government infrastructure would require additional certification.
- **Image quality gating** — if the AI determines the image is unreadable (blurry, dark, obstructed), all fields are marked as failed with a clear message to re-upload, rather than returning unreliable partial results.
