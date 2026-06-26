import { NextRequest, NextResponse } from "next/server";
import { Type } from "@google/genai";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getGeminiClient, withGeminiRetry, parseGeminiError } from "@/lib/gemini";

// ---------------------------------------------------------------------------
// 1. Zod schema — single source of truth for the Gemini response shape
// ---------------------------------------------------------------------------
const ReportAnalysisSchema = z.object({
  is_valid_issue: z.boolean().describe("True if the image contains a reportable civic defect (e.g. pothole, graffiti, broken light). False if it is standard wear and tear, clean roads, blank walls, or unrelated."),
  rejection_reason: z.string().describe("If is_valid_issue is false, explain why it was rejected. If true, return an empty string."),
  category: z
    .string()
    .describe(
      "Category of the civic issue, e.g. Pothole, Broken Streetlight, Illegal Dumping, Flood, Graffiti, Fallen Tree, Water Leak, etc."
    ),
  title: z
    .string()
    .describe(
      "A concise, descriptive title for the issue (max 80 characters)."
    ),
  description: z
    .string()
    .describe(
      "A detailed description of the issue visible in the image, including context such as severity, affected area, and potential impact."
    ),
  severity_score: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      "A severity rating from 1 (cosmetic / minor) to 5 (critical / dangerous)."
    ),
});

type ReportAnalysis = z.infer<typeof ReportAnalysisSchema>;

// ---------------------------------------------------------------------------
// 2. Helper — convert Zod schema → Gemini responseSchema (JSON Schema subset)
// ---------------------------------------------------------------------------
function zodToGeminiSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      is_valid_issue: {
        type: Type.BOOLEAN,
        description: "True if the image contains a reportable civic defect. False if it is standard wear and tear, clean roads, blank walls, or unrelated.",
      },
      rejection_reason: {
        type: Type.STRING,
        description: "If is_valid_issue is false, explain why it was rejected. If true, return an empty string.",
      },
      category: {
        type: Type.STRING,
        description:
          "Category of the civic issue, e.g. Pothole, Broken Streetlight, Illegal Dumping, Flood, Graffiti, Fallen Tree, Water Leak, etc.",
      },
      title: {
        type: Type.STRING,
        description:
          "A concise, descriptive title for the issue (max 80 characters).",
      },
      description: {
        type: Type.STRING,
        description:
          "A detailed description of the issue visible in the image, including context such as severity, affected area, and potential impact.",
      },
      severity_score: {
        type: Type.NUMBER,
        description:
          "A severity rating from 1 (cosmetic / minor) to 5 (critical / dangerous).",
      },
    },
    required: ["is_valid_issue", "rejection_reason", "category", "title", "description", "severity_score"],
  };
}

// ---------------------------------------------------------------------------
// 3. POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- Parse multipart form data ----
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const latitude = formData.get("latitude") as string | null;
    const longitude = formData.get("longitude") as string | null;

    if (!imageFile || !latitude || !longitude) {
      return NextResponse.json(
        { error: "Missing required fields: image, latitude, longitude" },
        { status: 400 }
      );
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json(
        { error: "latitude and longitude must be valid numbers" },
        { status: 400 }
      );
    }

    // ---- Read the file into a buffer ----
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = imageFile.type || "image/jpeg";

    // ---- Upload to Supabase Storage ----
    const fileName = `${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("issue_images")
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image to storage" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("issue_images").getPublicUrl(fileName);

    // ---- Call Gemini 2.0 Flash with structured output ----
    let parsed: ReportAnalysis;

    const genAI = getGeminiClient();
    if (!genAI) {
      // No API key — use fallback
      console.warn("GEMINI_API_KEY not set, using fallback classification");
      parsed = {
        is_valid_issue: true,
        rejection_reason: "",
        category: "Uncategorized",
        title: `Community Issue Report — ${new Date().toLocaleDateString()}`,
        description: "This report was submitted but could not be analyzed by AI. Manual review required.",
        severity_score: 3,
      };
    } else {
      try {
        const response = await withGeminiRetry(() =>
          genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are the primary City Infrastructure Triage Gate. Step 1: Determine if this image actually contains a reportable civic defect (e.g., pothole, graffiti, broken light, hazard). A minor crack IS a valid low-severity issue. However, standard wear and tear, perfectly clean roads, blank walls, or unrelated photos are NOT issues. You are also a digital forensics expert. You must reject this image if it appears to be a downloaded stock photo, contains watermarks, shows computer screen pixels (moiré effect), or lacks physical realism. If the image lacks a clear defect or fails the forensic check, you MUST set is_valid_issue to false and provide a rejection_reason.\nReturn a JSON object with these fields:\n- is_valid_issue: boolean\n- rejection_reason: string (empty if valid)\n- category: the type of issue (e.g. Pothole, Broken Streetlight, Illegal Dumping, Flood, Graffiti, Fallen Tree, Water Leak)\n- title: a concise, descriptive title (max 80 characters)\n- description: a detailed description covering severity, affected area, and potential impact\n- severity_score: integer from 1 (cosmetic) to 5 (critical / dangerous)`,
                  },
                  {
                    inlineData: {
                      mimeType,
                      data: buffer.toString("base64"),
                    },
                  },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: zodToGeminiSchema(),
            },
          })
        );

        const rawText = response.text;
        if (!rawText) {
          throw new Error("Gemini returned an empty response");
        }

        parsed = ReportAnalysisSchema.parse(JSON.parse(rawText));
      } catch (geminiError) {
        console.error("Gemini API failed:", geminiError);
        const parsedError = parseGeminiError(geminiError);
        return NextResponse.json(
          { error: parsedError.message },
          { status: parsedError.status }
        );
      }
    }

    if (!parsed.is_valid_issue) {
      // Rejection logic & storage cleanup
      const storageFileName = publicUrl.split('/').pop();
      if (storageFileName) {
        await supabase.storage.from("issue_images").remove([storageFileName]);
      }
      return NextResponse.json(
        { error: parsed.rejection_reason || "AI Triage Rejected: Invalid civic issue." },
        { status: 400 }
      );
    }

    // ---- Insert into the reports table ----
    const { data: report, error: insertError } = await supabase
      .from("reports")
      .insert({
        title: parsed.title,
        description: parsed.description,
        category: parsed.category,
        severity_score: parsed.severity_score,
        latitude: lat,
        longitude: lng,
        image_url: publicUrl,
        status: "Reported",
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save report to database" },
        { status: 500 }
      );
    }

    // Give civic points securely
    const { error: rpcError } = await supabase.rpc("increment_civic_points", {
      points_to_add: 10,
    });
    if (rpcError) {
      console.error("Failed to increment points:", rpcError);
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    console.error("Unhandled error in POST /api/report:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
