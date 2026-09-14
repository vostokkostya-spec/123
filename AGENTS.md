# Agent instructions

## Project workflow

- Treat the repository and `docs/TASKS.md` as the source of truth.
- Read `docs/PROJECT-KNOWLEDGE.md` before changing orchestration behavior.
- Run `npm.cmd test` before committing.
- Keep CI independent of a running Ollama instance; mock Ollama requests in tests.

## Safe file changes

- Use `node src/index.js code "task" --file path/to/file` to generate a proposal.
- Review the printed diff and reviewer verdict before applying it.
- Never use `--apply` from a script or non-interactive terminal.
- Never write outside the workspace.

## Merge protocol

Do not merge pull requests autonomously. Merge only after closed review, green required CI on the final commit, and explicit owner confirmation. Record the merge commit and validation result in the project knowledge.

## Runtime defaults

- Ollama endpoint: `http://localhost:11434`
- Default chat model: `qwen3:4b-instruct`
- Do not select embedding models for generation.
