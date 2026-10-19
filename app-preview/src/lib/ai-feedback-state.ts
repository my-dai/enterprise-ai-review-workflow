// Keep optional AI results separate from the author's current text.
export interface LessonText {
  title: string; situation: string; rootCause: string; impact: string; recommendation: string;
}

export function lessonTextVersion(form: LessonText): string {
  return JSON.stringify([form.title, form.situation, form.rootCause, form.impact, form.recommendation]);
}

export function parseKeywords(text: string): string[] {
  const seen = new Set<string>();
  return text.split(/[,;\n]+/)
    .map((part) => part.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["'“”]+|["'“”.]+$/g, '').trim())
    .filter((part) => part && part.length <= 60 && !seen.has(part.toLowerCase()) && seen.add(part.toLowerCase()));
}

export function mergeKeywords(current: string, suggestions: string): string {
  return parseKeywords(current + ', ' + suggestions).join(', ');
}

// These are known service-status messages, not a general semantic validator.
// A structured status/keywords response from the Flow is still the preferred contract.
export function requireAgentContent(text: string): string {
  if (!text.trim() || /^(?:(?:this|the) (?:agent|service) is (?:currently )?unavailable|service unavailable|error\s*:|contentfiltered\b|(?:rate|usage) limit (?:reached|exceeded)|quota exceeded|too many requests)/i.test(text.trim())) {
    throw new Error('The AI service did not return usable suggestions. Your text has not been changed. Try again later.');
  }
  return text;
}
