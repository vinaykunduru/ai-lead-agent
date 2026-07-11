import "server-only";
import { serverEnv } from "@/lib/env.server";
import { createOpenAiCompatibleProvider } from "./openai-compatible";
import type { AiProvider } from "./types";

// "Llama" isn't one fixed vendor API — it's an open-weight model family
// hosted behind many different OpenAI-compatible endpoints (Groq, Together,
// a self-hosted vLLM/Ollama server, ...). LLAMA_API_BASE_URL lets a
// deployment point at whichever one it uses; this provider makes no
// assumption about which.
const DEFAULT_LLAMA_MODEL = "llama-3.3-70b-versatile";

export const llamaProvider: AiProvider = createOpenAiCompatibleProvider({
  id: "llama",
  apiUrl: serverEnv.LLAMA_API_BASE_URL ? `${serverEnv.LLAMA_API_BASE_URL}/chat/completions` : "",
  apiKey: serverEnv.LLAMA_API_KEY,
  model: serverEnv.LLAMA_MODEL ?? DEFAULT_LLAMA_MODEL,
  missingKeyMessage:
    "LLAMA_API_KEY / LLAMA_API_BASE_URL are not configured — cannot call the Llama provider.",
});
