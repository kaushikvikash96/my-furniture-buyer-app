/**
 * The "Ask" assistant — lets a logged-in buyer type a plain-English request
 * ("something cheap for a small kitchen", "a black bookcase") and have an
 * LLM reason over the shop's real catalogue to answer it.
 *
 * Server-side only. Talks to an Azure OpenAI deployment (see .env) with the
 * built-in fetch — no SDK, same convention as lib/cognitivo.ts.
 *
 * The model gets three read-only tools over the real catalogue/balance, plus
 * one terminal `recommend_product` tool it can call to suggest a specific
 * item. It can never place a real order itself — recommend_product only
 * stages a suggestion; the actual purchase still goes through the existing,
 * separately-verified buyNow action (app/actions/orders.ts) behind a manual
 * click, exactly like every other real order in this app.
 *
 * The shop's catalogue search has no free-text/fuzzy matching (see
 * app/catalogue/page.tsx) — only an exact category match and a substring
 * match on product name. So for anything the tool can't filter on ("cheap",
 * a colour, a vibe) the system prompt tells the model to fetch broadly and
 * apply that judgment itself over the plain results, rather than expecting
 * the tool to understand it.
 */

import {
  buildDescription,
  buildName,
  cognitivoUserId,
  fetchAllProducts,
  fetchProductById,
  fetchUserBalance,
  toCents,
  type CatalogItem,
} from "@/lib/cognitivo";
import { formatCents } from "@/lib/money";

function credentials() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!endpoint || !apiVersion || !deployment || !apiKey) {
    throw new Error(
      "AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT and AZURE_OPENAI_API_KEY must be set. Copy .env.example to .env and fill them in.",
    );
  }
  return { endpoint, apiVersion, deployment, apiKey };
}

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_catalogue",
      description:
        "Search the shop's live catalogue. Filters are literal, not fuzzy: category must exactly match one of the shop's category names, and nameContains is a plain case-insensitive substring match on the product name only. There is no price, colour, or style/vibe filter. Each result includes its price and colours, so when the request needs that kind of judgment, fetch a broad set of candidates and decide yourself from the returned fields.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Exact category name, e.g. 'Chairs'. Omit to search every category.",
          },
          nameContains: {
            type: "string",
            description: "Case-insensitive substring to match against product names. Omit to not filter by name.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product",
      description:
        "Look up one product's full details by its exact item ID, as returned by search_catalogue. Cannot look up a product by name.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" } },
        required: ["itemId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_balance",
      description:
        "Return the real, current balance of the one shop account this app is wired to. There is only one account — this cannot check any other user's balance.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_product",
      description:
        "End your turn by staging ONE specific purchase suggestion for the user to review. This does NOT place a real order — it only shows the user a card with a manual Buy button; nothing is purchased until they click it themselves. Only call this with an itemId you actually saw in a search_catalogue or get_product result — never invent or guess one. If nothing in the catalogue is a good enough match, don't call this tool at all; just say so in your reply.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          reason: {
            type: "string",
            description: "One sentence on why this item fits the user's request.",
          },
        },
        required: ["itemId", "reason"],
      },
    },
  },
] as const;

const SYSTEM_PROMPT = `You are a shopping assistant for a furniture shop's real catalogue and real account.

You have three lookup tools (search_catalogue, get_product, check_balance) and one staging tool (recommend_product). You cannot place a real order yourself under any circumstances — only the human clicking "Buy" in the app can do that.

The shop's search only supports an exact category match and a substring match on product name. It cannot filter by price, colour, or style. When the user's request needs that kind of judgment ("cheap", a colour, a vibe), first fetch a reasonably broad set of candidates with search_catalogue (by category if one is implied, otherwise unfiltered), then apply the judgment yourself by reading each candidate's price and colours — the tool will never do that filtering for you.

Keep your final reply short and in plain English. If you recommend a specific item, call recommend_product with its exact item ID; otherwise just explain what you found or why nothing fit.`;

type CandidateProduct = {
  itemId: string;
  name: string;
  category: string;
  price: string;
  colours: string[];
  dimensionsCm: { width: number | null; height: number | null; depth: number | null };
};

