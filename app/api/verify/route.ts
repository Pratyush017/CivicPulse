import { NextRequest, NextResponse } from "next/server";
import { Type } from "@google/genai";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getGeminiClient, withGeminiRetry, parseGeminiError } from "@/lib/gemini";

// ---------------------------------------------------------------------------
// 1. Zod schema — Dual-Factor AI verification output
// ---------------------------------------------------------------------------
const VerificationSchema = z.object({
  is_same_location: z
    .boolean()
    .describe(
      "Whether Image A (original report) and Image B (verification photo) are taken at the exact same physical location."
    ),
  is_resolved: z
    .boolean()
    .describe(
      "Whether the infrastructure issue shown in Image A appears to be visibly resolved in Image B."
    ),
  reasoning: z
    .string()
    .describe(
      "A detailed forensic explanation of the location comparison and repair analysis, citing specific visual evidence."
    ),
});

type VerificationResult = z.infer<typeof VerificationSchema>;

// ---------------------------------------------------------------------------
// 2. Helper — Gemini responseSchema for dual-factor verification
// ---------------------------------------------------------------------------
function verificationGeminiSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      is_same_location: {
        type: Type.BOOLEAN,
        description:
          "Whether Image A (original report) and Image B (verification photo) are taken at the exact same physical location.",
      },
      is_resolved: {
        type: Type.BOOLEAN,
        description:
          "Whether the infrastructure issue shown in Image A appears to be visibly resolved in Image B.",
      },
      reasoning: {
        type: Type.STRING,
        description:
          "A detailed forensic explanation of the location comparison and repair analysis, citing specific visual evidence.",
      },
    },
    required: ["is_same_location", "is_resolved", "reasoning"],
  };
}

// ---------------------------------------------------------------------------
// 3. Haversine formula — distance in meters between two GPS points
// ---------------------------------------------------------------------------
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// 4. POST handler — Dual-Factor AI Verification
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- Parse multipart form data ----
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const reportId = formData.get("report_id") as string | null;
    const userLatStr = formData.get("user_lat") as string | null;
    const userLngStr = formData.get("user_lng") as string | null;

    if (!imageFile || !reportId) {
      return NextResponse.json(
        { error: "Missing required fields: image, report_id" },
        { status: 400 }
      );
    }

    if (!userLatStr || !userLngStr) {
      return NextResponse.json(
        {
          error:
            "GPS coordinates required. Please enable location services to verify a fix.",
        },
        { status: 400 }
      );
    }

    const userLat = parseFloat(userLatStr);
    const userLng = parseFloat(userLngStr);

    if (isNaN(userLat) || isNaN(userLng)) {
      return NextResponse.json(
        { error: "Invalid GPS coordinates" },
        { status: 400 }
      );
    }

    // ---- Fetch the original report ----
    const { data: report, error: fetchError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchError || !report) {
      console.error("Failed to fetch report:", fetchError);
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // ---- GPS proximity check (Haversine) ----
    const distanceMeters = haversineDistance(
      report.latitude,
      report.longitude,
      userLat,
      userLng
    );

    if (distanceMeters > 50) {
      return NextResponse.json(
        {
          error:
            "Verification failed: You must be physically present at the location to verify this repair.",
          distance: Math.round(distanceMeters),
        },
        { status: 403 }
      );
    }

    // ---- Read the uploaded verification image ----
    const arrayBuffer = await imageFile.arrayBuffer();
    const verifyBuffer = Buffer.from(arrayBuffer);
    const verifyMimeType = imageFile.type || "image/jpeg";

    // ---- Fetch the original report image for comparison ----
    let originalImageBase64: string | null = null;
    let originalMimeType = "image/jpeg";

    if (report.image_url) {
      try {
        const imgResponse = await fetch(report.image_url);
        if (imgResponse.ok) {
          const imgArrayBuffer = await imgResponse.arrayBuffer();
          originalImageBase64 = Buffer.from(imgArrayBuffer).toString("base64");
          originalMimeType =
            imgResponse.headers.get("content-type") || "image/jpeg";
        }
      } catch (imgErr) {
        console.warn("Could not fetch original image for comparison:", imgErr);
      }
    }

    // ---- Upload verification image to Supabase Storage ----
    const fileName = `verify-${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("issue_images")
      .upload(fileName, verifyBuffer, {
        contentType: verifyMimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload verification image" },
        { status: 500 }
      );
    }

    // ---- Call Gemini for Dual-Factor AI Analysis ----
    let parsed: VerificationResult;

    const genAI = getGeminiClient();
    if (!genAI) {
      console.warn("GEMINI_API_KEY not set, using fallback verification");
      parsed = {
        is_same_location: false,
        is_resolved: false,
        reasoning: "AI verification unavailable. Manual review required.",
      };
    } else {
      // Build the content parts — always include verification image,
      // include original image if we successfully fetched it
      const imageParts: Array<{
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }> = [];

      const prompt = originalImageBase64
        ? `You are a forensic city inspector for the "CivicPulse" verification platform. You are given two images.

Image A (below) is the ORIGINAL reported infrastructure issue.
Image B (after Image A) is a user's photo claiming the issue is now fixed.

You must determine two things:
1) Are Image A and Image B taken at the exact same physical location? (Check background structures, road textures, surrounding objects, landmarks, lighting angles).
2) Is the issue shown in Image A visually resolved in Image B? (Look for evidence of repair work: fresh asphalt/concrete, new installations, cleaned areas, restored structures).

