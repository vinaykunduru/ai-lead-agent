import "server-only";
import { serverEnv } from "@/lib/env.server";
import { createOpenAiCompatibleProvider } from "./openai-compatible";
import type { AiProvider } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-5";

export const openAiProvider: AiProvider = createOpenAiCompatibleProvider({
  id: "openai",
  apiUrl: OPENAI_API_URL,
  apiKey: serverEnv.OPENAI_API_KEY,
  model: serverEnv.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
  missingKeyMessage: "OPENAI_API_KEY is not configured — cannot call OpenAI.",
});
