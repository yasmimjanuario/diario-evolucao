import type { Meal, Profile } from "../types";
import { supabase } from "./supabase";

const today = () => new Date().toISOString().slice(0, 10);

export async function saveProfile(userId: string, profile: Profile) {
  return supabase.from("profiles").upsert({
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
    updated_at: new Date().toISOString(),
  });
}

export async function saveWeight(userId: string, weight: number) {
  return supabase.from("weight_logs").upsert(
    { user_id: userId, logged_on: today(), weight_kg: weight },
    { onConflict: "user_id,logged_on" },
  );
}

export async function saveWater(userId: string, amountMl: number) {
  return supabase.from("water_logs").upsert(
    { user_id: userId, logged_on: today(), amount_ml: amountMl },
    { onConflict: "user_id,logged_on" },
  );
}

export async function addMeal(userId: string, meal: Meal) {
  return supabase.from("meal_logs").insert({
    user_id: userId,
    logged_on: today(),
    name: meal.name,
    protein_g: meal.protein,
    calories: meal.calories,
    consumed_at: new Date().toISOString(),
  });
}
