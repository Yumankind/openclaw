---
summary: "What was removed for Linux-only deployments, what remains, and how to inject messages and isolate agent sessions"
read_when:
  - You are deploying OpenClaw on a Linux server or container
  - You want to understand what macOS/Windows specifics were removed
  - You need to inject messages programmatically into an agent
  - You need isolated sessions per user or per context
title: "Linux Deployment Guide"
---

# Linux Deployment Guide

This page documents the changes made when adapting OpenClaw for a Linux-based server or container deployment, what remains available, how to inject messages programmatically into an agent, and how to configure isolated agent sessions.

## What was removed

The following macOS-only and Windows-only components have been deleted from this repository.

### macOS-only bundled skills (removed)

These skills require macOS CLIs and cannot run on Linux. They have been removed from `skills/`:

| Skill             | Required CLI | Reason                                |
| ----------------- | ------------ | ------------------------------------- |
| `apple-notes`     | `memo`       | Manages Apple Notes via AppleScript   |
| `apple-reminders` | `remindctl`  | Manages Apple Reminders               |
| `bear-notes`      | `grizzly`    | Manages Bear notes app                |
| `imsg`            | `imsg`       | Reads/sends iMessage via Messages.app |
| `model-usage`     | `codexbar`   | macOS menu-bar model usage tracker    |
| `peekaboo`        | `peekaboo`   | macOS UI capture and automation       |
| `things-mac`      | `things`     | Manages Things 3 task manager         |

### macOS-specific scripts (removed)

| Script                         | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `scripts/build-and-run-mac.sh` | Swift build and launch for macOS app         |
| `scripts/restart-mac.sh`       | Kill, rebuild, repackage, relaunch macOS app |
| `scripts/clawlog.sh`           | Query macOS unified logging system           |
| `scripts/codesign-mac-app.sh`  | Code-sign macOS `.app` bundle                |
| `scripts/create-dmg.sh`        | Create a styled macOS DMG installer          |
| `scripts/package-mac-app.sh`   | Package Swift build output into `.app`       |
| `scripts/sparkle-build.ts`     | Sparkle (macOS auto-update) build helper     |
| `scripts/build_icon.sh`        | Build macOS `.icns` icon from source         |

### Windows-specific files (removed)

| File                  | Purpose                          |
| --------------------- | -------------------------------- |
| `scripts/install.ps1` | PowerShell installer for Windows |

### macOS/iOS client app directories (removed)

| Directory      | Purpose                                          |
| -------------- | ------------------------------------------------ |
| `apps/macos/`  | macOS SwiftUI menu-bar and chat app              |
| `apps/ios/`    | iOS SwiftUI app                                  |
| `apps/shared/` | Swift `OpenClawKit` shared by macOS and iOS apps |
| `Swabble/`     | Swift package used by macOS/iOS apps             |

### CI jobs (removed from `.github/workflows/ci.yml`)

| Job              | Purpose                                                   |
| ---------------- | --------------------------------------------------------- |
| `macos`          | Swift build + lint + test on macOS runner                 |
| `ios`            | iOS build and test on macOS runner (was already disabled) |
| `checks-windows` | Full Node test suite on Windows runner                    |

---

## What is still available

### Linux-compatible bundled skills

All skills without an OS restriction remain. Skills explicitly supporting Linux:

