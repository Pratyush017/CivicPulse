import { GoogleGenAI } from "@google/genai";

let genAIInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  
  if (!genAIInstance) {
    genAIInstance = new GoogleGenAI({ apiKey });
  }
  
  return genAIInstance;
}

export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      const errStr = String(err?.message || error);
      // If it's a quota exceeded error with a long wait, don't bother retrying with exponential backoff
      if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded")) {
        throw error;
      }

      const status = (error as { status?: number })?.status;
      const isRetryable = status === 503 || status === 429;
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }
      attempt++;
      const delay = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500; // Exponential backoff + jitter
      console.log(`Gemini API busy (Status ${status}). Retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Gemini retry failed");
}

export function parseGeminiError(error: unknown): { message: string; status: number } {
  const err = error as Record<string, unknown>;
  const errMsg = String(err?.message || error);
  
  // Try parsing if it looks like JSON
  if (errMsg.includes('{"error":')) {
    try {
      const parsed = JSON.parse(errMsg.substring(errMsg.indexOf('{')));
      if (parsed.error?.status === "RESOURCE_EXHAUSTED" || parsed.error?.code === 429) {
        let retryDelayStr = "a minute";
        if (parsed.error.details) {
          const retryInfo = parsed.error.details.find((d: Record<string, unknown>) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          if (retryInfo?.retryDelay) {
            retryDelayStr = retryInfo.retryDelay;
          }
        }
        return {
          message: `AI Service quota exceeded. Please wait ${retryDelayStr} before trying again.`,
          status: 429
        };
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Fallback string matching
  if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota exceeded")) {
     return { message: "AI Service quota exceeded. Please try again in a minute.", status: 429 };
  }

  return { message: errMsg, status: 500 };
}
