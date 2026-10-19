export type FieldName = "title" | "situation" | "rootCause" | "recommendation";

export interface LessonRecord {
  id: string;
  title: string;
  situation: string;
  rootCause: string;
  recommendation: string;
  keywords: string[];
}

export interface LibraryReference {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
}

export interface FieldSuggestion {
  field: FieldName;
  original: string;
  proposed: string;
  reason: string;
  referenceIds: string[];
}

export interface ReviewState {
  lesson: LessonRecord;
  suggestions: Partial<Record<FieldName, FieldSuggestion>>;
  history: Array<{ field: FieldName; before: string; after: string }>;
}

