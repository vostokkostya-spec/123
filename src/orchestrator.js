import { getDefaultAgents, getKeywordMatches, pickBestAgent } from './agents.js';
import { generateWithOllama, getOllamaStatus } from './ollama.js';

function buildPlannerPrompt(taskText) {
  return `You are the planner agent. Decompose the following task into a practical engineering plan with 5 steps, delivery milestones, and validation criteria. Keep the answer concise but actionable.\n\nTask: ${taskText}`;
}

export function buildReviewerPrompt(taskText, diff = '') {
  return `You are the reviewer agent. Inspect the task and proposed diff below. Start with exactly one verdict line: VERDICT: APPROVE or VERDICT: ISSUES. Then provide issues, risks, and validation steps. Do not claim files were changed.\n\nTask: ${taskText}\n\nProposed diff:\n${diff}`;
}

function buildCoderPrompt(taskText) {
  return `You are the coding agent. Turn the following task into an implementation-ready change plan. Identify files to change, the intended behavior, edge cases, and validation commands. Do not claim to have edited files; return only the proposed implementation plan.\n\nTask: ${taskText}`;
}

export function buildCodePrompt(taskText, filePath, currentContent) {
  return `You are the coding agent. Modify exactly one file based on the task below. Return only this format:\n### FILE: ${filePath}\n<complete new file content>\n### EXPLANATION\n<brief explanation>\nDo not use Markdown fences. Preserve correct existing code and return the complete file, not a partial patch. If the file is empty or missing, create it.\n\nTask: ${taskText}\n\nCurrent file content (may be empty):\n${currentContent}`;
}

export function truncateFileContext(content, maxTokens = 4500) {
  const maxCharacters = maxTokens * 4;
  if (content.length <= maxCharacters) return { content, truncated: false };
  return {
    content: `${content.slice(0, maxCharacters)}\n\n[Context truncated at approximately ${maxTokens} tokens]`,
    truncated: true
  };
}

export function parseCoderResponse(response, expectedPath) {
  const fileMarker = `### FILE: ${expectedPath}`;
  const markerIndex = response.indexOf(fileMarker);
  const explanationMarker = response.indexOf('### EXPLANATION', markerIndex + fileMarker.length);

  if (markerIndex < 0 || explanationMarker < 0) {
    throw new Error('Coder returned an invalid format: expected ### FILE and ### EXPLANATION markers.');
  }

  const content = response.slice(markerIndex + fileMarker.length, explanationMarker).replace(/^\r?\n/, '').trimEnd();
  const explanation = response.slice(explanationMarker + '### EXPLANATION'.length).trim();
  if (!content) {
    throw new Error('Coder returned an empty file content.');
  }

  return { path: expectedPath, content, explanation };
}

export function parseReviewerVerdict(response) {
  const match = response.match(/^\s*VERDICT:\s*(APPROVE|ISSUES)\b/im);
  return match ? match[1] : 'ISSUES';
}

export function buildRoutingPrompt(taskText, agents = getDefaultAgents()) {
  const descriptions = agents.map((agent) => `${agent.id}: ${agent.responsibilities[0]}`).join('\n');
  return `Classify the engineering task into exactly one agent. Return only this format:
### AGENT: <planner|coder|reviewer|security|ops>
### REASON: <one sentence>

Agents:
${descriptions}

Task: ${taskText}`;
}

