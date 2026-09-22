import crosswordsData from "@/content/crosswords.json";
import techCardsData from "@/content/tech-cards.json";
import jigsawPhotosData from "@/content/jigsaw-photos.json";

import { toPublicPuzzle, type CrosswordPuzzle, type PublicCrosswordPuzzle } from "@/lib/game-rules";

export type { CrosswordClue, CrosswordPuzzle, PublicCrosswordClue, PublicCrosswordPuzzle } from "@/lib/game-rules";

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
  return crosswordsData as CrosswordPuzzle[];
}

/** The list the browser gets: grid and clues only — the answers stay on the server. */
export async function getPublicCrosswordPuzzles(): Promise<PublicCrosswordPuzzle[]> {
  return (crosswordsData as CrosswordPuzzle[]).map(toPublicPuzzle);
}

export async function getTechCards(): Promise<TechCardDefinition[]> {
  return techCardsData as TechCardDefinition[];
}

export async function getJigsawPhotos(): Promise<ArchivePhotoChoice[]> {
  return jigsawPhotosData as ArchivePhotoChoice[];
}
