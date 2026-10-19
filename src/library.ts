import { LibraryReference, LessonRecord } from "./types.js";

function tokens(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(words.filter((word) => word.length > 2));
}

function overlap(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((word) => right.has(word)).length;
  return intersection / Math.sqrt(left.size * right.size);
}

export interface ReferenceMatch {
  reference: LibraryReference;
  score: number;
  duplicateRisk: "low" | "review";
}

export function matchLibrary(
  lesson: LessonRecord,
  library: LibraryReference[],
  limit = 3,
): ReferenceMatch[] {
  const query = tokens(
    [lesson.title, lesson.situation, lesson.rootCause, lesson.recommendation, ...lesson.keywords].join(
      " ",
    ),
  );

  return library
    .map((reference) => {
      const document = tokens(
        [reference.title, reference.summary, ...reference.keywords].join(" "),
      );
      const score = overlap(query, document);
      return {
        reference,
        score: Number(score.toFixed(3)),
        duplicateRisk: score >= 0.55 ? ("review" as const) : ("low" as const),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function suggestKeywords(
  lesson: LessonRecord,
  references: ReferenceMatch[],
  limit = 5,
): string[] {
  const existing = new Set(lesson.keywords.map((keyword) => keyword.toLowerCase()));
  const weighted = new Map<string, number>();
  for (const match of references) {
    for (const keyword of match.reference.keywords) {
      const normalized = keyword.toLowerCase();
      if (!existing.has(normalized)) {
        weighted.set(normalized, (weighted.get(normalized) ?? 0) + match.score);
      }
    }
  }
  return [...weighted.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

