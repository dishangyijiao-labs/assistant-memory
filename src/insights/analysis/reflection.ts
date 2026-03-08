import type { PromptIssue, ReflectionPrompt } from "../types/index.js";

const PATTERN_REFLECTIONS: Record<string, ReflectionPrompt> = {
  "Vague goal": {
    question: "When you wrote a short, open-ended prompt, what were you actually trying to achieve? Could you have named that goal in one concrete sentence before typing?",
    hint: "Try finishing: \"I want X so that Y, and I'll know it worked when Z.\"",
  },
  "Missing constraints": {
    question: "In sessions where the AI overshot the scope, what invisible assumptions did you bring in but not state? What would you add as a 'must not' next time?",
    hint: "Constraints turn guesses into specs. Write at least two 'must' or 'must not' lines before sending.",
  },
  "No acceptance criteria": {
    question: "For outputs that disappointed you, what would a simple pass/fail test look like? Could you have written that test before asking the question?",
    hint: "If you can't describe what 'done' looks like in one sentence, the prompt isn't ready yet.",
  },
  "No output format": {
    question: "When you received a wall of text you didn't need, what format would have served you better? Why didn't you ask for it — was it unclear to you too?",
    hint: "Add one line: 'Return as a numbered list / markdown table / JSON object.'",
  },
};

const GENERAL_REFLECTIONS: ReflectionPrompt[] = [
  {
    question: "Look at the session where you asked the most follow-up questions. What was missing from your first prompt that caused the chain? What would you say differently now?",
    hint: "Every follow-up is a clue. Treat it as a spec you forgot to write.",
  },
  {
    question: "When the AI gave you a useful answer, what did that prompt have that others didn't? Can you extract a template from it?",
    hint: "Your best prompts are your most underused resource. Formalize them.",
  },
  {
    question: "Where did you accept a mediocre answer instead of pushing back? What held you back from asking for a better version?",
    hint: "\"Improve the previous answer by adding X\" is always a valid follow-up.",
  },
];

export function generateReflectionPrompts(topIssues: PromptIssue[]): ReflectionPrompt[] {
  const prompts: ReflectionPrompt[] = [];

  for (const issue of topIssues) {
    const reflection = PATTERN_REFLECTIONS[issue.issue];
    if (reflection) prompts.push(reflection);
  }

  // Fill up to 5 with general reflections
  for (const g of GENERAL_REFLECTIONS) {
    if (prompts.length >= 5) break;
    prompts.push(g);
  }

  return prompts.slice(0, 5);
}
