import {
  getDailyCrosswordPuzzle,
  getDailyPublicCrossword,
  getCrosswordPuzzleById,
} from "@/lib/crossword-generator";
import techCardsData from "@/content/tech-cards.json";
import jigsawPhotosData from "@/content/jigsaw-photos.json";

import type { CrosswordPuzzle, PublicCrosswordPuzzle } from "@/lib/game-rules";

export type { CrosswordClue, CrosswordPuzzle, PublicCrosswordClue, PublicCrosswordPuzzle } from "@/lib/game-rules";
export { getCrosswordPuzzleById } from "@/lib/crossword-generator";

export type TechCardDefinition = {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  accent: string;
};

export type ArchivePhotoChoice = {
  src: string;
  title: string;
  year: number;
  description: string;
};

export async function getCrosswordPuzzles(): Promise<CrosswordPuzzle[]> {
  const daily = await getDailyCrosswordPuzzle();
  return [daily];
}

/** The list the browser gets: grid and clues only — the answers stay on the server. */
export async function getPublicCrosswordPuzzles(): Promise<PublicCrosswordPuzzle[]> {
  const daily = await getDailyPublicCrossword();
  return [daily];
}

export async function getTechCards(): Promise<TechCardDefinition[]> {
  return techCardsData as TechCardDefinition[];
}

export async function getJigsawPhotos(): Promise<ArchivePhotoChoice[]> {
  return jigsawPhotosData as ArchivePhotoChoice[];
}