| Skill             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tmux`            | Terminal multiplexer — works on Linux and macOS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `sherpa-onnx-tts` | Offline TTS — Linux, macOS, and Windows binaries available                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| All others        | No OS restriction — `1password`, `blogwatcher`, `blucli`, `bluebubbles`, `camsnap`, `canvas`, `clawhub`, `coding-agent`, `discord`, `eightctl`, `gemini`, `gh-issues`, `gifgrep`, `github`, `gog`, `goplaces`, `healthcheck`, `himalaya`, `mcporter`, `nano-banana-pro`, `nano-pdf`, `notion`, `obsidian`, `openai-image-gen`, `openai-whisper`, `openai-whisper-api`, `openhue`, `oracle`, `ordercli`, `sag`, `session-logs`, `skill-creator`, `slack`, `songsee`, `sonoscli`, `spotify-player`, `summarize`, `trello`, `video-frames`, `voice-call`, `wacli`, `weather`, `xurl` |

### Linux-focused scripts (kept)

| Script / File                      | Purpose                        |
| ---------------------------------- | ------------------------------ |
| `scripts/install.sh`               | Bash installer (Linux + macOS) |
| `scripts/docker-setup.sh`          | Docker Compose bootstrap       |
| `scripts/sandbox-setup.sh`         | Docker sandbox image build     |
| `scripts/systemd/`                 | Systemd service unit files     |
| `Dockerfile`, `docker-compose.yml` | Container runtime              |
| `render.yaml`, `fly.toml`          | Cloud PaaS deployment configs  |

### macOS/Windows source guards (kept as no-ops)

The source files `src/cli/windows-argv.ts` and `src/plugin-sdk/windows-spawn.ts` remain in the codebase. On Linux, `process.platform !== "win32"` causes all Windows-specific logic inside them to be bypassed automatically. Removing them would require refactoring callers with no runtime benefit.

---

## Minimum Linux configuration

Save to `~/.openclaw/openclaw.json` (or `/home/node/.openclaw/openclaw.json` when running in Docker):

```json5
{
  agents: {
    defaults: {
      workspace: "/home/node/.openclaw/workspace",
      model: { primary: "anthropic/claude-sonnet-4-5" },
    },
  },
  gateway: {
    bind: "lan", // bind to 0.0.0.0 so Docker port mapping works
    port: 18789,
  },
  session: {
    dmScope: "per-channel-peer", // isolate each user's DM context (see below)
  },
}
```

Set auth via environment variable (never hard-code the token in config):

```bash
export OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)"
```

For full remote deployment options see [Remote access](/gateway/remote) and [Docker](/install/docker).

---

## Injecting messages to an agent

There are three ways to programmatically send a message to a running agent.

### 1. CLI — `openclaw agent`

Run one agent turn directly from any shell that can reach the gateway:

```bash
# Target the default agent, fire a turn, print the reply
openclaw agent --message "Summarize the latest logs"

# Target a specific agent by ID
openclaw agent --agent ops --message "Generate daily report"

# Target a specific session key
openclaw agent --session-key "agent:main:main" --message "What is the status?"

# Deliver the reply to a channel (e.g. Slack)
openclaw agent \
  --agent ops \
  --message "Generate report" \
  --deliver \
  --reply-channel slack \
  --reply-to "#reports"
```

When the gateway is remote, point the CLI at it first:

```bash
export OPENCLAW_GATEWAY_URL="ws://your-server:18789"
export OPENCLAW_GATEWAY_TOKEN="your-token"
openclaw agent --message "Hello"
```

Full reference: [`openclaw agent`](/cli/agent)

### 2. HTTP — OpenAI Chat Completions endpoint

Enable the endpoint once in config:

```json5
{
  gateway: {
    http: {
      endpoints: {
        chatCompletions: { enabled: true },
      },
    },
  },
}
```

Then send a standard OpenAI-compatible request:

```bash
curl -sS http://your-server:18789/v1/chat/completions \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw:main",
    "messages": [{"role": "user", "content": "What is the status?"}]
  }'
```

For streaming responses add `"stream": true`. To pin the session so repeated calls share context, set `"user": "unique-caller-id"`.

Full reference: [OpenAI Chat Completions](/gateway/openai-http-api)

### 3. HTTP — OpenResponses endpoint

Enable the endpoint once in config:

```json5
{
  gateway: {
    http: {
      endpoints: {
        responses: { enabled: true },
      },
    },
  },
}
```

Then send a request:

```bash
curl -sS http://your-server:18789/v1/responses \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-openclaw-agent-id: main" \
  -d '{"model": "openclaw", "input": "What is the status?"}'
