export type PublicFoodSuggestion = {
  id: string;
  label: string;
  brand: string;
  protein100g: number;
  calories100g: number;
  servingGrams: number;
  source: "Open Food Facts";
};

type OpenFoodFactsProduct = {
  code?: string;
  product_name_pt?: string;
  product_name?: string;
  brands?: string;
  serving_quantity?: number;
  nutriments?: {
    proteins_100g?: number;
    "energy-kcal_100g"?: number;
  };
};

const cache = new Map<string, PublicFoodSuggestion[]>();

export async function searchPublicFoods(query: string, signal?: AbortSignal) {
  const term = query.trim().toLocaleLowerCase("pt-BR");
  if (term.length < 3) return [];
  if (cache.has(term)) return cache.get(term)!;

  const params = new URLSearchParams({
    search_terms: term,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "12",
    countries_tags: "en:brazil",
    fields: "code,product_name,product_name_pt,brands,serving_quantity,nutriments",
  });
  const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, { signal });
  if (!response.ok) throw new Error("A base nutricional está temporariamente indisponível.");
  const payload = await response.json() as { products?: OpenFoodFactsProduct[] };
  const results = (payload.products ?? [])
    .map((product): PublicFoodSuggestion | null => {
      const protein = Number(product.nutriments?.proteins_100g);
      const calories = Number(product.nutriments?.["energy-kcal_100g"]);
      const name = product.product_name_pt || product.product_name;
      if (!name || !Number.isFinite(protein) || !Number.isFinite(calories)) return null;
      return {
        id: product.code || `${name}-${product.brands || ""}`,
        label: name,
        brand: product.brands || "Sem marca informada",
        protein100g: protein,
        calories100g: calories,
        servingGrams: Number(product.serving_quantity) || 100,
        source: "Open Food Facts",
      };
    })
    .filter((item): item is PublicFoodSuggestion => Boolean(item))
    .filter((item, index, items) => items.findIndex((other) => other.id === item.id) === index)
    .slice(0, 6);
  cache.set(term, results);
  return results;
}
