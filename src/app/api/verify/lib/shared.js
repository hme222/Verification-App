import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const REQUIRED_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export function normalize(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[''`\u2018\u2019]/g, "'")
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Minimal whitespace normalization for the government warning comparison.
 * Preserves capitalization, punctuation, and wording — only collapses
 * whitespace runs and trims, so the comparison is still word-for-word strict.
 */
export function normalizeWarningText(str) {
  if (!str) return "";
  return str.replace(/\s+/g, " ").trim();
}

export function extractNumeric(str) {
  if (!str) return null;
  const match = str.toString().match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

export function normalizeNetContents(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/milliliters|millilitres/, "ml")
    .replace(/liters|litres/, "l")
    .replace(/fluidounces|floz/, "floz")
    .trim();
}

export const OCR_PROMPT = `You are an expert OCR system analyzing an alcohol beverage label image.

Extract the following information from the label and return ONLY valid JSON with this exact structure:

{
  "brand_name": "the brand name as printed on the label",
  "class_type": "the class or type designation (e.g. Kentucky Straight Bourbon Whiskey, India Pale Ale, etc.)",
  "alcohol_content": "the alcohol content exactly as printed (e.g. 45% ALC./VOL.)",
  "alcohol_content_numeric": 45.0,
  "net_contents": "net contents exactly as printed (e.g. 750 mL)",
  "producer": "the bottler, producer, or importer name and address as printed on the label",
  "country_of_origin": "the country of origin if stated on the label, or null if not present",
  "government_warning": {
    "present": true,
    "verbatim_text": "the EXACT government warning text as printed on the label — word for word, preserving all capitalization and punctuation",
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
- For government_warning.verbatim_text, transcribe EXACTLY what is printed — preserve every word, capital letter, colon, parenthesis, and period. Do not paraphrase or correct.
- heading_all_caps: true ONLY if "GOVERNMENT WARNING" appears in ALL CAPITAL LETTERS on the label.
- heading_appears_bold: true if the heading text appears bolder/heavier than the body text. Note: bold detection from images is approximate.
- For producer, include the full name and address as printed. If multiple (bottler, importer), include all.
- For country_of_origin, transcribe exactly if present (e.g., "Product of Scotland"). Use null if not stated.
- If a field is not visible or readable, use null for strings and false for booleans.
- alcohol_content_numeric should be just the number (e.g. 45 or 12.5).
- For image_quality.confidence use "high", "medium", or "low".
- image_quality.readable should be false if the image is too blurry, dark, or obstructed to read.
- For image_quality.issues list any problems like ["glare", "angled", "low resolution", "partial label", "blurry", "too dark", "obstructed"].
- Return ONLY the JSON object, no other text.`;

export async function analyzeImage(imageFile) {
  const arrayBuffer = await imageFile.arrayBuffer();
  const base64Image = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = imageFile.type || "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    max_tokens: 2000,
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

export function verifyFields(brandName, classType, abv, netContents, ocr) {
  const brandMatch =
    normalize(brandName) === normalize(ocr.brand_name) ? "pass" : "fail";

  const classMatch =
    normalize(classType) === normalize(ocr.class_type) ? "pass" : "fail";

  const userAbv = extractNumeric(abv);
  const labelAbv =
    ocr.alcohol_content_numeric ?? extractNumeric(ocr.alcohol_content);
  const abvMatch =
    userAbv !== null && labelAbv !== null && userAbv === labelAbv
      ? "pass"
      : "fail";

  const netMatch =
    normalizeNetContents(netContents) ===
    normalizeNetContents(ocr.net_contents)
      ? "pass"
      : "fail";

  let warningStatus = "fail";
  const warningIssues = [];

  if (!ocr.government_warning?.present) {
    warningIssues.push(
      "No government health warning was detected on the label."
    );
  } else {
    // Strict wording check: only collapse whitespace, preserve everything else
    const ocrText = normalizeWarningText(ocr.government_warning.verbatim_text);
    const requiredText = normalizeWarningText(REQUIRED_WARNING);

    if (ocrText !== requiredText) {
      warningIssues.push(
        "Warning text does not match the required wording word-for-word per 27 CFR Part 16."
      );
    }

    if (!ocr.government_warning.heading_all_caps) {
      warningIssues.push(
        '"GOVERNMENT WARNING:" must appear in ALL CAPITAL LETTERS.'
      );
    }
    if (!ocr.government_warning.heading_appears_bold) {
      warningIssues.push(
        '"GOVERNMENT WARNING:" heading does not appear bold. Note: bold detection from images is approximate.'
      );
    }

    if (warningIssues.length === 0) {
      warningStatus = "pass";
    }
  }

  return {
    brandMatch,
    classMatch,
    abvMatch,
    netMatch,
    warningStatus,
    warningIssues,
  };
}

const DEFAULT_IMAGE_QUALITY = {
  readable: false,
  issues: ["Image quality data not available"],
  confidence: "low",
};

export function getImageQuality(ocr) {
  return ocr.image_quality || DEFAULT_IMAGE_QUALITY;
}
