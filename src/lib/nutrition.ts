export type NutritionEstimate = {
  protein: number;
  calories: number;
  servingGrams: number;
  servingLabel: string;
  confidence: "alta" | "média" | "baixa";
  matchedFoods: string[];
};

type FoodReference = {
  aliases: string[];
  label: string;
  protein100g: number;
  calories100g: number;
  defaultGrams: number;
};

const foods: FoodReference[] = [
  { aliases: ["frango grelhado", "peito de frango", "frango"], label: "frango grelhado", protein100g: 31, calories100g: 165, defaultGrams: 120 },
  { aliases: ["carne moida", "carne bovina", "bife", "carne"], label: "carne bovina", protein100g: 26, calories100g: 250, defaultGrams: 120 },
  { aliases: ["figado acebolado", "figado"], label: "fígado bovino", protein100g: 27, calories100g: 191, defaultGrams: 120 },
  { aliases: ["peixe grelhado", "tilapia", "peixe"], label: "peixe grelhado", protein100g: 26, calories100g: 128, defaultGrams: 120 },
  { aliases: ["ovo cozido", "ovo mexido", "omelete", "ovo"], label: "ovo", protein100g: 13, calories100g: 155, defaultGrams: 100 },
  { aliases: ["arroz integral", "arroz branco", "arroz"], label: "arroz cozido", protein100g: 2.5, calories100g: 130, defaultGrams: 100 },
  { aliases: ["feijao"], label: "feijão cozido", protein100g: 4.8, calories100g: 76, defaultGrams: 100 },
  { aliases: ["batata doce", "batata inglesa", "batata"], label: "batata cozida", protein100g: 1.8, calories100g: 86, defaultGrams: 120 },
  { aliases: ["macarrao", "massa"], label: "macarrão cozido", protein100g: 5, calories100g: 158, defaultGrams: 120 },
  { aliases: ["queijo minas", "mucarela", "queijo"], label: "queijo", protein100g: 22, calories100g: 300, defaultGrams: 30 },
  { aliases: ["iogurte grego", "iogurte"], label: "iogurte", protein100g: 5, calories100g: 90, defaultGrams: 170 },
  { aliases: ["whey protein", "whey"], label: "whey protein", protein100g: 75, calories100g: 390, defaultGrams: 30 },
  { aliases: ["salada", "legumes", "verduras"], label: "salada/legumes", protein100g: 2, calories100g: 35, defaultGrams: 100 },
  { aliases: ["banana"], label: "banana", protein100g: 1.1, calories100g: 89, defaultGrams: 90 },
  { aliases: ["maca"], label: "maçã", protein100g: 0.3, calories100g: 52, defaultGrams: 130 },
];

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const sizeFactor = (description: string) => {
  const value = normalize(description);
  if (/\b(pequeno|pequena|pouco|meia porcao)\b/.test(value)) return 0.7;
  if (/\b(grande|bem servido|bem servida|porcao grande)\b/.test(value)) return 1.4;
  return 1;
};

export function estimateNutrition(description: string, informedGrams?: number): NutritionEstimate | null {
  const normalized = normalize(description);
  if (!normalized.trim()) return null;

  const matches = foods.filter((food) =>
    food.aliases.some((alias) => normalized.includes(normalize(alias))),
  );
  if (!matches.length) return null;

  const explicitGrams = informedGrams && informedGrams > 0
    ? informedGrams
    : Number(normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gramas?)\b/)?.[1]?.replace(",", ".") || 0);
  const factor = sizeFactor(description);
  const isComposite = matches.length > 1;

  let protein = 0;
  let calories = 0;
  let totalGrams = 0;

  matches.forEach((food) => {
    const grams = explicitGrams
      ? explicitGrams / matches.length
      : Math.round(food.defaultGrams * factor);
    totalGrams += grams;
    protein += (food.protein100g * grams) / 100;
    calories += (food.calories100g * grams) / 100;
  });

  const size = factor < 1 ? "pequena" : factor > 1 ? "grande" : "média";
  return {
    protein: Math.round(protein),
    calories: Math.round(calories),
    servingGrams: Math.round(totalGrams),
    servingLabel: explicitGrams
      ? `${Math.round(totalGrams)} g informados`
      : `porção ${size} estimada em ${Math.round(totalGrams)} g`,
    confidence: explicitGrams ? "alta" : isComposite ? "baixa" : "média",
    matchedFoods: matches.map((food) => food.label),
  };
}
