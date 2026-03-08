/**
 * Plan-to-models mapping for Bizu (client-side mirror of server config).
 */
const planModels: Record<string, string[]> = {
  free: [
    'deepseek/deepseek-v3.2',
    'deepseek/deepseek-chat-v3-0324:free',
    'meta-llama/llama-4-maverick:free',
    'qwen/qwen3-235b-a22b:free',
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-24b-instruct-2501',
  ],
  premium: [
    // Includes all free models
    'deepseek/deepseek-v3.2',
    'deepseek/deepseek-chat-v3-0324:free',
    'meta-llama/llama-4-maverick:free',
    'qwen/qwen3-235b-a22b:free',
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-24b-instruct-2501',
    // Premium-only models
    'google/gemini-2.5-flash',
    'google/gemini-2.5-flash-lite',
    'x-ai/grok-4.1-fast',
    'anthropic/claude-haiku-4.5',
    'qwen/qwen3.5-plus-02-15',
    'deepseek/deepseek-r1',
    'mistralai/mistral-small-3.1-24b-instruct',
    'z-ai/glm-4.7',
  ],
  pro_global: ['*'],
};

export function isModelAllowedForPlan(plan: string | undefined, model: string): boolean {
  const allowed = planModels[plan ?? 'free'] ?? planModels.free;
  if (allowed.includes('*')) {
    return true;
  }
  return allowed.includes(model);
}

export function getAllowedModelsForPlan(plan: string | undefined): string[] {
  return planModels[plan ?? 'free'] ?? planModels.free;
}

export function getPreferredModelForPlan(
  plan: string | undefined,
  availableModels: string[],
): string | null {
  const allowed = getAllowedModelsForPlan(plan);

  if (allowed.includes('*')) {
    return availableModels[0] ?? null;
  }

  for (const model of allowed) {
    if (availableModels.includes(model)) {
      return model;
    }
  }

  return null;
}
