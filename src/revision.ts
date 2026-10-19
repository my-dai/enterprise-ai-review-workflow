import { FieldName, FieldSuggestion, ReviewState } from "./types.js";

export function createReviewState(lesson: ReviewState["lesson"]): ReviewState {
  return { lesson: structuredClone(lesson), suggestions: {}, history: [] };
}

export function registerSuggestion(
  state: ReviewState,
  suggestion: FieldSuggestion,
): ReviewState {
  if (suggestion.original !== state.lesson[suggestion.field]) {
    throw new Error("Suggestion is stale for the current field value");
  }
  return {
    ...state,
    suggestions: { ...state.suggestions, [suggestion.field]: suggestion },
  };
}

export function applySuggestion(state: ReviewState, field: FieldName): ReviewState {
  const suggestion = state.suggestions[field];
  if (!suggestion) throw new Error(`No suggestion registered for ${field}`);

  const lesson = { ...state.lesson, [field]: suggestion.proposed };
  const suggestions = { ...state.suggestions };
  delete suggestions[field];
  return {
    lesson,
    suggestions,
    history: [
      ...state.history,
      { field, before: state.lesson[field], after: suggestion.proposed },
    ],
  };
}

export function undoLastRevision(state: ReviewState): ReviewState {
  const change = state.history.at(-1);
  if (!change) return state;
  return {
    ...state,
    lesson: { ...state.lesson, [change.field]: change.before },
    history: state.history.slice(0, -1),
  };
}

