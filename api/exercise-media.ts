type ApiRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type WgerItem = Record<string, unknown>;

const text = (value: unknown) => typeof value === "string" ? value : "";
const absoluteUrl = (value: unknown) => {
  const url = text(value);
  if (!url) return "";
  return url.startsWith("http") ? url : `https://wger.de${url.startsWith("/") ? "" : "/"}${url}`;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  if (request.method !== "GET") {
    response.status(405).json({ error: "Método não permitido." });
    return;
  }

  const rawQuery = request.query?.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim().slice(0, 80);
  if (!query || query.length < 2) {
    response.status(400).json({ error: "Digite ao menos duas letras." });
    return;
  }

  try {
    const url = new URL("https://wger.de/api/v2/exercisebaseinfo/");
    url.searchParams.set("language", "2");
    url.searchParams.set("limit", "30");
    url.searchParams.set("search", query);
    const upstream = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Evolua/1.0 (exercise media lookup)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error(`wger ${upstream.status}`);

    const payload = await upstream.json() as { results?: WgerItem[] };
    const normalized = (payload.results ?? []).flatMap((item) => {
      const exercises = Array.isArray(item.exercises) ? item.exercises as WgerItem[] : [];
      const translated = exercises.find((exercise) => exercise.language === 2) ?? exercises[0] ?? item;
      const name = text(translated.name) || text(item.name);
      if (!name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && payload.results!.length > 8) return [];

      const videos = (Array.isArray(item.videos) ? item.videos : []).map((entry) => {
        const video = entry as WgerItem;
        return { url: absoluteUrl(video.video || video.url), type: "video" as const };
      });
      const images = (Array.isArray(item.images) ? item.images : []).map((entry) => {
        const image = entry as WgerItem;
        return { url: absoluteUrl(image.image || image.url), type: "image" as const };
      });
      const media = [...videos, ...images].filter((entry) => entry.url).slice(0, 4);
      return name ? [{
        name,
        equipment: Array.isArray(item.equipment) ? item.equipment.map(String).join(", ") : "",
        instructions: text(translated.description)
          .replace(/<[^>]+>/g, " ")
          .split(/[.!?]\s+/)
          .map((part) => part.trim())
          .filter(Boolean)
          .slice(0, 4),
        media: media.map((entry) => ({ ...entry, attribution: "wger — CC BY-SA" })),
      }] : [];
    });

    response.status(200).json({ results: normalized.slice(0, 8) });
  } catch {
    response.status(200).json({ results: [], warning: "A biblioteca pública está temporariamente indisponível." });
  }
}
