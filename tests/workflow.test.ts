import test from "node:test";
import assert from "node:assert/strict";

import { openComments, resolveComment } from "../src/followup.js";
import { matchLibrary, suggestKeywords } from "../src/library.js";
import {
  applySuggestion,
  createReviewState,
  registerSuggestion,
  undoLastRevision,
} from "../src/revision.js";
import { LessonRecord } from "../src/types.js";

const lesson: LessonRecord = {
  id: "draft",
  title: "Coordinate installation access",
  situation: "Crews used the same work area.",
  rootCause: "The access handoff was incomplete.",
  recommendation: "Review access before work.",
  keywords: ["coordination"],
};

test("applies and undoes a field-level suggestion", () => {
  let state = createReviewState(lesson);
  state = registerSuggestion(state, {
    field: "recommendation",
    original: lesson.recommendation,
    proposed: "Confirm the access plan during the daily handoff.",
    reason: "Adds a concrete decision point.",
    referenceIds: ["ref-1"],
  });
  state = applySuggestion(state, "recommendation");
  assert.equal(state.lesson.recommendation, "Confirm the access plan during the daily handoff.");
  state = undoLastRevision(state);
  assert.equal(state.lesson.recommendation, lesson.recommendation);
});

test("rejects a stale suggestion", () => {
  const state = createReviewState(lesson);
  assert.throws(
    () =>
      registerSuggestion(state, {
        field: "title",
        original: "older title",
        proposed: "new title",
        reason: "test",
        referenceIds: [],
      }),
    /stale/,
  );
});

test("ranks references and proposes new keywords", () => {
  const references = matchLibrary(lesson, [
    {
      id: "ref-1",
      title: "Crew coordination and access handoffs",
      summary: "Confirm work-area access and sequencing during handoff.",
      keywords: ["coordination", "handoff", "sequencing"],
    },
    {
      id: "ref-2",
      title: "Concrete curing",
      summary: "Track temperature during curing.",
      keywords: ["concrete"],
    },
  ]);
  assert.equal(references[0].reference.id, "ref-1");
  assert.deepEqual(suggestKeywords(lesson, references), ["handoff", "sequencing"]);
});

test("keeps review comments attached to their field", () => {
  const comments = [
    { id: "1", field: "rootCause" as const, author: "reviewer", text: "Add evidence", resolved: false },
    { id: "2", field: "title" as const, author: "reviewer", text: "Be specific", resolved: false },
  ];
  assert.equal(openComments(comments, "rootCause").length, 1);
  assert.equal(openComments(resolveComment(comments, "1")).length, 1);
});

