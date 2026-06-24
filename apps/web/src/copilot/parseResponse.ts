export type ParsedCopilotResponse = {
  reply: string;
  actions: unknown[];
};

export type ParseCopilotResponseError = {
  error: string;
};

function extractJsonObject(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return text.slice(start, end + 1);
  }

  return text.trim();
}

/** Parse model text into { reply, actions }. Tolerates markdown code fences around JSON. */
export function parseCopilotResponse(
  text: string,
): ParsedCopilotResponse | ParseCopilotResponseError {
  const jsonText = extractJsonObject(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { error: "Copilot response was not valid JSON." };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { error: "Copilot response must be a JSON object with reply and actions." };
  }

  const record = parsed as Record<string, unknown>;
  const reply = typeof record["reply"] === "string" ? record["reply"] : "";
  const actions = Array.isArray(record["actions"]) ? record["actions"] : [];

  return { reply, actions };
}
