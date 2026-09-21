import "server-only";
import { generateLocalParagraph, sanitizeTypingText } from "@/lib/typing-text";

/** Used when GEMINI_MODEL is not set. Models get retired — a stale id is a 404
 *  and the game quietly uses its local word list — so it is an env var (see
 *  docs/environment.md) rather than something to edit and redeploy. */
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

/** A run is dealt when the player opens the game, so keep Gemini on a short leash:
 *  past this the local generator answers instead. */
const GEMINI_TIMEOUT_MS = 2500;

/** Most words asked of Gemini in one go; longer runs are topped up locally. */
const GEMINI_MAX_WORDS = 500;

type GeminiEnv = { GEMINI_API_KEY?: string; GEMINI_MODEL?: string };

async function askGemini(wordCount: number, env: GeminiEnv): Promise<string> {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const words = Math.min(GEMINI_MAX_WORDS, wordCount);
  const prompt = `Generate a continuous, general typing speed test paragraph about everyday topics like nature, hobbies, history, travel, food, or general life. Requirements:
1. Must contain exactly between ${words} and ${Math.round(words * 1.1)} words.
2. Must contain only lowercase letters and spaces.
3. Absolutely NO technology, computer, coding, software, or web development terms.
4. Absolutely NO punctuation, commas, periods, hyphens, numbers, or capital letters.
5. Return ONLY the raw plain text paragraph itself. No markdown, no quotes, and no formatting.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      // Key in a header, not the query string, so it never lands in logs.
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    },
  );
  if (!response.ok) throw new Error(`Gemini API (${model}) returned status ${response.status}`);

  const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = sanitizeTypingText(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
  if (!text) throw new Error("Sanitization produced empty paragraph.");
  return text;
}

/**
 * Exactly `wordCount` lowercase words for a run: Gemini when it is configured and
 * answers in time, otherwise (or for whatever Gemini leaves short) the local
 * generator. Never throws — a failure is logged and the game still gets text.
 */
export async function generateTypingText(wordCount: number, env: GeminiEnv): Promise<{ text: string; source: "gemini" | "local" }> {
  let words: string[] = [];
  let source: "gemini" | "local" = "local";

  if (env.GEMINI_API_KEY) {
    try {
      words = (await askGemini(wordCount, env)).split(" ");
      source = "gemini";
    } catch (error) {
      // A bad model id shows up here as a 404.
      console.warn("Gemini paragraph unavailable, using the local generator:", error);
    }
  }

  if (words.length < wordCount) words = [...words, ...generateLocalParagraph(wordCount - words.length).split(" ")];
  return { text: words.slice(0, wordCount).join(" "), source };
}
