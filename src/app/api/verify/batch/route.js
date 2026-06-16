import { NextResponse } from "next/server";
import {
  analyzeImage,
  verifyFields,
  getImageQuality,
} from "../lib/shared.js";

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Support quoted fields so commas inside values don't break parsing
  function splitRow(line) {
    const cols = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cols.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  }

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
  const fnIdx = headers.findIndex(
    (h) => h === "filename" || h === "file" || h === "image"
  );
  const bnIdx = headers.findIndex((h) => h.includes("brand"));
  const ctIdx = headers.findIndex(
    (h) => h.includes("class") || h.includes("type")
  );
  const abvIdx = headers.findIndex(
    (h) => h.includes("abv") || h.includes("alcohol")
  );
  const ncIdx = headers.findIndex(
    (h) => h.includes("net") || h.includes("contents") || h.includes("volume")
  );

  if (fnIdx === -1 || bnIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = splitRow(line);
    return {
      filename: cols[fnIdx] || "",
      brandName: cols[bnIdx] || "",
      classType: ctIdx >= 0 ? cols[ctIdx] || "" : "",
      abv: abvIdx >= 0 ? cols[abvIdx] || "" : "",
      netContents: ncIdx >= 0 ? cols[ncIdx] || "" : "",
    };
  });
}

function buildResult(filename, appData, ocr) {
  const imageQuality = getImageQuality(ocr);

  if (!imageQuality.readable) {
    return {
      filename,
      status: "needs-review",
      imageQuality,
      unreadable: true,
      fields: {
        brandName: { status: "fail", expected: appData.brandName, observed: "Unreadable" },
        classType: { status: "fail", expected: appData.classType, observed: "Unreadable" },
        abv: { status: "fail", expected: appData.abv, observed: "Unreadable" },
        netContents: { status: "fail", expected: appData.netContents, observed: "Unreadable" },
        governmentWarning: {
          status: "fail",
          notes: `Unreadable image: ${(imageQuality.issues || []).join(", ")}`,
        },
      },
    };
  }

  const { brandMatch, classMatch, abvMatch, netMatch, warningStatus, warningIssues } =
    verifyFields(appData.brandName, appData.classType, appData.abv, appData.netContents, ocr);

  const allPass =
    brandMatch === "pass" &&
    classMatch === "pass" &&
    abvMatch === "pass" &&
    netMatch === "pass" &&
    warningStatus === "pass";

  const confidence = (imageQuality.confidence || "low").toLowerCase();
  const needsReview = confidence === "low" || confidence === "medium";
  const status = !allPass ? "fail" : needsReview ? "needs-review" : "pass";

  return {
    filename,
    status,
    imageQuality,
    fields: {
      brandName: {
        status: brandMatch,
        expected: appData.brandName,
        observed: ocr.brand_name || "Not detected",
      },
      classType: {
        status: classMatch,
        expected: appData.classType,
        observed: ocr.class_type || "Not detected",
      },
      abv: {
        status: abvMatch,
        expected: appData.abv,
        observed: ocr.alcohol_content || "Not detected",
      },
      netContents: {
        status: netMatch,
        expected: appData.netContents,
        observed: ocr.net_contents || "Not detected",
      },
      governmentWarning: {
        status: warningStatus,
        notes:
          warningIssues.length > 0
            ? warningIssues.join(" ")
            : "Meets all requirements.",
        observedText: ocr.government_warning?.verbatim_text || null,
      },
    },
    labelInfo: {
      producer: ocr.producer || "Not detected",
      countryOfOrigin: ocr.country_of_origin || "Not stated",
    },
  };
}

// Process up to CONCURRENCY labels at a time to balance speed with rate limits
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

    // Validate each image: must be an image type and under 10 MB
    for (const img of imageFiles) {
      if (typeof img.type === "string" && !img.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `File "${img.name}" is not an image. Please upload only JPEG, PNG, or WebP files.` },
          { status: 400 }
        );
      }
      if (img.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File "${img.name}" exceeds the 10 MB size limit.` },
          { status: 400 }
        );
      }
    }

    const csvText = await csvFile.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "CSV could not be parsed. Ensure it has headers including 'filename' and 'brand_name' at minimum.",
        },
        { status: 400 }
      );
    }

    const imageMap = new Map();
    for (const img of imageFiles) {
      imageMap.set(img.name, img);
    }

    const results = [];
    const unmatched = [];

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
            error:
              err?.status === 429
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
    const needsReview = results.filter((r) => r.status === "needs-review").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      summary: { total: results.length, passed, failed, needsReview, errors },
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
