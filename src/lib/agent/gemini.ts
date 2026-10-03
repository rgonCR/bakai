import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    ""
  );
}

export function hasGemini() {
  return Boolean(getGeminiApiKey());
}

/** Provider Gemini — key só no servidor (.env.local). Não sobe pro Supabase enquanto o loop estiver no Next. */
export function createGeminiProvider() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente");
  return createGoogleGenerativeAI({ apiKey });
}

export function geminiModelId() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}
