export type Tab = "hoje" | "treino" | "progresso" | "perfil";

export type Profile = {
  id?: string;
  name: string;
  birthDate: string;
  sex: "female" | "male" | "other";
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  activityLevel: "low" | "light" | "moderate" | "high";
  equipment: string[];
  limitations: string;
  waterGoalMl: number;
  proteinGoalG: number;
  weeklyExerciseMinutes: number;
};

export type Meal = {
  id: string;
  name: string;
  protein: number;
  calories: number;
  time: string;
};

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  sets: number;
  reps: string;
  restSeconds: number;
  met: number;
  weight: number;
  completed: boolean;
};

export type WorkoutSession = {
  startedAt: number | null;
  elapsedSeconds: number;
  running: boolean;
};
