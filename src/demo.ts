import { matchLibrary, suggestKeywords } from "./library.js";
import { applySuggestion, createReviewState, registerSuggestion } from "./revision.js";
import { LibraryReference, LessonRecord } from "./types.js";

const lesson: LessonRecord = {
  id: "draft-17",
  title: "Coordinate overhead work before installation",
  situation: "Two crews entered the same constrained area during installation.",
  rootCause: "The handoff did not include the latest access plan.",
  recommendation: "Review the access plan before work starts.",
  keywords: ["coordination", "installation"],
};

const library: LibraryReference[] = [
  {
    id: "library-4",
    title: "Trade coordination in constrained work areas",
    summary: "Use a shared access plan and confirm crew sequencing during the daily handoff.",
    keywords: ["coordination", "handoff", "sequencing"],
  },
  {
    id: "library-9",
    title: "Material delivery inspection",
    summary: "Check delivered material against the purchase order before storage.",
    keywords: ["delivery", "inspection"],
  },
];

const references = matchLibrary(lesson, library);
let state = createReviewState(lesson);
state = registerSuggestion(state, {
  field: "recommendation",
  original: lesson.recommendation,
  proposed: "Confirm the current access plan and crew sequence during the daily handoff.",
  reason: "Makes the owner and decision point explicit.",
  referenceIds: references.map((match) => match.reference.id),
});
state = applySuggestion(state, "recommendation");

console.log(
  JSON.stringify(
    {
      revisedLesson: state.lesson,
      references,
      suggestedKeywords: suggestKeywords(state.lesson, references),
      revisionHistory: state.history,
    },
    null,
    2,
  ),
);

