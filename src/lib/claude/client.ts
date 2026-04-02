import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callClaude(params: {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await anthropic.messages.create({
    model: params.model ?? "claude-sonnet-4-20250514",
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map(block => block.text)
    .join("\n");
}

// Use Opus for deep research memos (higher cost, higher quality)
export async function callClaudeDeep(system: string, prompt: string): Promise<string> {
  return callClaude({
    system,
    prompt,
    model: "claude-opus-4-20250514",
    maxTokens: 8192,
  });
}
