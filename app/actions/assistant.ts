"use server";

import { askAssistant, type AssistantResult } from "@/lib/assistant";
import { requireUser } from "@/lib/session";

export type AssistantState = AssistantResult & { error?: string };

/**
 * Runs a plain-English request through the Ask assistant (lib/assistant.ts).
 * Every call to an external service here is wrapped so a failure shows a
 * plain-English message instead of a crash (requirement 3) — same rule as
 * every other call into lib/cognitivo.ts.
 */
export async function askAssistantAction(
  _previous: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  await requireUser();
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { reply: "" };

  try {
    return await askAssistant(question);
  } catch (error) {
    console.error("askAssistant failed:", error);
    return { reply: "", error: "Something went wrong reaching the assistant. Please try again." };
  }
}
