import { createOrchestrator, runDiagnosis } from './orchestrator.js';
import { generateWithOllama, getOllamaStatus, resolveNumCtx } from './ollama.js';

const args = process.argv.slice(2);
const orchestrator = createOrchestrator();

function printHelp() {
  console.log(`Brain Orchestrator CLI

Usage:
  node src/index.js --diagnose
  node src/index.js route "fix auth bug"
  node src/index.js task "plan a release workflow"
  node src/index.js ollama-status
  node src/index.js ollama-prompt "hello" [model]
  node src/index.js --help
`);
}

function handleLlmUnavailable() {
  const status = { online: false, endpoint: 'http://localhost:11434', warning: 'Ollama is not available.', hint: 'Start Ollama and download a chat model before using LLM commands.' };
  console.log(JSON.stringify(status, null, 2));
  return status;
}

async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--diagnose') || args[0] === 'diagnose') {
    console.log(JSON.stringify(runDiagnosis(), null, 2));
    return;
  }

  if (args[0] === 'route') {
    const taskText = args.slice(1).join(' ') || 'Plan the next engineering step for this repository.';
    const routeResult = await orchestrator.run(taskText);
    const ollamaStatus = await getOllamaStatus();

    if (!ollamaStatus.online) {
      console.log(JSON.stringify({ ...routeResult, warning: 'LLM is unavailable; route remains keyword-based until Ollama is running.', num_ctx: resolveNumCtx() }, null, 2));
      return;
    }

    console.log(JSON.stringify({ ...routeResult, ollama: ollamaStatus }, null, 2));
    return;
  }

  if (args[0] === 'task') {
    const taskText = args.slice(1).join(' ') || 'Plan the next engineering step for this repository.';
    const result = await orchestrator.run(taskText, { useLLM: true });
    console.log(JSON.stringify({ ...result, stack: 'VS Code + GitHub + Codex + Copilot + Ollama + orchestrator', num_ctx: resolveNumCtx() }, null, 2));
    return;
  }

  if (args[0] === 'ollama-status') {
    const status = await getOllamaStatus();
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  if (args[0] === 'ollama-prompt') {
    const prompt = args.slice(1).join(' ');
    const model = process.env.OLLAMA_MODEL;

    if (!prompt) {
      console.error('Provide a prompt text after the command.');
      process.exitCode = 1;
      return;
    }

    try {
      const text = await generateWithOllama(prompt, model);
      console.log(JSON.stringify(text, null, 2));
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ error: message, hint: 'Start Ollama, then download a chat model like qwen3:4b or gemma3:4b.', num_ctx: resolveNumCtx() }, null, 2));
      process.exitCode = 1;
      return;
    }
  }

  const taskText = args.join(' ') || 'Plan the next engineering step for this repository.';
  const result = await orchestrator.run(taskText, { useLLM: false });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ error: message, hint: 'Start Ollama and verify it is listening on http://localhost:11434.', num_ctx: resolveNumCtx() }, null, 2));
  process.exitCode = 1;
});
