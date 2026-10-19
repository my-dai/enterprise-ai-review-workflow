import { FieldName } from "./types.js";

export interface ReviewComment {
  id: string;
  field: FieldName;
  author: string;
  text: string;
  resolved: boolean;
}

export function openComments(comments: ReviewComment[], field?: FieldName): ReviewComment[] {
  return comments.filter((comment) => !comment.resolved && (!field || comment.field === field));
}

export function resolveComment(comments: ReviewComment[], id: string): ReviewComment[] {
  let found = false;
  const updated = comments.map((comment) => {
    if (comment.id !== id) return comment;
    found = true;
    return { ...comment, resolved: true };
  });
  if (!found) throw new Error(`Unknown review comment: ${id}`);
  return updated;
}

