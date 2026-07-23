import type { Exercise, Profile } from "../types";

export const calculateAge = (birthDate: string) => {
  if (!birthDate) return 30;
  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
};

export const calculateBmi = (weightKg: number, heightCm: number) =>
  heightCm > 0 ? weightKg / (heightCm / 100) ** 2 : 0;

export const bmiLabel = (bmi: number) => {
  if (bmi < 18.5) return "Abaixo do ideal";
  if (bmi < 25) return "Faixa saudável";
  if (bmi < 30) return "Sobrepeso";
  if (bmi < 35) return "Obesidade grau I";
  if (bmi < 40) return "Obesidade grau II";
  return "Obesidade grau III";
};

export const calorieBurn = (met: number, weightKg: number, seconds: number) =>
  Math.round((met * 3.5 * weightKg * (seconds / 60)) / 200);

const library: Exercise[] = [
  { id: "chair-squat", name: "Agachamento no banco", muscle: "Pernas", equipment: "Peso corporal", sets: 3, reps: "10–12", restSeconds: 60, met: 5, weight: 0, completed: false },
  { id: "wall-push", name: "Flexão na parede", muscle: "Peito", equipment: "Peso corporal", sets: 3, reps: "8–12", restSeconds: 60, met: 3.8, weight: 0, completed: false },
  { id: "bridge", name: "Ponte de glúteos", muscle: "Glúteos", equipment: "Peso corporal", sets: 3, reps: "12–15", restSeconds: 45, met: 4, weight: 0, completed: false },
  { id: "march", name: "Marcha estacionária", muscle: "Cardio", equipment: "Peso corporal", sets: 3, reps: "2 min", restSeconds: 45, met: 4.5, weight: 0, completed: false },
  { id: "db-row", name: "Remada unilateral", muscle: "Costas", equipment: "Halteres", sets: 3, reps: "10–12", restSeconds: 60, met: 5, weight: 4, completed: false },
  { id: "db-deadlift", name: "Levantamento romeno", muscle: "Posterior", equipment: "Halteres", sets: 3, reps: "10–12", restSeconds: 75, met: 5.5, weight: 6, completed: false },
  { id: "db-press", name: "Desenvolvimento", muscle: "Ombros", equipment: "Halteres", sets: 3, reps: "8–10", restSeconds: 60, met: 5, weight: 3, completed: false },
  { id: "lat-pull", name: "Puxada alta", muscle: "Costas", equipment: "Puxador", sets: 3, reps: "10–12", restSeconds: 75, met: 5, weight: 15, completed: false },
  { id: "leg-press", name: "Leg press", muscle: "Pernas", equipment: "Leg press", sets: 3, reps: "10–12", restSeconds: 90, met: 5.5, weight: 30, completed: false },
  { id: "bike", name: "Bicicleta ergométrica", muscle: "Cardio", equipment: "Bicicleta", sets: 1, reps: "12 min", restSeconds: 0, met: 5.8, weight: 0, completed: false },
  { id: "walker", name: "Transport / Air walker", muscle: "Cardio", equipment: "Transport", sets: 1, reps: "10 min", restSeconds: 0, met: 5, weight: 0, completed: false },
];

export const generateWorkout = (profile: Profile) => {
  const allowed = new Set(["Peso corporal", ...profile.equipment]);
  const selected = library.filter((exercise) => allowed.has(exercise.equipment));
  const balanced: Exercise[] = [];
  for (const group of ["Pernas", "Costas", "Peito", "Glúteos", "Ombros", "Posterior", "Cardio"]) {
    const match = selected.find((exercise) => exercise.muscle === group);
    if (match && balanced.length < 6) balanced.push({ ...match });
  }
  return balanced.length >= 4 ? balanced : library.slice(0, 4).map((item) => ({ ...item }));
};

export const proteinTarget = (weightKg: number) => Math.round(weightKg * 1.5);

export const estimatedDailyCalories = (profile: Profile) => {
  const age = calculateAge(profile.birthDate);
  const sexFactor = profile.sex === "male" ? 5 : profile.sex === "female" ? -161 : -78;
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * age + sexFactor;
  const factors = { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
  return Math.round(bmr * factors[profile.activityLevel]);
};
