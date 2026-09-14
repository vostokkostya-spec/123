# Project instructions

## Scope

This repository contains a local AI orchestration CLI for VS Code, GitHub, Ollama, and specialized agents. Treat the repository as the source of truth. Do not assume that an agent changed a file unless the diff and tests confirm it.

## Agent roles

- `planner`: Ollama-backed task decomposition.
- `coder`: Ollama-backed implementation plan or safe file proposal.
- `reviewer`: Ollama-backed diff review with a fail-safe `ISSUES` verdict.
- `security`: rules-based routing only.
- `ops`: rules-based routing only.

## Safe coding flow

Use `node src/index.js code "task" --file path/to/file` to generate a proposal. The command must print a diff and must not write by default. `--apply` requires an interactive confirmation. Never bypass this safeguard in automation.

## Merge protocol

Never merge a pull request autonomously. A merge is allowed only when:

1. review is complete and no blocking issue remains;
2. the final commit has green required CI checks; and
3. the repository owner has explicitly confirmed the merge.

Record the merge commit and validation result in the project knowledge and task register. If any condition is missing, leave the pull request open.

## Validation

Run `npm test` before committing. CI must not require a running Ollama instance; use mocked `fetch` responses for Ollama tests.

## Ollama defaults

- Default chat model: `qwen3:4b-instruct` when installed. This conservative default is intentional for the observed CPU-only environment: AMD Radeon RX 580, no NVIDIA acceleration, and approximately 31.1 GB RAM.
- Embedding models must never be selected for text generation.
- `num_ctx` defaults to `8192`.
- Planner/reviewer requests use a 60-second timeout.
- Code generation uses a 300-second timeout by default and may be overridden with `OLLAMA_TIMEOUT`.

## Change requirements

Keep changes small and auditable. Add tests for new parsing, routing, timeout, and file-write behavior. Do not add secrets, personal data, or machine-wide paths to the repository.
