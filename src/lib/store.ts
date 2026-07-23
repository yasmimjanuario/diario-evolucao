import type { Meal, Profile, WeightLog } from "../types";
import { supabase } from "./supabase";

const today = () => new Date().toISOString().slice(0, 10);

export async function saveProfile(userId: string, profile: Profile) {
  const { data, error } = await supabase.from("profiles").upsert({
    id: userId,
    display_name: profile.name,
    birth_date: profile.birthDate || null,
    sex: profile.sex,
    height_cm: profile.heightCm,
    current_weight_kg: profile.weightKg,
    goal_weight_kg: profile.goalWeightKg,
    activity_level: profile.activityLevel,
    equipment: profile.equipment,
    limitations: profile.limitations,
    water_goal_ml: profile.waterGoalMl,
    protein_goal_g: profile.proteinGoalG,
    weekly_exercise_minutes: profile.weeklyExerciseMinutes,
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return data;
}

export async function loadUserData(userId: string) {
  const [
    { data: profile, error: profileError },
    { data: water, error: waterError },
    { data: meals, error: mealsError },
    { data: weights, error: weightsError },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("logged_on", today()).maybeSingle(),
    supabase.from("meal_logs").select("id,name,protein_g,calories,consumed_at").eq("user_id", userId).eq("logged_on", today()).order("consumed_at"),
    supabase.from("weight_logs").select("id,weight_kg,logged_at").eq("user_id", userId).order("logged_at"),
  ]);

  const error = profileError ?? waterError ?? mealsError ?? weightsError;
  if (error) throw error;

  return {
    profile: profile ? {
      id: profile.id,
      name: profile.display_name ?? "",
      birthDate: profile.birth_date ?? "",
      sex: profile.sex ?? "female",
      heightCm: Number(profile.height_cm ?? 0),
      weightKg: Number(profile.current_weight_kg ?? 0),
      goalWeightKg: Number(profile.goal_weight_kg ?? 0),
      activityLevel: profile.activity_level ?? "low",
      equipment: profile.equipment ?? [],
      limitations: profile.limitations ?? "",
      waterGoalMl: Number(profile.water_goal_ml ?? 0),
      proteinGoalG: Number(profile.protein_goal_g ?? 0),
      weeklyExerciseMinutes: Number(profile.weekly_exercise_minutes ?? 0),
      onboardingCompleted: Boolean(profile.onboarding_completed),
    } satisfies Profile : null,
    water: Number(water?.amount_ml ?? 0),
    meals: (meals ?? []).map((meal) => ({
      id: meal.id,
      name: meal.name,
      protein: Number(meal.protein_g),
      calories: Number(meal.calories),
      time: new Date(meal.consumed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    })) satisfies Meal[],
    weights: (weights ?? []).map((item) => ({
      id: item.id,
      weight: Number(item.weight_kg),
      date: item.logged_at,
    })) satisfies WeightLog[],
  };
}

export async function saveWeight(userId: string, weight: number) {
  const { data, error } = await supabase.from("weight_logs").insert({
    user_id: userId,
    logged_on: today(),
    logged_at: new Date().toISOString(),
    weight_kg: weight,
  }).select("id,weight_kg,logged_at").single();
  if (error) throw error;
  return data;
}

export async function saveWater(userId: string, amountMl: number) {
  const { error } = await supabase.from("water_logs").upsert(
    { user_id: userId, logged_on: today(), amount_ml: amountMl },
    { onConflict: "user_id,logged_on" },
  );
  if (error) throw error;
}

export async function addMeal(userId: string, meal: Meal) {
  const { error } = await supabase.from("meal_logs").insert({
    user_id: userId,
    logged_on: today(),
    name: meal.name,
    protein_g: meal.protein,
    calories: meal.calories,
    consumed_at: new Date().toISOString(),
  });
  if (error) throw error;
}
