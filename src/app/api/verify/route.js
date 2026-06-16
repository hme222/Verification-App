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
  "class_type": "the class or type designation (e.g. Kentucky Straight Bourbon Whiskey, India Pale Ale, etc.)",
  "alcohol_content": "the alcohol content exactly as printed (e.g. 45% ALC./VOL.)",
  "alcohol_content_numeric": 45.0,
  "net_contents": "net contents exactly as printed (e.g. 750 mL)",
  "government_warning": {
    "present": true,
    "verbatim_text": "the exact government warning text as printed on the label, word for word",
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
- For government_warning.verbatim_text, transcribe EXACTLY what is printed, preserving capitalization.
- heading_all_caps: true ONLY if "GOVERNMENT WARNING" appears in ALL CAPITAL LETTERS.
- heading_appears_bold: true if the heading text appears bolder/heavier than the body text. Note: bold detection from images is approximate.
- If a field is not visible or readable, use null for strings and false for booleans.
- alcohol_content_numeric should be just the number (e.g. 45 or 12.5).
- For image_quality.confidence use "high", "medium", or "low".
- image_quality.readable should be false if the image is too blurry, dark, or obstructed to read.
- For image_quality.issues list any problems like ["glare", "angled", "low resolution", "partial label", "blurry", "too dark", "obstructed"].
- Return ONLY the JSON object, no other text.`;

function buildComplianceReport(brandName, classType, abv, netContents, ocr) {
  // Image quality gate — if the image is unreadable, fail early with a clear message
  const imageQuality = ocr.image_quality || {
    readable: false,
    issues: ["Image quality data not available"],
    confidence: "low",
  };

  if (!imageQuality.readable) {
    return {
      success: true,
      imageQuality,
      unreadable: true,
      verificationMatrix: {
        brandName: { status: "fail", expected: brandName, observed: "Unreadable" },
        classType: { status: "fail", expected: classType, observed: "Unreadable" },
        abv: { status: "fail", expected: abv, observed: "Unreadable" },
        netContents: { status: "fail", expected: netContents, observed: "Unreadable" },
        governmentWarning: {
          status: "fail",
          notes: `Image could not be read. Issues: ${(imageQuality.issues || []).join(", ") || "unknown"}. Please upload a clearer photo.`,
          observedText: null,
          headingAllCaps: false,
          headingBold: false,
        },
      },
    };
  }

  // Brand name: normalized comparison
  const brandMatch =
    normalize(brandName) === normalize(ocr.brand_name) ? "pass" : "fail";

  // Class/type
  const classMatch =
    normalize(classType) === normalize(ocr.class_type) ? "pass" : "fail";

  // ABV: numeric comparison
  const userAbv = extractNumeric(abv);
  const labelAbv =
    ocr.alcohol_content_numeric ?? extractNumeric(ocr.alcohol_content);
  const abvMatch =
    userAbv !== null && labelAbv !== null && userAbv === labelAbv
      ? "pass"
      : "fail";

  // Net contents: normalized comparison
  const netMatch =
    normalizeNetContents(netContents) ===
    normalizeNetContents(ocr.net_contents)
      ? "pass"
      : "fail";

  // Government warning: multi-part check
  let warningStatus = "fail";
  const warningIssues = [];

  if (!ocr.government_warning?.present) {
    warningIssues.push(
      "No government health warning was detected on the label."
    );
  } else {
    const ocrWarningNorm = normalize(ocr.government_warning.verbatim_text);
    const requiredNorm = normalize(REQUIRED_WARNING);
    if (ocrWarningNorm !== requiredNorm) {
      warningIssues.push(
        "Warning text does not match the required wording. Must be an exact match per 27 CFR Part 16."
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
    success: true,
    imageQuality,
    verificationMatrix: {
      brandName: {
        status: brandMatch,
        expected: brandName,
        observed: ocr.brand_name || "Not detected",
      },
      classType: {
        status: classMatch,
        expected: classType,
        observed: ocr.class_type || "Not detected",
      },
      abv: {
        status: abvMatch,
        expected: abv,
        observed: ocr.alcohol_content || "Not detected",
      },
      netContents: {
        status: netMatch,
        expected: netContents,
        observed: ocr.net_contents || "Not detected",
      },
      governmentWarning: {
        status: warningStatus,
        notes:
          warningIssues.length > 0
            ? warningIssues.join(" ")
            : "Government warning meets all regulatory requirements.",
        observedText: ocr.government_warning?.verbatim_text || null,
        headingAllCaps: ocr.government_warning?.heading_all_caps ?? false,
        headingBold: ocr.government_warning?.heading_appears_bold ?? false,
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

// Single label verification
export async function POST(request) {
  try {
    const formData = await request.formData();
    const brandName = formData.get("brandName");
    const classType = formData.get("classType");
    const abv = formData.get("abv");
    const netContents = formData.get("netContents");
    const imageFile = formData.get("image");

    if (!imageFile) {
      return NextResponse.json(
        {
          error:
            "No label image was uploaded. Please attach an image and try again.",
        },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "The server is missing its OPENAI_API_KEY configuration. Please contact the administrator.",
        },
        { status: 500 }
      );
    }

    let ocr;
    try {
      ocr = await analyzeImage(imageFile);
    } catch (aiError) {
      console.error("OpenAI Vision error:", aiError);
      const message =
        aiError?.status === 401
          ? "Invalid OpenAI API key. Please check the server configuration."
          : aiError?.status === 429
            ? "OpenAI rate limit reached. Please wait a moment and try again."
            : "The AI vision service could not process this image. The image may be too large, corrupt, or the service is temporarily unavailable.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    if (!ocr || (!ocr.brand_name && !ocr.government_warning)) {
      return NextResponse.json(
        {
          error:
            "The label image could not be read. Please upload a clearer, well-lit photo of the full label.",
        },
        { status: 422 }
      );
    }

    const report = buildComplianceReport(
      brandName,
      classType,
      abv,
      netContents,
      ocr
    );
    return NextResponse.json(report);
  } catch (error) {
    console.error("Verification pipeline error:", error);
    return NextResponse.json(
      {
        error:
          "An unexpected error occurred during verification. Please try again.",
      },
      { status: 500 }
    );
  }
}
