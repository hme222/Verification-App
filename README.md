# TTB Label Verification Tool

An AI-powered web application that verifies alcohol beverage labels against application data, automating routine compliance checks for the Alcohol and Tobacco Tax and Trade Bureau (TTB).

**Deployed application:** https://labelverification.vercel.app

## Quick Evaluation Path

1. **Open the deployed app** at the URL above
2. **Single label — passing:** Upload `samples/sample-pass.png` with:
   - Brand: `Mountain Creek` | Class: `American Single Malt Whiskey` | ABV: `45` | Net Contents: `750 mL`
   - Expected result: **PASS** — all fields match
3. **Single label — ABV mismatch:** Upload `samples/sample-wrong-abv.png` with the same data but enter ABV as `40`
   - Expected result: **FAIL** — ABV mismatch with review rationale
4. **Single label — bad warning:** Upload `samples/sample-bad-warning.png` with the same data
   - Expected result: **FAIL** — government warning heading is title case, not ALL CAPS
5. **Batch upload:** Switch to the Batch tab, upload `samples/sample-batch.csv` + all three PNG files
   - Expected result: 1 pass, 2 fails in the summary dashboard

Sample files are in the `/samples` directory. You can regenerate them with `node samples/generate-labels.js`.

## What It Does

A compliance agent uploads a label image along with the expected application data. The app uses OpenAI's GPT-4o vision model to read the label, then compares what it finds against the application data.

### Checks Performed

| Check | Method |
|-------|--------|
| Brand name | Normalized match (case-insensitive, punctuation-tolerant) |
| Class/type designation | Normalized match |
| Alcohol content (ABV) | Numeric comparison |
| Net contents | Normalized match (e.g., "750 mL" = "750mL") |
| Government warning text | Strict word-for-word match per 27 CFR Part 16 |
| Warning heading caps | "GOVERNMENT WARNING:" must be ALL CAPS |
| Warning heading bold | Visual weight check (approximate — see limitations) |
| Image quality | Confidence rating; low/medium triggers "Needs Review" |
| Producer / Bottler | Extracted and displayed (informational) |
| Country of origin | Extracted and displayed (informational, if present) |

### Three-State Verdicts

- **PASS** — all fields match and image confidence is high
- **FAIL** — one or more fields do not match
- **NEEDS REVIEW** — image confidence is low/medium or the image could not be fully read; requires manual agent verification

Each field mismatch includes a **review rationale** explaining what the app saw, why it failed, and a suggested next action for the agent.

### Two Modes

- **Single Label** — enter application data + upload one label image, get a detailed pass/fail report with rationale
- **Batch Upload** — upload a CSV of application data + multiple label images matched by filename; results displayed in a summary dashboard with expandable detail rows

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

```bash
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Batch CSV Format

```csv
filename,brand_name,class_type,abv,net_contents
label_001.jpg,Stone's Throw,Kentucky Straight Bourbon Whiskey,45,750 mL
label_002.jpg,Coastal IPA,India Pale Ale,6.5,12 FL OZ
```

The `filename` column must match the uploaded image filenames exactly. The parser handles quoted fields (e.g., `"Stone's Throw, Inc."`) but does not support multiline fields — a full CSV library would be appropriate for production.

## Approach and Tools

- **Next.js 16** (App Router) — React framework with server-side API routes
- **OpenAI GPT-4o** — Vision model for label OCR and structured text extraction
- **Tailwind CSS 4** — Utility-first styling
- **System fonts** — No external font requests (compatible with government network firewalls)

### Architecture

One page with two modes (single/batch), two API routes, one shared verification module. Uploaded images are converted to base64 and sent to GPT-4o with a structured prompt requesting JSON output. The server runs deterministic comparison logic and returns a compliance report. Batch mode processes labels in parallel (3 at a time) to balance speed with API rate limits.

### UX Approach

The interface is designed for government compliance agents (ages 50+, varying tech comfort):
- High contrast, large text, clear labels
- Icons always paired with text labels — no icon-only controls
- Skip-navigation link for keyboard users
- `aria-live` region announces results to screen readers
- Proper ARIA tab semantics
- Progress feedback during AI processing
- Error states shown inline (no alert popups)
- Review rationale for each failed field with suggested agent action

### Design Philosophy

I prioritized a reliable agent-assist workflow over full automation, because TTB review still requires human judgment for nuanced cases. The "Needs Review" state acknowledges that AI confidence varies — rather than forcing a binary pass/fail, the tool flags uncertain results for manual verification, which matches how compliance agents actually work.

## Assumptions

- Single-label and small-batch verification are the primary use cases for this prototype
- The OpenAI API is accessible from the deployment environment
- GPT-4o's vision capabilities are sufficient for reading standard printed label text
- Bold detection is approximate — the model infers boldness from visual weight
- Labels are expected to be in English
- Producer/bottler and country of origin are displayed as extracted information rather than verified against application data, since the form focuses on the primary verification fields

## Known Limitations and Tradeoffs

- **Batch scale** — tested with small batches (5–10 labels). For 200–300+ labels, a queue-based architecture with progress streaming would be more appropriate. The current implementation processes synchronously.
- **Bold detection is approximate** — there is no reliable way to detect CSS-style "bold" from a photograph; the AI makes its best visual judgment and this is documented in the results.
- **Government warning comparison** — uses strict word-for-word matching with only whitespace normalization. OCR misreads of individual characters (e.g., `l` vs `1`) will cause a failure, which is the correct behavior since the warning must be exact.
- **CSV parser** — handles quoted fields but not escaped quotes or multiline fields. A dedicated CSV library (e.g., `papaparse`) would be more robust for production use.
- **Image size limits** — very large images may hit OpenAI's payload limits; standard phone photos work fine.
- **No persistent storage** — results are not saved between sessions.
- **Speed** — single labels return in ~3–8 seconds. Batch processing adds ~3–8 seconds per label (3 processed concurrently).
- **Producer and country of origin** — extracted and displayed but not verified against application data (form fields could be added in a future iteration).
- **No FedRAMP compliance** — this is a prototype; production deployment on Azure government infrastructure would require additional certification.
- **Image quality gating** — if the AI determines confidence is low, the result is flagged as "Needs Review" rather than making unreliable pass/fail calls.
