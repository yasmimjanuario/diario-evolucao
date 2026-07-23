import type { Exercise, Profile } from "../types";
import { supabase } from "./supabase";

type GenerateWorkoutResponse = {
  exercises?: Exercise[];
  error?: string;
};

export async function generateAiWorkout(profile: Profile): Promise<Exercise[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");

  const response = await fetch("/api/generate-workout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ profile }),
  });

  const result = await response.json().catch(() => ({})) as GenerateWorkoutResponse;
  if (!response.ok) {
    throw new Error(result.error ?? "Não foi possível gerar o plano agora.");
  }
  if (!result.exercises?.length) throw new Error("A IA não retornou exercícios válidos.");
  return result.exercises;
}
