import type { Exercise } from "../types";

export type ExerciseSuggestion = Pick<Exercise, "name" | "equipment" | "instructions" | "media">;

export const searchExerciseLibrary = async (query: string): Promise<ExerciseSuggestion[]> => {
  const response = await fetch(`/api/exercise-media?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  const payload = await response.json() as { results?: ExerciseSuggestion[] };
  return payload.results ?? [];
};
