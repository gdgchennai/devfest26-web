import crosswordsData from "@/content/crosswords.json";
import techCardsData from "@/content/tech-cards.json";
import jigsawPhotosData from "@/content/jigsaw-photos.json";

export type CrosswordClue = {
  number: number;
  direction: "across" | "down";
  clue: string;
  answer: string;
  row: number;
  col: number;
};

export type CrosswordPuzzle = {
  id: string;
  title: string;
  category: string;
  size: number;
  clues: CrosswordClue[];
};

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

export async function getTechCards(): Promise<TechCardDefinition[]> {
  return techCardsData as TechCardDefinition[];
}

export async function getJigsawPhotos(): Promise<ArchivePhotoChoice[]> {
  return jigsawPhotosData as ArchivePhotoChoice[];
}