export function parseRoutingResponse(response, agents = getDefaultAgents()) {
  const agentMatch = response.match(/^\s*###\s*AGENT:\s*([a-z]+)\s*$/im);
  const reasonMatch = response.match(/^\s*###\s*REASON:\s*(.+)$/im);
  const agentId = agentMatch?.[1]?.toLowerCase();
  if (!agentId || !agents.some((agent) => agent.id === agentId) || !reasonMatch?.[1]?.trim()) {
    throw new Error('Router returned an invalid format: expected ### AGENT and ### REASON markers.');
  }
  return { agentId, reason: reasonMatch[1].trim() };
}

export async function classifyTask(taskText, agents = getDefaultAgents()) {
  try {
    const result = await runAgentLLM(taskText, 'router', {
      prompt: buildRoutingPrompt(taskText, agents),
      timeoutMs: 60000,
      temperature: 0,
      numPredict: 120
    });
    if (!result.available) {
      return { available: false, warning: result.warning || result.summary };
    }
    return { available: true, ...parseRoutingResponse(result.summary, agents), model: result.model };
  } catch (error) {
    return {
      available: false,
      warning: error instanceof Error ? error.message : String(error)
    };
  }
}

function createDiff(oldContent, newContent, filePath) {
  const oldLines = oldContent.split(/\r?\n/);
  const newLines = newContent.split(/\r?\n/);
  const lines = [`--- a/${filePath}`, `+++ b/${filePath}`];
  const max = Math.max(oldLines.length, newLines.length);

  for (let index = 0; index < max; index += 1) {
    if (oldLines[index] === newLines[index]) {
      lines.push(` ${oldLines[index] ?? ''}`);
    } else {
      if (oldLines[index] !== undefined) lines.push(`-${oldLines[index]}`);
      if (newLines[index] !== undefined) lines.push(`+${newLines[index]}`);
    }
  }

  return lines.join('\n');
}

export async function runAgentLLM(taskText, agentId, options = {}) {
  const status = await getOllamaStatus();

  if (!status.online) {
    return {
      available: false,
      warning: 'Ollama unavailable',
      summary: status.summary,
      agentId
    };
  }

  const promptMap = {
    coder: buildCoderPrompt(taskText),
    planner: buildPlannerPrompt(taskText),
    reviewer: buildReviewerPrompt(taskText, options.diff)
  };

  const prompt = options.prompt || promptMap[agentId];
  if (!prompt) {
    return {
      available: false,
      warning: 'LLM execution is only enabled for coder, planner, and reviewer agents.',
      agentId
    };
  }

  const llmResult = await generateWithOllama(prompt, undefined, {
    agentId,
    timeoutMs: options.timeoutMs ?? 60000,
    numPredict: options.numPredict,
    temperature: options.temperature
  });
  return {
    available: true,
    agentId,
    model: llmResult.model,
    summary: llmResult.text,
    num_ctx: llmResult.num_ctx,
    timeoutMs: llmResult.timeoutMs
  };
}

export async function runCodeAgent(taskText, filePath, currentContent) {
  const configuredTimeout = Number.parseInt(process.env.OLLAMA_TIMEOUT || '', 10);
  const context = truncateFileContext(currentContent);
  const result = await runAgentLLM(taskText, 'coder', {
    prompt: buildCodePrompt(taskText, filePath, context.content),
    timeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 300000,
    numPredict: 3000
  });
  if (!result.available) return result;

  const parsed = parseCoderResponse(result.summary, filePath);
  return {
    ...result,
    ...parsed,
    contextTruncated: context.truncated,
    diff: createDiff(currentContent, parsed.content, filePath)
  };
}

export function createOrchestrator() {
  const agents = getDefaultAgents();

  return {
    agents,
    route(taskText) {
      const selectedId = pickBestAgent(taskText);
      return agents.find((agent) => agent.id === selectedId) ?? agents[0];
    },
    async routeTask(taskText, options = {}) {
      const keywordMatches = getKeywordMatches(taskText);
      const keywordAgent = this.route(taskText);
      if (!options.forceLLM && keywordMatches.length === 1) {
        return { agent: keywordAgent, routing: 'keyword', reason: 'single unambiguous keyword match' };
      }

      const classified = await classifyTask(taskText, agents);
      if (classified.available) {
        const agent = agents.find((candidate) => candidate.id === classified.agentId);
        return { agent: agent ?? keywordAgent, routing: 'llm', reason: classified.reason, model: classified.model };
      }

      return {
        agent: keywordAgent,
        routing: 'keyword',
        warning: `LLM routing unavailable; using keyword fallback. ${classified.warning || ''}`.trim()
      };
    },
    async run(taskText, options = {}) {
      const selectedRoute = options.route ?? await this.routeTask(taskText, { forceLLM: options.forceLLM });
      const selected = selectedRoute.agent;
      const base = {
        task: taskText || 'No task provided',
        selectedAgent: selected.name,
        role: selected.role,
        responsibilities: selected.responsibilities,
        nextStep: `Execute the task in the ${selected.role} lane and validate the result.`,
        routing: selectedRoute
      };

      if (!options.useLLM || !['coder', 'planner', 'reviewer'].includes(selected.id)) {
        return base;
      }

      const llm = await runAgentLLM(taskText, selected.id);
      return { ...base, llm };
    }
  };
}

export function runDiagnosis() {
  return {
    repoStatus: 'empty workspace',
    summary: 'The repository currently contains only the initial README and no app code, build system, tests, or package manifests.',
    environment: {
      ide: 'VS Code / Visual Studio',
      codeHost: 'GitHub',
      localModelRuntime: 'Ollama (optional)',
      agents: ['Codex', 'Copilot', 'specialized agents'],
      llmEnabledAgents: ['coder', 'planner', 'reviewer']
    },
    recommendations: [
      'Initialize a Node.js project for the orchestration layer.',
      'Add a repo-level workflow for planning, coding, review, and security tasks.',
      'Connect VS Code, GitHub, and Ollama as separate layers in the stack.',
      'Keep the orchestration agent as the single decision-maker for task routing.',
      'Use coder, planner, and reviewer agents with Ollama-backed prompts, while keeping security/ops rules-based unless a stronger LLM strategy is needed.'
    ]
  };
}
