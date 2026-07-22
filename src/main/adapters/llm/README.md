# LLM Adapter

v0.3 starts with an OpenAI-compatible Chat Completions adapter behind a protocol registry.
Provider-specific development credentials live only in ignored local env files
(`.env.development.local` is recommended; `.env` is supported for the local developer workflow)
and are loaded by development commands only.

Development variables:

- `WYY_DEV_LLM_BASE_URL`: API root including its version path; the adapter appends
  `chat/completions`.
- `WYY_DEV_LLM_MODEL_ID`: provider model identifier.
- `WYY_DEV_LLM_API_KEY`: Bearer token; main-process only.
- `WYY_DEV_LLM_TIMEOUT_MS`: request timeout from 1,000 to 300,000 ms.

Security boundary:

- never use a `VITE_`, `MAIN_VITE_`, `PRELOAD_VITE_`, or `RENDERER_VITE_` prefix for secrets;
- never expose the config through preload/IPC or renderer code;
- never log, persist, or include these values in diagnostics;
- `readDevelopmentLLMConfig` rejects packaged applications;
- build verification fails if local values appear in `out`;
- product profiles use `SecureStorageService`, not this development env bridge;
- the main-only transport validates the URL, resolved DNS addresses, timeout, cancellation and each
  same-origin 307/308 redirect hop.

The development profile is scaffolding for adapter tests, not a built-in or default release
provider. Additional provider protocols remain isolated behind the `LLMProvider` interface and
protocol registry.
