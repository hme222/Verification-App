import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const REQUIRED_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

function normalize(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[''`\u2018\u2019]/g, "'")
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumeric(str) {
  if (!str) return null;
  const match = str.toString().match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function normalizeNetContents(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/milliliters|millilitres/, "ml")
    .replace(/liters|litres/, "l")
    .replace(/fluid\s*ounces|floz/, "floz")
    .trim();
}

const OCR_PROMPT = `You are an expert OCR system analyzing an alcohol beverage label image.

Extract the following information from the label and return ONLY valid JSON with this exact structure:

{
  "brand_name": "the brand name as printed on the label",
  "class_type": "the class or type designation",
  "alcohol_content": "the alcohol content exactly as printed",
  "alcohol_content_numeric": 45.0,
  "net_contents": "net contents exactly as printed",
  "government_warning": {
    "present": true,
    "verbatim_text": "exact government warning text word for word",
    "heading_all_caps": true,
    "heading_appears_bold": true
  },
  "image_quality": {
    "readable": true,
    "issues": [],
    "confidence": "high"
  }
}

Rules:
- Transcribe government_warning.verbatim_text EXACTLY as printed, preserving capitalization.
- heading_all_caps: true ONLY if "GOVERNMENT WARNING" is in ALL CAPS.
- heading_appears_bold: true if the heading looks bolder than body text (approximate).
- Use null for unreadable strings, false for unreadable booleans.
- alcohol_content_numeric: just the number.
- confidence: "high", "medium", or "low".
- image_quality.readable: false if image is too blurry/dark/obstructed.
- Return ONLY the JSON object.`;

function buildResult(filename, appData, ocr) {
  const imageQuality = ocr.image_quality || {
    readable: false,
    issues: ["Image quality data not available"],
    confidence: "low",
  };

  if (!imageQuality.readable) {
    return {
      filename,
      status: "fail",
      imageQuality,
      unreadable: true,
      fields: {
        brandName: { status: "fail", expected: appData.brandName, observed: "Unreadable" },
        classType: { status: "fail", expected: appData.classType, observed: "Unreadable" },
        abv: { status: "fail", expected: appData.abv, observed: "Unreadable" },
        netContents: { status: "fail", expected: appData.netContents, observed: "Unreadable" },
        governmentWarning: { status: "fail", notes: `Unreadable image: ${(imageQuality.issues || []).join(", ")}` },
      },
    };
  }

  const brandMatch = normalize(appData.brandName) === normalize(ocr.brand_name) ? "pass" : "fail";
  const classMatch = normalize(appData.classType) === normalize(ocr.class_type) ? "pass" : "fail";
  const userAbv = extractNumeric(appData.abv);
  const labelAbv = ocr.alcohol_content_numeric ?? extractNumeric(ocr.alcohol_content);
  const abvMatch = userAbv !== null && labelAbv !== null && userAbv === labelAbv ? "pass" : "fail";
  const netMatch = normalizeNetContents(appData.netContents) === normalizeNetContents(ocr.net_contents) ? "pass" : "fail";

  const warningIssues = [];
  if (!ocr.government_warning?.present) {
    warningIssues.push("No government warning detected.");
  } else {
    if (normalize(ocr.government_warning.verbatim_text) !== normalize(REQUIRED_WARNING)) {
      warningIssues.push("Warning text does not match required wording.");
    }
    if (!ocr.government_warning.heading_all_caps) {
      warningIssues.push("Heading not ALL CAPS.");
    }
    if (!ocr.government_warning.heading_appears_bold) {
      warningIssues.push("Heading does not appear bold (approximate).");
    }
  }
  const warningStatus = warningIssues.length === 0 ? "pass" : "fail";

  const allPass = brandMatch === "pass" && classMatch === "pass" && abvMatch === "pass" && netMatch === "pass" && warningStatus === "pass";

  return {
    filename,
    status: allPass ? "pass" : "fail",
    imageQuality,
    fields: {
      brandName: { status: brandMatch, expected: appData.brandName, observed: ocr.brand_name || "Not detected" },
      classType: { status: classMatch, expected: appData.classType, observed: ocr.class_type || "Not detected" },
      abv: { status: abvMatch, expected: appData.abv, observed: ocr.alcohol_content || "Not detected" },
      netContents: { status: netMatch, expected: appData.netContents, observed: ocr.net_contents || "Not detected" },
      governmentWarning: {
        status: warningStatus,
        notes: warningIssues.length > 0 ? warningIssues.join(" ") : "Meets all requirements.",
        observedText: ocr.government_warning?.verbatim_text || null,
      },
    },
  };
}

async function analyzeImage(imageFile) {
  const arrayBuffer = await imageFile.arrayBuffer();
  const base64Image = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = imageFile.type || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: OCR_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const fnIdx = headers.findIndex((h) => h === "filename" || h === "file" || h === "image");
  const bnIdx = headers.findIndex((h) => h.includes("brand"));
  const ctIdx = headers.findIndex((h) => h.includes("class") || h.includes("type"));
  const abvIdx = headers.findIndex((h) => h.includes("abv") || h.includes("alcohol"));
  const ncIdx = headers.findIndex((h) => h.includes("net") || h.includes("contents") || h.includes("volume"));

  if (fnIdx === -1 || bnIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      filename: cols[fnIdx] || "",
      brandName: cols[bnIdx] || "",
      classType: ctIdx >= 0 ? cols[ctIdx] || "" : "",
      abv: abvIdx >= 0 ? cols[abvIdx] || "" : "",
      netContents: ncIdx >= 0 ? cols[ncIdx] || "" : "",
    };
  });
}

// Process up to CONCURRENCY labels at a time to stay within rate limits
const CONCURRENCY = 3;

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Server is missing OPENAI_API_KEY configuration." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const csvFile = formData.get("csv");
    const imageFiles = formData.getAll("images");

    if (!csvFile) {
      return NextResponse.json(
        { error: "No CSV file uploaded. Please provide application data as a CSV." },
        { status: 400 }
      );
    }

    if (!imageFiles || imageFiles.length === 0) {
      return NextResponse.json(
        { error: "No label images uploaded." },
        { status: 400 }
      );
    }

    const csvText = await csvFile.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "CSV could not be parsed. Ensure it has headers: filename, brand_name, class_type, abv, net_contents" },
        { status: 400 }
      );
    }

    // Build a map of filename -> image file
    const imageMap = new Map();
    for (const img of imageFiles) {
      imageMap.set(img.name, img);
    }

    const results = [];
    const unmatched = [];

    // Process in batches of CONCURRENCY
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      const promises = batch.map(async (row) => {
        const imgFile = imageMap.get(row.filename);
        if (!imgFile) {
          unmatched.push(row.filename);
          return {
            filename: row.filename,
            status: "error",
            error: `No matching image file found for "${row.filename}".`,
          };
        }

        try {
          const ocr = await analyzeImage(imgFile);
          return buildResult(row.filename, row, ocr);
        } catch (err) {
          console.error(`Error processing ${row.filename}:`, err);
          return {
            filename: row.filename,
            status: "error",
            error: err?.status === 429
              ? "Rate limit reached. Try fewer images at once."
              : "AI vision service failed for this image.",
          };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        passed,
        failed,
        errors,
      },
      results,
      unmatchedFiles: unmatched,
    });
  } catch (error) {
    console.error("Batch verification error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during batch verification." },
      { status: 500 }
    );
  }
}
