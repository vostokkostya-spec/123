# Project knowledge base

**Generated:** 2026-09-14  
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

## Verification record

- Unit suite: 10 tests passed after coder hardening.
- Live coder test: corrected an intentional `a - b` bug to `a + b`.
- Live reviewer test: returned `VERDICT: APPROVE`.
- No-apply verification: the source file remained unchanged.
- CI: green on the hardening PR before merge review.

## Known gaps

- `security` and `ops` are intentionally rules-based, not LLM-backed.
- Keyword routing can misclassify ambiguous tasks.
- Hybrid LLM routing is now available: one unambiguous keyword match stays on the fast path, while ambiguous or forced `--llm` routes use deterministic Ollama classification and fall back to keywords on any failure.
- Routing classification uses `temperature=0`; CLI output includes a human-readable `routingLabel`.
- The stack audit is documented in `docs/STACK-AUDIT-2026-09-14.md`; no browser cookies, external disks, or personal databases were indexed.
- The diff renderer is intentionally lightweight and should be replaced with a mature diff library if multi-file edits are introduced.
- Long files are currently truncated from the beginning at approximately 4,500 tokens; chunking or a head/tail strategy is backlog work.
- No external knowledge corpus was downloaded because the approved scope was the current repository only.

## Next safe steps

1. Merge and verify the hybrid LLM routing PR.
2. Replace marker-only routing with Ollama structured JSON and schema validation.
3. Add structured task history if persistent memory is needed.
4. Add chunking for long files instead of truncating only the beginning.
5. Add multi-file proposals only after extending path validation and review coverage.
