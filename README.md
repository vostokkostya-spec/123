# Brain Orchestrator Scaffold

This repository is a minimal but usable orchestration layer for a modern AI-development stack:

- IDE: VS Code / Visual Studio
- Platform: GitHub repo, PRs, issues, Actions
- Model runtime: OpenAI / Claude / local Ollama
- Coding agents: Codex, Copilot, task-specific agents
- Orchestrator: this project

The repository is intentionally small and focused on the orchestration logic and workflow structure.

## Architecture

```text
Human
  └─ VS Code / Visual Studio / GitHub UI
        └─ Agent stack
             ├─ Planner Agent
             ├─ Coding Agent
             ├─ Review Agent
             ├─ Security Agent
             ├─ Ops Agent
             └─ Orchestrator (this project)
                   ├─ local model routing
                   ├─ GitHub workflow checks
                   └─ task delegation and validation
```

For file changes, the safe flow is:

```text
task → coder (LLM) → diff → reviewer (LLM) → manual confirmation → apply
```

## Quick start

```bash
node src/index.js --diagnose
node src/index.js route "Fix the login bug in the payment flow"
node src/index.js route "Classify this ambiguous task" --llm
node src/index.js task "Plan a release workflow"
node src/index.js code "Add input validation" --file src/example.js
node src/index.js ollama-status
```

The `code` command never writes files by default. It reads the requested file (or treats it as new), limits the model context to approximately 4,500 tokens, prints a proposed diff and reviewer result, and only asks to write after `--apply` is explicitly supplied:

```bash
node src/index.js code "Add input validation" --file src/example.js --apply
```

Code generation uses a 300-second timeout by default; set `OLLAMA_TIMEOUT` to override it for `code`. Planner and reviewer requests use 60 seconds. The model receives `num_ctx=8192` and a response budget of up to 3,000 tokens.

## Hybrid routing

`route` uses a fast keyword path for one unambiguous match. Ambiguous tasks, or any task passed with `--llm`, are classified by Ollama with `temperature=0` and the strict `### AGENT` / `### REASON` format. Invalid output, timeout, connection errors, or unavailable Ollama fall back to keyword routing and never break the command.

## Ollama integration

If you have Ollama installed locally, this project can check the runtime and generate responses automatically.

```bash
OLLAMA_MODEL=llama3.1:8b node src/index.js ollama-status
OLLAMA_MODEL=llama3.1:8b node src/index.js ollama-prompt "Explain the project architecture"
```

Role-specific model overrides are supported with `OLLAMA_PLANNER_MODEL`,
`OLLAMA_CODER_MODEL`, `OLLAMA_REVIEWER_MODEL`, and `OLLAMA_ROUTER_MODEL`.
See `docs/MODEL-MATRIX.md` before assigning a cloud model; cloud inference
requires Ollama authentication and sends prompt context off the machine.

## CI workflow

This repo includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs on push and pull requests.

## Recommended stack

1. Use VS Code or Visual Studio as the primary IDE.
2. Use GitHub for repos, code review, and automation.
3. Connect local or hosted LLM models through Ollama if you need offline or private inference.
4. Keep a single orchestration layer responsible for routing, validation, and task control.