function toCandidateProduct(item: CatalogItem): CandidateProduct {
  return {
    itemId: item.item_id,
    name: buildName(item),
    category: (item.category ?? "Uncategorised").trim(),
    price: formatCents(toCents(item.price)),
    colours: (item.colours ?? []).filter(Boolean),
    dimensionsCm: { width: item.width, height: item.height, depth: item.depth },
  };
}

const MAX_SEARCH_RESULTS = 40;

async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search_catalogue": {
      const category = typeof args.category === "string" ? args.category.trim().toLowerCase() : undefined;
      const nameContains = typeof args.nameContains === "string" ? args.nameContains.toLowerCase() : undefined;
      const all = await fetchAllProducts();
      const filtered = all.filter(
        (item) =>
          (!category || (item.category ?? "").trim().toLowerCase() === category) &&
          (!nameContains || buildName(item).toLowerCase().includes(nameContains)),
      );
      const truncated = filtered.length > MAX_SEARCH_RESULTS;
      return {
        matchCount: filtered.length,
        results: filtered.slice(0, MAX_SEARCH_RESULTS).map(toCandidateProduct),
        note: truncated
          ? `Only the first ${MAX_SEARCH_RESULTS} of ${filtered.length} matches are shown — narrow with category or nameContains if you need a different slice.`
          : undefined,
      };
    }
    case "get_product": {
      const itemId = String(args.itemId ?? "");
      const item = await fetchProductById(itemId);
      if (!item) return { found: false };
      return { found: true, product: toCandidateProduct(item), description: buildDescription(item) };
    }
    case "check_balance": {
      const balance = await fetchUserBalance(cognitivoUserId());
      return { balance: formatCents(balance.balanceCents) };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export type AssistantRecommendation = {
  itemId: string;
  name: string;
  priceCents: number;
  reason: string;
};

export type AssistantResult = {
  reply: string;
  recommendation?: AssistantRecommendation;
};

async function callModel(messages: ChatMessage[]) {
  const { endpoint, apiVersion, deployment, apiKey } = credentials();
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_completion_tokens: 2048,
    }),
  });
  if (!res.ok) {
    throw new Error(`Azure OpenAI request failed: ${res.status} ${await res.text()}`);
  }
  const data: { choices: { message: ChatMessage }[] } = await res.json();
  return data.choices[0].message;
}

const MAX_TURNS = 6;

/** Runs the tool-use loop against Azure OpenAI. Throws on failure — the
 * caller (app/actions/assistant.ts) is responsible for the try/catch and
 * plain-English error message, per requirement 3. */
export async function askAssistant(question: string): Promise<AssistantResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const message = await callModel(messages);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { reply: message.content?.trim() || "I didn't find anything to say — try rephrasing your request." };
    }

    // recommend_product is terminal — it's a staged suggestion, not a real
    // lookup, so there's no tool result to send back in the normal sense.
    const recommendCall = message.tool_calls.find((c) => c.function.name === "recommend_product");
    if (recommendCall) {
      const args = JSON.parse(recommendCall.function.arguments) as { itemId: string; reason: string };
      const item = await fetchProductById(args.itemId).catch(() => null);
      if (!item) {
        // Model named an item ID that doesn't actually exist — don't stage a
        // broken recommendation; make it look again.
        messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });
        messages.push({
          role: "tool",
          tool_call_id: recommendCall.id,
          content: `Item ID "${args.itemId}" was not found in the real catalogue. Search again and only recommend an item ID you actually saw in a result.`,
        });
        continue;
      }
      return {
        reply: message.content?.trim() || `I'd suggest ${buildName(item)}.`,
        recommendation: {
          itemId: item.item_id,
          name: buildName(item),
          priceCents: toCents(item.price),
          reason: args.reason,
        },
      };
    }

    messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls });

    for (const call of message.tool_calls) {
      let result: unknown;
      try {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        result = await runTool(call.function.name, args);
      } catch (error) {
        result = { error: error instanceof Error ? error.message : "Tool call failed." };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return { reply: "I wasn't able to finish looking into that — try a more specific request." };
}
