import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key", message: "GEMINI_API_KEY is not configured on the server." });
  }
  try {
    const prompt = "Generate a continuous, general typing speed test paragraph about everyday topics like nature, hobbies, history, travel, food, or general life. Requirements:\n1. Must contain exactly between 100 to 120 words.\n2. Must contain only lowercase letters and spaces.\n3. Absolutely NO technology, computer, coding, software, or web development terms.\n4. Absolutely NO punctuation, commas, periods, hyphens, numbers, or capital letters.\n5. Return ONLY the raw plain text paragraph itself. No markdown, no quotes, and no formatting.";

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
      if (response.status === 404) {
        console.error(
          "Gemini API returned status 404. This usually means the 'Generative Language API' has not been enabled yet inside the Google Cloud Console for your API Key, or the model is unavailable."
        );
      }
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
    console.error("Gemini API generation failed:", error);
    return NextResponse.json({ error: "failed_generation", message: "Failed generating text via Gemini API." }, { status: 500 });
  }
}
