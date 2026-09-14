# Project knowledge base

**Generated:** 2026-09-14 12:47 MSK
**Scope:** Current repository only. No personal folders, external disks, or private data were indexed.

## Executive summary

This repository is a Node.js CLI orchestration layer. It routes engineering tasks to specialized roles and uses a local Ollama runtime for planner, coder, and reviewer work. File changes are proposal-first: the `code` command produces a diff and reviewer result, while writes require explicit interactive confirmation.

GitHub is used for source control, pull requests, and CI. The project does not train GitHub or a remote model. The durable project knowledge is stored as repository documentation and Copilot instructions.

## System map

```text
User
  -> CLI (src/index.js)
      -> keyword router (src/agents.js)
      -> orchestrator (src/orchestrator.js)
          -> Ollama adapter (src/ollama.js)
              -> http://localhost:11434
          -> diff + confirmation before file writes
      -> npm test / GitHub Actions
```

## Agent matrix

| Agent | Execution | Responsibility |
|---|---|---|
| planner | Ollama-backed | Decompose work into milestones and validation |
| coder | Ollama-backed | Propose a complete one-file change and explanation |
| reviewer | Ollama-backed | Review task/diff and return `APPROVE` or fail-safe `ISSUES` |
| security | Rules-based | Route security-related tasks |
| ops | Rules-based | Route build, deployment, and CI tasks |

## CLI surface

```text
node src/index.js --diagnose
node src/index.js route "task"
node src/index.js task "task"
node src/index.js code "task" --file path/to/file
node src/index.js code "task" --file path/to/file --apply
node src/index.js ollama-status
node src/index.js ollama-prompt "prompt"
```

## Safety and limits

- `code` does not write files unless `--apply` is provided and an interactive `y/yes` confirmation is received.
- Non-interactive `--apply` is rejected.
- File context is limited to approximately 4,500 tokens and reports truncation.
- Coder output must contain `### FILE` and `### EXPLANATION`; malformed output is rejected.
- Reviewer output without a recognized verdict defaults to `ISSUES`.
- Default generation context is `8192`; coder response budget is up to 3,000 tokens.
- Ollama must not be required by CI; tests use mocks.

## Local runtime findings

- Ollama API is available at `http://localhost:11434`.
- Ollama version observed during diagnosis: `0.34.0`.
- Safe default model: `qwen3:4b-instruct`.
- Embedding models observed: `all-minilm:latest`, `qwen3-embedding:0.6b`; these must not be selected for generation.
- Hardware observed: AMD Radeon RX 580 with approximately 4 GB VRAM and about 31.1 GB system RAM. NVIDIA acceleration was not available.
- Windows Ollama user settings are configured for this machine: `OLLAMA_HOST=127.0.0.1:11434`, `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_MAX_LOADED_MODELS=1`, and `OLLAMA_KEEP_ALIVE=5m`. The Ollama startup shortcut is present in the user Startup folder; these environment values take effect after reboot.

## Verification record

- Unit suite: 16 tests passed, including hybrid-routing success and fallback cases.
- Live coder test: corrected an intentional `a - b` bug to `a + b`.
- Live reviewer test: returned `VERDICT: APPROVE`.
- No-apply verification: the source file remained unchanged.
- CI: PR #5 was merged as `00e2e8d`; post-merge local validation is green.

## Known gaps

- `security` and `ops` are intentionally rules-based, not LLM-backed.
- Keyword routing can misclassify ambiguous tasks.
- Keyword rules map implementation words (`fix`, `bug`, `error`, `исправь`, `ошибка`) to `coder`; review words map to `reviewer`, and the same selector is used for fast routing and LLM fallback.
- Hybrid LLM routing is now available: one unambiguous keyword match stays on the fast path, while ambiguous or forced `--llm` routes use deterministic Ollama classification and fall back to keywords on any failure.
- Routing classification uses `temperature=0`; CLI output includes a human-readable `routingLabel`.
- The stack audit is documented in `docs/STACK-AUDIT-2026-09-14.md`; no browser cookies, external disks, or personal databases were indexed.
- The diff renderer is intentionally lightweight and should be replaced with a mature diff library if multi-file edits are introduced.
- Long files are currently truncated from the beginning at approximately 4,500 tokens; chunking or a head/tail strategy is backlog work.
- No external knowledge corpus was downloaded because the approved scope was the current repository only.
- Public documentation confirms Ollama structured JSON/schema output and VS Code workspace/user agent customization scopes; these are recorded as planned integrations, not yet enabled.
- Agent Reach v1.5.0 is current. GitHub CLI, web, RSS, YouTube, Bilibili, and V2EX paths are available; login-dependent channels remain unconfigured.
- The consolidated task register is `docs/TASKS.md`; VS Code now has `.vscode/tasks.json` for repeatable test, Ollama, and routing smoke commands.
- VS Code launch profiles are in `.vscode/launch.json`; shared Codex/agent rules are in `AGENTS.md`.
- Merge protocol: no autonomous merges; require closed review, green required CI on the final commit, and explicit owner confirmation, then record the merge commit.

## Next safe steps

1. Implement bounded head/tail or chunked context for long files.
2. Replace marker-only routing with Ollama structured JSON and schema validation.
3. Add a reviewer gate that blocks `--apply` on `ISSUES`.
4. Add structured task history only after defining retention and redaction rules.
5. Add multi-file proposals only after extending path validation and review coverage.
