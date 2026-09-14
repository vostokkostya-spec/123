import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createOrchestrator, runDiagnosis } from './orchestrator.js';
import { buildReviewerPrompt, parseReviewerVerdict, runAgentLLM, runCodeAgent } from './orchestrator.js';
import { generateWithOllama, getOllamaStatus, resolveNumCtx } from './ollama.js';

const args = process.argv.slice(2);
const orchestrator = createOrchestrator();

function printHelp() {
  console.log(`Brain Orchestrator CLI

Usage:
  node src/index.js --diagnose
  node src/index.js route "fix auth bug"
  node src/index.js task "plan a release workflow"
  node src/index.js code "add input validation" --file src/example.js [--apply]
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

function parseCodeArgs(codeArgs) {
  const apply = codeArgs.includes('--apply');
  const fileIndex = codeArgs.indexOf('--file');
  const taskParts = codeArgs.filter((arg, index) => arg !== '--apply' && index !== fileIndex && index !== fileIndex + 1);
  return { apply, filePath: fileIndex >= 0 ? codeArgs[fileIndex + 1] : '', taskText: taskParts.join(' ').trim() };
}

function resolveWorkspaceFile(filePath) {
  const workspace = path.resolve(process.cwd());
  const resolved = path.resolve(workspace, filePath);
  const relative = path.relative(workspace, resolved);
  if (!filePath || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('--file must point to a path inside the current workspace.');
  }
  return { resolved, displayPath: relative.split(path.sep).join('/') };
}

async function confirmApply(filePath) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Refusing --apply in non-interactive mode. Run the command in a terminal and confirm the write interactively.');
  }

  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await input.question(`Apply generated changes to ${filePath}? [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    input.close();
  }
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

  if (args[0] === 'code') {
    const { apply, filePath, taskText } = parseCodeArgs(args.slice(1));
    if (!taskText || !filePath) {
      console.error('Usage: node src/index.js code "task" --file path/to/file [--apply]');
      process.exitCode = 1;
      return;
    }

    try {
      const target = resolveWorkspaceFile(filePath);
      let currentContent = '';
      try {
        currentContent = await fs.readFile(target.resolved, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      const generated = await runCodeAgent(taskText, target.displayPath, currentContent);
      if (!generated.available) {
        console.error(JSON.stringify(generated, null, 2));
        process.exitCode = 1;
        return;
      }

      const reviewer = await runAgentLLM(taskText, 'reviewer', {
        diff: generated.diff,
        prompt: buildReviewerPrompt(taskText, generated.diff),
        timeoutMs: 60000
      });
      const result = {
        command: 'code',
        file: generated.path,
        model: generated.model,
        timeoutMs: generated.timeoutMs,
        contextTruncated: generated.contextTruncated,
        warning: generated.contextTruncated ? 'Input file context was truncated to approximately 4500 tokens.' : undefined,
        explanation: generated.explanation,
        diff: generated.diff,
        reviewer: {
          ...reviewer,
          verdict: parseReviewerVerdict(reviewer.summary || '')
        }
      };

      console.log(JSON.stringify(result, null, 2));
      if (apply && await confirmApply(target.resolved)) {
        await fs.mkdir(path.dirname(target.resolved), { recursive: true });
        await fs.writeFile(target.resolved, generated.content, 'utf8');
        console.log(JSON.stringify({ applied: true, file: generated.path }, null, 2));
      } else if (apply) {
        console.log(JSON.stringify({ applied: false, reason: 'Confirmation declined.' }, null, 2));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({
        error: message,
        hint: 'Code generation uses a 300-second timeout. Reduce the file size or choose a smaller model if it times out.'
      }, null, 2));
      process.exitCode = 1;
    }
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
