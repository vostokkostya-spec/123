# AI stack audit report

**Date:** 2026-09-14 12:40 MSK
**Scope:** Current repository, GitHub repository metadata/CI, local Ollama API, and public technical documentation.  
**Excluded:** Browser windows, Chrome cookies, VS Code/Codex private session databases, external disks, personal files, and unapproved software installation.

## Executive result

The repository is a working local orchestration project, not a trained model. It combines:

- GitHub for source control, issues, pull requests, and Actions
- VS Code/Visual Studio as the IDE layer
- Ollama as the local model runtime
- planner, coder, and reviewer as Ollama-backed roles
- security and ops as deterministic rules-based roles
- a safe CLI workflow that previews diffs and requires interactive confirmation before writes

The current hybrid router is implemented and verified. It uses keywords for unambiguous tasks and Ollama classification for ambiguous tasks or explicit `--llm` requests. Classification sends `temperature=0`. All routing failures fall back to keyword routing. The CLI exposes a human-readable `routingLabel`, for example `keyword -> reviewer` or `llm -> planner (reason: ...)`.

## Repository inventory

The current branch contains a small Node.js project with:

- `src/index.js` — CLI commands and safe file-apply flow
- `src/agents.js` — agent catalog and keyword matching
- `src/orchestrator.js` — prompts, routing, parsing, diff generation, and agent execution
- `src/ollama.js` — model selection, status, timeout, and generation API adapter
- `src/*.test.js` — mocked Ollama and routing tests
- `.github/workflows/ci.yml` — Node 20 CI
- `.github/copilot-instructions.md` — repository-wide Copilot guidance
- `.vscode/` — extension recommendations and workspace settings
- `docs/PROJECT-KNOWLEDGE.md` — durable project knowledge

## Runtime findings

- Ollama endpoint: `http://localhost:11434`
- Observed Ollama version: `0.34.0`
- Safe default: `qwen3:4b-instruct`
- Embedding models are excluded from generation selection.
- Observed hardware: AMD Radeon RX 580, approximately 4 GB VRAM, and approximately 31.1 GB RAM.
- NVIDIA acceleration is unavailable in the current environment.

## Public-source verification

The following official sources were consulted:

1. GitHub repository custom instructions documentation: repository-wide instructions belong in `.github/copilot-instructions.md`; path-specific instructions and agent instructions are separate supported mechanisms.
2. Ollama API documentation: `/api/generate` supports `stream: false`, model options such as `temperature`, and structured JSON output through `format`.
3. VS Code agent customization documentation: workspace customizations can be committed, while user customizations remain local; Agent Host sessions use supported customization locations.

The project currently uses the documented repository-wide instruction location and keeps CI independent from the local runtime.

## External tooling decision

No additional agent, application, browser extension, or model was installed during this audit. The existing stack already covers the requested repository workflow, and adding an unreviewed third-party agent would increase supply-chain and data-exfiltration risk without a concrete requirement.

The agent-reach diagnostic found:

- GitHub CLI available
- web reader available
- YouTube, RSS, V2EX, and Bilibili public paths available
- several login-state platforms not configured
- Exa configuration present but not live-verified

No authenticated social or browser-cookie data was accessed.

## Security and privacy posture

- No whole-disk scan was performed.
- No Chrome profile or cookies were read.
- No personal databases were copied.
- No secrets were added to the repository.
- `code --apply` requires an interactive confirmation and refuses non-interactive execution.
- Invalid coder output is rejected.
- Reviewer output without a valid verdict defaults to `ISSUES`.
- Ollama failures never break route; routing falls back to keywords.

## Verification results

- Local unit suite: 16 tests passed.
- Live keyword route: completed without an LLM call for an unambiguous task.
- Live forced LLM route: used `qwen3:4b-instruct`.
- Live unavailable-Ollama route: returned keyword fallback with exit code 0.
- Routing mocks cover valid output, unknown agent, missing marker, timeout, and connection failure.
- Router request verification: `temperature=0`, `num_predict=120`.
- CLI examples: `keyword -> reviewer` for `Fix the login bug`; `llm -> planner (reason: ...)` for a release-planning request.
- Live coder/reviewer flow: proposed the intended arithmetic fix and returned `VERDICT: APPROVE`.
- CI was green for the hybrid routing changes; PR #5 is open, `MERGEABLE`, and `CLEAN`.
- Agent Reach is v1.5.0 and the update check reports no newer version.

## Open tasks

1. Merge and verify the hybrid routing PR.
2. Replace marker-only routing with Ollama structured JSON output after adding schema validation and compatibility tests.
3. Add a reviewer gate that prevents `--apply` when the verdict is `ISSUES`.
4. Add persistent task history only after defining retention and redaction rules.
5. Replace beginning-only truncation with chunking or a head/tail strategy.
6. Extend coder proposals to multiple files only after adding path, size, and review safeguards.
7. Evaluate optional third-party agents one at a time, from pinned, auditable sources.

## Conclusion

The current system is sufficiently integrated for local repository work. The next improvements should strengthen observability, structured outputs, and long-file handling rather than install a large number of loosely governed agents.
