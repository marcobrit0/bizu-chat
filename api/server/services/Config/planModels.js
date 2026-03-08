/**
 * Plan-to-models mapping for Bizu.
 *
 * Each plan lists the OpenRouter model IDs that users on that plan can access.
 * Higher plans inherit all models from lower plans.
 */
const planModels = {
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
  pro_global: ['*'], // all models
};

/**
 * Check if a user's plan allows access to a specific model.
 * @param {string} plan - The user's plan ('free', 'premium', 'pro_global')
 * @param {string} model - The OpenRouter model ID
 * @returns {boolean}
 */
function isModelAllowedForPlan(plan, model) {
  const allowed = planModels[plan] || planModels.free;
  if (allowed.includes('*')) {
    return true;
  }
  return allowed.includes(model);
}

/**
 * Get the list of allowed model IDs for a plan.
 * @param {string} plan
 * @returns {string[]}
 */
function getAllowedModelsForPlan(plan) {
  return planModels[plan] || planModels.free;
}

module.exports = {
  planModels,
  isModelAllowedForPlan,
  getAllowedModelsForPlan,
};