```

Full reference: [OpenResponses API](/gateway/openresponses-http-api)

---

## Isolated agent sessions

### Why isolation matters

By default all direct messages (DMs) from any sender share a single `main` session. In a multi-user or programmatic deployment, this leaks context across callers: user B can ask "what did we discuss?" and receive information from user A's prior turn.

### Per-user session isolation (`dmScope`)

Set `dmScope` in config to isolate each DM context by sender:

```json5
{
  session: {
    // Isolate DM context per channel + sender (recommended for multi-user setups)
    dmScope: "per-channel-peer",
  },
}
```

| Value                      | Isolation level                                                   |
| -------------------------- | ----------------------------------------------------------------- |
| `main` (default)           | All DMs share one session — suitable for single-user only         |
| `per-peer`                 | Isolate by sender ID across all channels                          |
| `per-channel-peer`         | Isolate by channel + sender — **recommended for multi-user**      |
| `per-account-channel-peer` | Isolate by account + channel + sender — for multi-account inboxes |

Session keys follow the pattern `agent:<agentId>:<sessionKey>`.  
Transcripts are stored at `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`.

### Per-context isolation via session key (`openclaw agent`)

When injecting messages programmatically, pass an explicit `--session-key` to put each caller in its own session:

```bash
# Caller "job-42" always uses its own isolated session
openclaw agent \
  --message "Process batch 42" \
  --session-key "agent:main:job-42"

# Caller "user-alice" gets her own session
openclaw agent \
  --message "Show my tasks" \
  --session-key "agent:main:user-alice"
```

### Per-context isolation via HTTP endpoints

The HTTP endpoints derive a stable session key from the `user` field in the request body, so repeated calls from the same caller share context while different callers remain isolated:

```bash
# Alice's session
curl http://your-server:18789/v1/chat/completions \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"openclaw:main","user":"alice","messages":[{"role":"user","content":"Hello"}]}'

# Bob's session — completely separate context
curl http://your-server:18789/v1/chat/completions \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"openclaw:main","user":"bob","messages":[{"role":"user","content":"Hello"}]}'
```

You can also set a full session key via the `x-openclaw-session-key` header:

```bash
curl http://your-server:18789/v1/responses \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-openclaw-session-key: agent:main:job-42" \
  -d '{"model":"openclaw","input":"Run step 2"}'
```

### Multiple isolated agents

For stronger isolation — separate workspace, memory, persona, and auth profiles per workload — run multiple named agents in one gateway process:

```json5
{
  agents: {
    list: [
      {
        id: "support",
        workspace: "/home/node/.openclaw/workspace-support",
        agentDir: "/home/node/.openclaw/agents/support/agent",
        model: { primary: "anthropic/claude-sonnet-4-5" },
      },
      {
        id: "ops",
        workspace: "/home/node/.openclaw/workspace-ops",
        agentDir: "/home/node/.openclaw/agents/ops/agent",
        model: { primary: "openai/gpt-5.2" },
      },
    ],
    bindings: [
      { agentId: "support", channel: "slack", account: "support-bot" },
      { agentId: "ops", channel: "slack", account: "ops-bot" },
    ],
  },
}
```

Each agent has its own `sessions/` directory and auth profile — they never share context.

Full reference: [Multi-agent routing](/concepts/multi-agent)

---

## Further reading

- [Docker](/install/docker) — containerised gateway quick-start
- [Remote access](/gateway/remote) — SSH tunnels, Tailscale, and bind options
- [VPS Hosting](/vps) — provider-specific guides (Fly, Hetzner, Railway, GCP, …)
- [Session management](/concepts/session) — full session key schema and maintenance
- [Multi-agent routing](/concepts/multi-agent) — multiple agents in one gateway
- [Configuration reference](/gateway/configuration-reference) — every config field
- [Sandboxing](/gateway/sandboxing) — Docker-based tool isolation per session
