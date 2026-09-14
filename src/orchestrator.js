import { getDefaultAgents, pickBestAgent } from './agents.js';
import { generateWithOllama, getOllamaStatus } from './ollama.js';

function buildPlannerPrompt(taskText) {
  return `You are the planner agent. Decompose the following task into a practical engineering plan with 5 steps, delivery milestones, and validation criteria. Keep the answer concise but actionable.\n\nTask: ${taskText}`;
}

function buildReviewerPrompt(taskText) {
  return `You are the reviewer agent. Inspect the following task for likely bugs, risks, and unknowns. Return a short structured review with: issues, risks, and validation steps.\n\nTask: ${taskText}`;
}

function buildCoderPrompt(taskText) {
  return `You are the coding agent. Turn the following task into an implementation-ready change plan. Identify files to change, the intended behavior, edge cases, and validation commands. Do not claim to have edited files; return only the proposed implementation plan.\n\nTask: ${taskText}`;
}

export async function runAgentLLM(taskText, agentId) {
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
    reviewer: buildReviewerPrompt(taskText)
  };

  const prompt = promptMap[agentId];
  if (!prompt) {
    return {
      available: false,
      warning: 'LLM execution is only enabled for coder, planner, and reviewer agents.',
      agentId
    };
  }

  const llmResult = await generateWithOllama(prompt, process.env.OLLAMA_MODEL);
  return {
    available: true,
    agentId,
    model: llmResult.model,
    summary: llmResult.text,
    num_ctx: llmResult.num_ctx
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
    async run(taskText, options = {}) {
      const selected = this.route(taskText);
      const base = {
        task: taskText || 'No task provided',
        selectedAgent: selected.name,
        role: selected.role,
        responsibilities: selected.responsibilities,
        nextStep: `Execute the task in the ${selected.role} lane and validate the result.`
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
      llmEnabledAgents: ['planner', 'reviewer']
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
