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
const itemLabel = (value: unknown) => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const item = value as WgerItem;
  return text(item.name) || text(item.name_en) || text(item.label);
};
const searchAliases: Record<string, { search: string; name: string }> = {
  extensora: { search: "leg extension", name: "Cadeira extensora" },
  flexora: { search: "leg curl", name: "Cadeira flexora" },
  agachamento: { search: "squat", name: "Agachamento" },
  supino: { search: "bench press", name: "Supino" },
  remada: { search: "row", name: "Remada" },
  puxador: { search: "lat pulldown", name: "Puxador alto" },
  abdominal: { search: "crunch", name: "Abdominal" },
  esteira: { search: "treadmill", name: "Caminhada na esteira" },
  bicicleta: { search: "cycling", name: "Bicicleta ergométrica" },
};
const findAlias = (query: string) => {
  const normalized = query.toLocaleLowerCase("pt-BR").trim();
  return Object.entries(searchAliases).find(([term]) =>
    normalized.includes(term) || (normalized.length >= 3 && term.startsWith(normalized))
  )?.[1];
};
const absoluteUrl = (value: unknown) => {
  const url = text(value);
  if (!url) return "";
  return url.startsWith("http") ? url : `https://wger.de${url.startsWith("/") ? "" : "/"}${url}`;
};
const stringList = (value: unknown) => Array.isArray(value)
  ? value.map(itemLabel).filter(Boolean)
  : text(value) ? [text(value)] : [];
const arrayFromPayload = (payload: unknown): WgerItem[] => {
  if (Array.isArray(payload)) return payload as WgerItem[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as WgerItem;
  for (const key of ["data", "results", "exercises"]) {
    if (Array.isArray(record[key])) return record[key] as WgerItem[];
  }
  return [];
};
const exerciseDbMediaUrl = (value: unknown) => {
  const url = text(value);
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `https://oss.exercisedb.dev${url.startsWith("/") ? "" : "/"}${url}`;
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
    const normalizedQuery = query.toLocaleLowerCase("pt-BR");
    const alias = findAlias(normalizedQuery);
    const publicQuery = alias?.search ?? query;

    try {
      const exerciseDbUrl = new URL("https://oss.exercisedb.dev/api/v1/exercises");
      exerciseDbUrl.searchParams.set("name", publicQuery);
      exerciseDbUrl.searchParams.set("limit", "30");
      const exerciseDbResponse = await fetch(exerciseDbUrl, {
        headers: { Accept: "application/json", "User-Agent": "Evolua/1.0 (public exercise lookup)" },
        signal: AbortSignal.timeout(7000),
      });
      if (exerciseDbResponse.ok) {
        const items = arrayFromPayload(await exerciseDbResponse.json());
        const exerciseDbResults = items.flatMap((item, index) => {
          const originalName = text(item.name) || text(item.exerciseName);
          const normalizedOriginalName = originalName.toLocaleLowerCase("en");
          const name = alias
            ? normalizedOriginalName === publicQuery
              ? alias.name
              : `${alias.name} — ${originalName}`
            : originalName;
          if (!name) return [];
          const instructions = stringList(item.instructions)
            .flatMap((instruction) => instruction.split(/\n+/))
            .map((instruction) => instruction.trim())
            .filter(Boolean)
            .slice(0, 6);
          const gif = exerciseDbMediaUrl(item.gifUrl || item.gif_url || item.animationUrl);
          const video = exerciseDbMediaUrl(item.videoUrl || item.video_url);
          const image = exerciseDbMediaUrl(item.imageUrl || item.image_url || item.thumbnailUrl);
          const media = [
            video && { url: video, type: "video" as const, attribution: "ExerciseDB" },
            gif && { url: gif, type: "image" as const, attribution: "ExerciseDB" },
            image && { url: image, type: "image" as const, attribution: "ExerciseDB" },
          ].filter(Boolean).slice(0, 3);
          return [{
            id: text(item.exerciseId) || text(item.id) || `exercisedb-${index}`,
            name,
            muscle: [...stringList(item.targetMuscles || item.target), ...stringList(item.bodyParts || item.bodyPart)].join(", "),
            equipment: stringList(item.equipments || item.equipment).join(", "),
            instructions,
            media,
          }];
        }).sort((left, right) => {
          const leftOriginal = items.find((item) =>
            (text(item.exerciseId) || text(item.id)) === left.id);
          const rightOriginal = items.find((item) =>
            (text(item.exerciseId) || text(item.id)) === right.id);
          const score = (item?: WgerItem) => {
            const candidate = text(item?.name || item?.exerciseName).toLocaleLowerCase("en");
            if (candidate === publicQuery) return 0;
            if (candidate.startsWith(publicQuery)) return 1;
            if (candidate.includes(publicQuery)) return 2;
            return 3;
          };
          return score(leftOriginal) - score(rightOriginal);
        });
        if (exerciseDbResults.length) {
          response.status(200).json({ results: exerciseDbResults.slice(0, 8), source: "ExerciseDB" });
          return;
        }
      }
    } catch {
      // O wger abaixo mantém a busca funcionando quando a fonte principal oscila.
    }

    const url = new URL("https://wger.de/api/v2/exercisebaseinfo/");
    url.searchParams.set("limit", "30");
    url.searchParams.set("search", publicQuery);
    const upstream = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Evolua/1.0 (exercise media lookup)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error(`wger ${upstream.status}`);

    const payload = await upstream.json() as { results?: WgerItem[] };
    const normalized = (payload.results ?? []).flatMap((item) => {
      const exercises = Array.isArray(item.exercises) ? item.exercises as WgerItem[] : [];
      const matchingTranslation = exercises.find((exercise) =>
        text(exercise.name).toLocaleLowerCase("pt-BR").includes(normalizedQuery));
      const translated = matchingTranslation ?? exercises.find((exercise) => exercise.language === 2) ?? exercises[0] ?? item;
      const name = matchingTranslation ? text(translated.name) : alias?.name ?? (text(translated.name) || text(item.name));

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
        muscle: Array.isArray(item.muscles) ? item.muscles.map(itemLabel).filter(Boolean).join(", ") : "",
        equipment: Array.isArray(item.equipment) ? item.equipment.map(itemLabel).filter(Boolean).join(", ") : "",
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
