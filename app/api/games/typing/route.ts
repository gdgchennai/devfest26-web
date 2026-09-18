import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key", message: "GEMINI_API_KEY is not configured on the server." });
  }

  const { searchParams } = new URL(req.url);
  const wordLimit = Number(searchParams.get("words") || "100");

  try {
    const prompt = `Generate a continuous, general typing speed test paragraph about everyday topics like nature, hobbies, history, travel, food, or general life. Requirements:
1. Must contain exactly between ${wordLimit} and ${Math.round(wordLimit * 1.1)} words.
2. Must contain only lowercase letters and spaces.
3. Absolutely NO technology, computer, coding, software, or web development terms.
4. Absolutely NO punctuation, commas, periods, hyphens, numbers, or capital letters.
5. Return ONLY the raw plain text paragraph itself. No markdown, no quotes, and no formatting.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strictly sanitize to ensure 100% compliance with pure lowercase, punctuation-free layout
    text = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ") // replace all non-alphabetic/non-space with space
      .replace(/\s+/g, " ")      // squeeze whitespace
      .trim();

    if (!text) {
      throw new Error("Sanitization produced empty paragraph.");
    }

    return NextResponse.json({ paragraph: text });
  } catch (error) {
    // Graceful, silent fallback: print a single gentle log and return 200 OK with empty paragraph
    // This completely prevents Next.js from throwing scary red 500 error traces in your terminal!
    console.warn("Gemini API is unavailable or unconfigured. Falling back silently to local high-performance vocabulary generator.");
    return NextResponse.json({ paragraph: "", error: "failed_generation" });
  }
}
