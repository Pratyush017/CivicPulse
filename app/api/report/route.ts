import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// 1. Zod schema — single source of truth for the Gemini response shape
// ---------------------------------------------------------------------------
const ReportAnalysisSchema = z.object({
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
    required: ["category", "title", "description", "severity_score"],
  };
}

// ---------------------------------------------------------------------------
// 3. POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
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
    const fileName = `${Date.now()}-${imageFile.name.replace(/\s+/g, "_")}`;

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

    // ---- Call Gemini 1.5 Flash with structured output ----
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: missing GOOGLE_AI_API_KEY" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenAI({ apiKey });

    const response = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a civic-issue analysis AI for the "Community Hero" platform.
Analyse the attached image of a community or infrastructure problem.
Return a JSON object with these fields:
- category: the type of issue (e.g. Pothole, Broken Streetlight, Illegal Dumping, Flood, Graffiti, Fallen Tree, Water Leak)
- title: a concise, descriptive title (max 80 characters)
- description: a detailed description covering severity, affected area, and potential impact
- severity_score: integer from 1 (cosmetic) to 5 (critical / dangerous)`,
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
    });

    // ---- Parse & validate the Gemini response with Zod ----
    const rawText = response.text;
    if (!rawText) {
      return NextResponse.json(
        { error: "Gemini returned an empty response" },
        { status: 502 }
      );
    }

    const parsed: ReportAnalysis = ReportAnalysisSchema.parse(
      JSON.parse(rawText)
    );

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

    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    console.error("Unhandled error in POST /api/report:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
