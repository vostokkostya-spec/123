# Ollama model matrix

**Updated:** 2026-09-14 12:55 MSK

## Verification

The local Ollama registry was checked at this timestamp. All six detected
entries are present and readable: four generation models and two embedding
models. No local model from the current inventory is missing.

Ollama Cloud CLI authentication is active for account `vostokkostya`. A live
safe test using `gpt-oss:20b-cloud` returned `CONNECTED`. No API key is stored
in the workspace; the CLI sign-in session is used.

## Local models detected

| Model | Type | Use on this PC |
|---|---|---|
| `qwen3:4b-instruct` | Chat/instruct, 4B | Default for planner, coder, reviewer, router; CPU-friendly |
| `qwen3:8b` | Chat/instruct, 8B | Optional quality upgrade for short, non-interactive work; slower on CPU |
| `gemma4:e2b` | Chat/reasoning, approximately 5B | Optional planner/reviewer alternative; slower and not the default |
| `gemma4:26b` | Chat/reasoning, approximately 25B | Explicit-only experiment; not suitable as a CPU default |
| `all-minilm:latest` | Embedding | Not valid for text generation |
| `qwen3-embedding:0.6b` | Embedding | Not valid for text generation |

The application filters embedding models from automatic generation selection. The inventory therefore contains four usable local generation models and two embedding models.

## Cloud models

Ollama's cloud catalog is account-dependent and larger than four models. This
account currently exposes `gpt-oss:20b-cloud` through the local Ollama
registry. Other public examples include `gpt-oss:120b`, `qwen3.5:397b`,
`deepseek-v4-flash`, `glm-5.3-flash`, and `kimi-k2.7-code`.

Cloud models are not downloaded into local VRAM. Ollama forwards inference to its cloud service, so prompts and relevant file context leave the machine. Use them only for approved, non-sensitive tasks.

## Role policy

The workspace supports role-specific switching:

```powershell
$env:OLLAMA_PLANNER_MODEL = "qwen3:8b"
$env:OLLAMA_CODER_MODEL = "qwen3:4b-instruct"
$env:OLLAMA_REVIEWER_MODEL = "qwen3:8b"
$env:OLLAMA_ROUTER_MODEL = "qwen3:4b-instruct"
```

Each role falls back to `OLLAMA_MODEL`, then the safe local default. A cloud model can be assigned to one role by name after authentication, for example:

```powershell
$env:OLLAMA_REVIEWER_MODEL = "gpt-oss:120b-cloud"
```

Recommended policy for the current hardware:

- local `qwen3:4b-instruct` for routine and sensitive work;
- local `qwen3:8b` only when extra quality justifies CPU latency;
- cloud model only for explicitly approved large/complex tasks without secrets;
- never use embedding models for planner, coder, reviewer, or router generation.
