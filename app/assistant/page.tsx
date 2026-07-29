import { AssistantForm } from "@/components/AssistantForm";
import { requireUser } from "@/lib/session";

/**
 * The Ask page (requirement: plain-English requests over the real
 * catalogue). See lib/assistant.ts for the tool-use loop and the safety
 * boundary — the assistant can only stage a suggestion, never buy for real.
 */
export default async function AssistantPage() {
  await requireUser(); // the route guard (M2)

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
      <p className="mt-2 text-sm text-stone-500">
        Describe what you&apos;re looking for in plain English — the assistant searches the real
        catalogue and can suggest one item for you to review and buy yourself.
      </p>

      <div className="mt-6">
        <AssistantForm />
      </div>
    </div>
  );
}