Be strict — if the locations don't match, the verification is fraudulent regardless of whether the image shows a repaired area.`
        : `You are a forensic city inspector for the "CivicPulse" verification platform.

This image claims to show a repaired infrastructure issue (originally categorized as: "${report.category}" — "${report.title}").

Since the original image is unavailable for comparison, focus on:
1) Set is_same_location to true (cannot be determined without original image).
2) Does this image show evidence that the described issue ("${report.description}") has been resolved? Look for signs of completed repair work.`;

      imageParts.push({ text: prompt });

      // Image A — original (if available)
      if (originalImageBase64) {
        imageParts.push({
          inlineData: {
            mimeType: originalMimeType,
            data: originalImageBase64,
          },
        });
      }

      // Image B — verification photo
      imageParts.push({
        inlineData: {
          mimeType: verifyMimeType,
          data: verifyBuffer.toString("base64"),
        },
      });

      try {
        const response = await withGeminiRetry(() =>
          genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: imageParts,
              },
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: verificationGeminiSchema(),
            },
          })
        );

        const rawText = response.text;
        if (!rawText) {
          throw new Error("Gemini returned an empty response");
        }

        parsed = VerificationSchema.parse(JSON.parse(rawText));
      } catch (geminiError) {
        console.error("Gemini API failed:", geminiError);
        const parsedError = parseGeminiError(geminiError);
        return NextResponse.json(
          { error: parsedError.message },
          { status: parsedError.status }
        );
      }
    }

    // ---- Strict Approval Logic: BOTH conditions must pass ----
    // If AI detects a spoofed location, reject immediately
    if (!parsed.is_same_location) {
      return NextResponse.json(
        {
          verification: parsed,
          report: null,
          error:
            "Spoof detected: The verification photo does not appear to be from the same location as the original report.",
        },
        { status: 400 }
      );
    }

    let updatedReport = null;

    if (parsed.is_same_location && parsed.is_resolved) {
      const { data, error: updateError } = await supabase
        .from("reports")
        .update({ status: "Resolved" })
        .eq("id", reportId)
        .select()
        .single();

      if (updateError) {
        console.error("Supabase update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update report status" },
          { status: 500 }
        );
      }

      updatedReport = data;

      // Award civic points securely
      const { error: rpcError } = await supabase.rpc(
        "increment_civic_points",
        {
          points_to_add: 50,
        }
      );
      if (rpcError) {
        console.error("Failed to increment points:", rpcError);
      }
    }

    return NextResponse.json({
      verification: parsed,
      report: updatedReport,
    });
  } catch (err) {
    console.error("Unhandled error in POST /api/verify:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
