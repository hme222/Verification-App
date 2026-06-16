import { NextResponse } from "next/server";
import {
  analyzeImage,
  verifyFields,
  getImageQuality,
} from "./lib/shared.js";

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
        { error: "No label image was uploaded. Please attach an image and try again." },
        { status: 400 }
      );
    }

    if (typeof imageFile.type === "string" && !imageFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "The uploaded file is not an image. Please upload a JPEG, PNG, or WebP file." },
        { status: 400 }
      );
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "The image is larger than 10 MB. Please upload a smaller file." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "The server is missing its OPENAI_API_KEY configuration. Please contact the administrator." },
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
        { error: "The label image could not be read. Please upload a clearer, well-lit photo of the full label." },
        { status: 422 }
      );
    }

    const imageQuality = getImageQuality(ocr);

    // If image is unreadable, fail all fields with a clear explanation
    if (!imageQuality.readable) {
      return NextResponse.json({
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
        labelInfo: {
          producer: "Unreadable",
          countryOfOrigin: "Unreadable",
        },
      });
    }

    const { brandMatch, classMatch, abvMatch, netMatch, warningStatus, warningIssues } =
      verifyFields(brandName, classType, abv, netContents, ocr);

    return NextResponse.json({
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
      labelInfo: {
        producer: ocr.producer || "Not detected",
        countryOfOrigin: ocr.country_of_origin || "Not stated",
      },
    });
  } catch (error) {
    console.error("Verification pipeline error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during verification. Please try again." },
      { status: 500 }
    );
  }
}
