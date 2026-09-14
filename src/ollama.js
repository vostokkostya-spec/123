const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'qwen3:4b-instruct';
const DEFAULT_OLLAMA_NUM_CTX = 8192;

export function resolveAgentModel(agentId, requestedModel) {
  if (requestedModel) return requestedModel;

  const roleEnv = {
    planner: 'OLLAMA_PLANNER_MODEL',
    coder: 'OLLAMA_CODER_MODEL',
    reviewer: 'OLLAMA_REVIEWER_MODEL',
    router: 'OLLAMA_ROUTER_MODEL'
  }[agentId];

  return (roleEnv && process.env[roleEnv]) || process.env.OLLAMA_MODEL || undefined;
}

export function resolveNumCtx() {
  const configured = Number.parseInt(process.env.OLLAMA_NUM_CTX || '', 10);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_OLLAMA_NUM_CTX;
}

export function pickPreferredModel(requestedModel, availableModels = []) {
  const explicitModel = requestedModel || process.env.OLLAMA_MODEL;
  if (explicitModel) {
    return explicitModel;
  }

  const chatModels = (availableModels || []).filter((name) => {
    const normalized = String(name).toLowerCase();
    return !/(embed|embedding|nomic|all-minilm)/.test(normalized);
  });

  const preferredOrder = ['qwen3:4b', 'qwen3:4b-instruct', 'gemma3:4b', 'gemma4:e2b', 'qwen3:8b', 'llama3.1:8b'];
  const preferredMatch = preferredOrder.find((preferredModel) =>
    chatModels.some((availableModel) => {
      const normalizedAvailable = availableModel.toLowerCase();
      const normalizedPreferred = preferredModel.toLowerCase();
      return normalizedAvailable === normalizedPreferred || normalizedAvailable.startsWith(`${normalizedPreferred}:`) || normalizedAvailable.includes(normalizedPreferred);
    })
  );

  if (preferredMatch) {
    return chatModels.find((availableModel) => {
      const normalizedAvailable = availableModel.toLowerCase();
      const normalizedPreferred = preferredMatch.toLowerCase();
      return normalizedAvailable === normalizedPreferred || normalizedAvailable.startsWith(`${normalizedPreferred}:`) || normalizedAvailable.includes(normalizedPreferred);
    }) || preferredMatch;
  }

  return chatModels[0] || DEFAULT_OLLAMA_MODEL;
}

async function fetchJson(url, options = {}) {
  const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 60000);
  const response = await fetch(url, { ...options, signal });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`HTTP ${response.status}: ${message || 'request failed'}`);
  }

  return response.json();
}

export async function getOllamaStatus() {
  try {
    const versionData = await fetchJson(`${OLLAMA_BASE_URL}/api/version`);
    const tagData = await fetchJson(`${OLLAMA_BASE_URL}/api/tags`);
    const models = Array.isArray(tagData?.models) ? tagData.models.map((item) => ({
      name: item.name,
      size: item.size ?? null,
      details: item.details ?? null
    })) : [];

    return {
      online: true,
      endpoint: OLLAMA_BASE_URL,
      version: versionData?.version || null,
      models: models.map((model) => model.name),
      modelDetails: models,
      summary: models.length ? `Connected. Available models: ${models.map((item) => item.name).join(', ')}` : 'Connected. No models listed yet.'
    };
  } catch (error) {
    return {
      online: false,
      endpoint: OLLAMA_BASE_URL,
      version: null,
      models: [],
      modelDetails: [],
      summary: `Ollama is unavailable: ${error.message}`,
      error: error.message
    };
  }
}

export async function generateWithOllama(prompt, model, options = {}) {
  const status = await getOllamaStatus();

  if (!status.online) {
    throw new Error(`${status.summary}. Start Ollama, then run: ollama serve or the relevant service command.`);
  }

  const selectedModel = pickPreferredModel(resolveAgentModel(options.agentId, model), status.models);
  const numCtx = resolveNumCtx();

  const payload = {
    model: selectedModel,
    prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.2,
      top_p: 0.9,
      num_ctx: numCtx,
      ...(options.numPredict ? { num_predict: options.numPredict } : {})
    }
  };

  const configuredTimeout = Number.parseInt(process.env.OLLAMA_TIMEOUT || '', 10);
  const timeoutMs = options.timeoutMs ?? (Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 60000);
  const response = await fetchJson(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeoutMs
  });

  return {
    model: selectedModel,
    num_ctx: numCtx,
    timeoutMs,
    text: response?.response || '',
    done: !!response?.done,
    status
  };
}
