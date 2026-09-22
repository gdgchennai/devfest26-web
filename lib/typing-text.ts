/**
 * Lowercase, punctuation-free paragraphs for the Speed Typer, and a generator
 * that stretches them to any length.
 *
 * Used by the server when it deals a run (Gemini not configured, or it failed)
 * and by the browser only for the unranked offline fallback. Pure, no I/O.
 */

// Rich, natural fallback paragraphs (nature, everyday life, travel, hobbies).
// Keeps gameplay good when Gemini is offline or unconfigured.
const FALLBACK_PARAGRAPHS = [
  "the gentle sound of a quiet forest brings a deep sense of peace to the human mind as the soft wind blows through the green leaves of ancient trees and birds sing their morning songs while a small clear stream flows slowly over smooth gray stones and a warm golden sun filters down between the branches creating soft shadows on the damp earth below where tiny flowers grow silently in the mossy ground",
  "everyday life is filled with simple moments that often go unnoticed but hold a quiet beauty like the rich aroma of fresh coffee in the early morning as the world is still waking up and the sky changes from deep dark blue to soft shades of orange and pink while people begin their daily journeys walking along clean city streets or driving past quiet neighborhoods with a feeling of hope for what the new day will bring",
  "traveling to new places allows us to see the world from a completely different angle as we walk through old historic cities with narrow stone streets and look at beautiful buildings built many centuries ago while listening to the unfamiliar sounds of a foreign language and tasting traditional foods made with fresh local ingredients that tell the story of a culture and its people across the passage of time",
  "finding a creative hobby like painting gardening or reading books provides a wonderful escape from the busy rush of modern routines as we lose ourselves in the quiet focus of creating something with our own hands or traveling to imaginary worlds through the printed pages of a great story where characters face challenges and embark on amazing journeys that inspire our own hearts and minds",
];

/** Exactly `wordCount` words, built from the fallback paragraphs (repeated as needed). */
export function generateLocalParagraph(wordCount: number, rng: () => number = Math.random): string {
  const pick = () => FALLBACK_PARAGRAPHS[Math.floor(rng() * FALLBACK_PARAGRAPHS.length)].split(" ");
  const words = pick();
  while (words.length < wordCount) words.push(...pick());
  return words.slice(0, wordCount).join(" ");
}

/** Normalises text the way the game does: lowercase letters and single spaces. */
export function sanitizeTypingText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
