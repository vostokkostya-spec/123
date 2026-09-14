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

## Quick start

```bash
node src/index.js --diagnose
node src/index.js route "Fix the login bug in the payment flow"
node src/index.js task "Plan a release workflow"
node src/index.js ollama-status
```

## Ollama integration

If you have Ollama installed locally, this project can check the runtime and generate responses automatically.

```bash
OLLAMA_MODEL=llama3.1:8b node src/index.js ollama-status
OLLAMA_MODEL=llama3.1:8b node src/index.js ollama-prompt "Explain the project architecture"
```

## CI workflow

This repo includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs on push and pull requests.

## Recommended stack

1. Use VS Code or Visual Studio as the primary IDE.
2. Use GitHub for repos, code review, and automation.
3. Connect local or hosted LLM models through Ollama if you need offline or private inference.
4. Keep a single orchestration layer responsible for routing, validation, and task control.
