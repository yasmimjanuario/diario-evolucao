import { generateText, Output } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().max(80),
  birthDate: z.string().max(10),
  sex: z.enum(["female", "male", "other"]),
  heightCm: z.number().min(50).max(260),
  weightKg: z.number().min(20).max(400),
  goalWeightKg: z.number().min(20).max(400),
  activityLevel: z.enum(["low", "light", "moderate", "high"]),
  equipment: z.array(z.string().min(1).max(80)).max(30),
  limitations: z.string().max(1000),
  weeklyExerciseMinutes: z.number().min(10).max(2000),
});

const exerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscle: z.string(),
  equipment: z.string(),
  sets: z.number().int().min(1).max(6),
  reps: z.string(),
  restSeconds: z.number().int().min(0).max(300),
  met: z.number().min(1.5).max(12),
  weight: z.number().min(0).max(500),
  completed: z.literal(false),
  instructions: z.array(z.string()).min(2).max(4),
});

const workoutSchema = z.object({
  exercises: z.array(exerciseSchema).min(4).max(7),
});

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ error: "Método não permitido." });
    return;
  }

  const authorization = request.headers.authorization;
  const token = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!token?.startsWith("Bearer ")) {
    response.status(401).json({ error: "Entre novamente para gerar um plano." });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    response.status(500).json({ error: "A autenticação do servidor não está configurada." });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token.slice(7));
  if (userError || !user) {
    response.status(401).json({ error: "Sua sessão expirou. Entre novamente." });
    return;
  }

  const parsed = z.object({ profile: profileSchema }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Revise os dados do perfil antes de gerar o plano." });
    return;
  }

  const profile = parsed.data.profile;
  try {
    const { output } = await generateText({
      model: "openai/gpt-5.4-mini",
      output: Output.object({ schema: workoutSchema }),
      system: [
        "Você é um planejador conservador de exercícios para adultos.",
        "Crie um treino simples, equilibrado e em português do Brasil.",
        "Use somente os equipamentos informados ou peso corporal.",
        "Inclua obrigatoriamente ao menos um exercício de aquecimento ou aeróbico de baixo impacto, marcado com muscle igual a Cardio.",
        "Varie o plano em relação a combinações comuns; não devolva sempre a mesma sequência.",
        "Respeite limitações literalmente; não diagnostique nem prescreva tratamento.",
        "Priorize movimentos fáceis de demonstrar e não inclua exercícios perigosos ou máximos.",
        "A carga inicial deve ser 0, pois o usuário registrará a carga real.",
        "IDs devem ser curtos, únicos e sem dados pessoais.",
      ].join(" "),
      prompt: JSON.stringify({
        objetivo: "Criar o próximo treino do usuário",
        perfil: {
          idadeAproximada: profile.birthDate,
          sexo: profile.sex,
          alturaCm: profile.heightCm,
          pesoKg: profile.weightKg,
          pesoMetaKg: profile.goalWeightKg,
          nivelAtividade: profile.activityLevel,
          equipamentos: profile.equipment.length ? profile.equipment : ["Peso corporal"],
          limitacoesDeclaradas: profile.limitations || "Nenhuma informada",
          metaSemanalMinutos: profile.weeklyExerciseMinutes,
        },
      }),
      providerOptions: {
        gateway: {
          user: user.id,
          tags: ["feature:workout-plan", "app:evolua"],
        },
      },
    });

    response.status(200).json(output);
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 500;
    if (statusCode === 429) {
      response.status(429).json({ error: "Limite temporário da IA atingido. Tente novamente em alguns minutos." });
      return;
    }
    console.error("generate-workout failed", error);
    response.status(500).json({ error: "A IA não conseguiu gerar o plano agora. Tente novamente." });
  }
}
