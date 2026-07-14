# Aetheria GM - AI Persistent RPG Engine

Aetheria GM is an AI-backed, single-player role-playing game (RPG) engine. By defining any genre or setting, the AI Game Master (GM) procedurally designs a coherent 2-4 hour questline divided into three structured acts. As you play, the GM logs your progress, tracks your stats/level/inventory, and generates beautiful vector SVG illustrations representing the locations, characters, and monsters you discover.

The engine stores all events in a persistent SQLite database, which double-functions as a **Model Context Protocol (MCP)** server endpoint. This allows external LLMs or future game sessions to connect directly to the database to retrieve memories, character status, and adventure logs!

---

## Features

1. **Infinite Genres**: Play anything from Gothic Eldritch Horror to Cyberpunk Detective Noir or High Fantasy.
2. **Coherent Game Outline**: At startup, the AI designs an Act-by-Act blueprint and sticks to it as a guideline, preventing the story from running off-track or concluding prematurely.
3. **Adaptive Visual Theme**: The campaign's Setup agent generates the full visual theme — color palette and a font pairing chosen for the genre's atmosphere — applied the moment the campaign loads.
4. **Scene Visualizer, Heroics & Tactical Map**: The visualizer slot shows AI-generated heroic renders of the current focal subject when an image provider is configured (see `/admin` → Scene Images; without one, the procedural SVG path is used). Locations are persistent structured state: the GM keeps a layout and occupancy record per place, shown as a deterministic top-down map in the Situation panel whenever position matters — alongside, never instead of, the written scene grounding.
5. **Interactive Controls**: Suggests quick action choices or accepts free-form text input for full player agency.
6. **Reusable Player Characters**: Characters are stored as persistent profiles with stats, inventory, AI-managed abilities, progression notes, and checkout status. Available characters can be reused in new campaigns, active characters can be copied into a new branch, and campaign cards can release a character profile while preserving the campaign snapshot.
7. **Shared Tables (multiplayer)**: A campaign seats multiple characters, each bound to its own revocable seat token. A seat can act only as — and see only — its own character (partymates are silhouettes; the GM's outline, NPC dossiers, and memories stay server-side), and the server enforces round-robin turns — committed actions wait for your turn, while questions and table talk are always open to everyone.
8. **Council GM Pipeline**: Player turns run through ordered interaction, continuity, referee, continuity archive, and final narration context calls. The player still sees one GM voice, and only the final checked response can update canonical state.
9. **Voice Narration**: Optional AI-generated text-to-speech narration plays only for the final player-facing GM response, never for internal council context calls.
10. **Model Context Protocol (MCP)**: Hosts a Server-Sent Events (SSE) MCP server exposing tools (`list_campaigns`, `list_characters`, `get_campaign_outline`, `get_campaign_history`, `get_character_state`, `search_memories`) for semantic query search of past sessions.
11. **Production Hardened Security & Concurrency**:
   - **DOMPurify Sanitization**: All HTML narrative dialogues and SVG frames are scrubbed using locally bundled DOMPurify and Marked assets, avoiding CDN script trust at runtime.
   - **Content Security Policy**: Served pages include a restrictive CSP and browser hardening headers.
   - **Transaction Isolation**: Multi-table writes execute within queued SQLite immediate write transactions (`BEGIN IMMEDIATE`) to prevent transaction interleaving without serializing unrelated full LLM requests.
   - **Enforced Uniqueness**: Features unique constraints on `turns(campaign_id, turn_number)` and query indexing for performance.
   - **WAL (Write-Ahead Logging)**: Configured for improved concurrent read/write throughput.
   - **Optional Authentication**: Supports a gateway authorization token (`ACCESS_SECRET`) to prevent unauthorized game turns or deletion events.

---

## Supported AI Providers

- **Google Gemini** (Recommended, default: `gemini-1.5-flash` or `gemini-2.5-flash`)
- **OpenAI GPT** (`gpt-4o-mini`, `gpt-4o`)
- **Anthropic Claude** (`claude-3-5-sonnet-20241022`)
- **xAI Grok** (`grok-3`, `grok-3-mini` — excellent structured/JSON output for the Council agents)
- **Ollama** (Local models like `llama3`, `mistral`, `gemma`)
- **Custom OpenAI-Compatible** (LM Studio, OpenRouter, Groq, etc.)

---

## Native Installation (Direct Run)

Aetheria GM runs on any machine (Windows, macOS, Linux) with Node.js installed.
The themed UI uses CSS `color-mix()`, so the supported browser floors are
Chrome/Edge 111, Firefox 113, and Safari/WebKit 16.2; see the
[MDN browser-compatibility table](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix#browser_compatibility).
The Linux desktop shell renders through the machine's installed WebKitGTK rather
than a separately declared WebKitGTK floor; verify the shell on the target machine.

### 1. Install Dependencies
Clone or copy the directory and run:
```bash
npm install
```

The browser harness uses Chromium through Playwright. Install that browser once
on each development machine:

```bash
npx playwright install chromium
```

### 2. Configure AI Provider & Keys (server-owned)
AI configuration belongs to the server operator — players never supply keys or
model choices. Configure it either way:

- **Admin panel**: open **`/admin`** (not linked from the game UI) and set the
  provider, model, keys, optional fallback tier, and voice key. Settings persist
  in the server database and take precedence over environment variables. Gate the
  panel with `ADMIN_SECRET` in `.env`; if unset, `/admin` is open for
  single-operator localhost use (production refuses to serve it without the secret).
- **Environment**: create a `.env` from the template (`cp .env.example .env`) and
  fill in API keys (e.g. `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  or `XAI_API_KEY`).

**Fallback tier**: transient provider errors (overload, rate limit, timeout) retry
once, then fail over per-call to a backup model if configured — via `/admin` or
`FALLBACK_AI_PROVIDER` / `FALLBACK_AI_MODEL` / `FALLBACK_API_KEY`.

#### Setting Up Access Authentication (Optional)
To lock the server endpoints from unauthorized third-party users, add a secret token in your `.env` file:
```env
ACCESS_SECRET=your_secret_access_password
```
If this is configured, click **AI Settings** in the top right of the game interface and paste this token into the **Server Access Token** field to authorize play.

The in-game settings panel holds player preferences only (access token, voice narration choice, diagnostics); AI provider, models, and keys are configured at `/admin` or via environment variables.

#### Reverse Proxy Deployments
If the server is behind a trusted reverse proxy, configure Express proxy handling:
```env
TRUST_PROXY=1
```
Use the number of trusted proxy hops appropriate for your deployment.

### 3. Run the Server
```bash
npm start
```
Open your browser to: **`http://localhost:3000`**

### 4. Hosting a Shared Table (multiplayer: per-seat credentials)

One person runs the server (the **host**); every other player gets a **seat
token** — a private credential bound server-side to exactly one character.
A seat can act only as its own character and sees only its own sheet:
partymates appear as name/class/level/HP silhouettes, and the GM's private
record (campaign outline, NPC dossiers, memories) never leaves the server.

1. **Host**: set `ACCESS_SECRET` (your own credential) and `ADMIN_SECRET`
   in `.env`, start the server, and load the campaign. Use the **+ Join**
   button in the party strip to create each player's character, then click
   the **key icon** next to that character to mint their seat token. The
   token is shown once — send it to that player only. Minting again replaces
   the old token (the recovery move if one leaks); a seat can also be
   revoked outright: `DELETE /api/campaigns/:id/characters/:cid/seat`.
2. **Players**: open the URL, paste your seat token into Settings → Server
   Access Token, and save. Your character loads automatically — there is no
   campaign list and nothing to pick.
3. **Turns**: committed actions go round-robin — the input tells you whose
   turn it is. Questions and table talk ("what do I see?", in-character
   banter) are always open to everyone and never advance the world.
4. Leaving the table: the host releases a character from their campaign
   card, which frees the underlying profile; the campaign's history keeps
   them.

Meta-actions (creating/deleting/forking campaigns, export/import, table
style dials, minting seats) are host-only and rejected for seats
server-side. The AI configuration, keys, and image/voice providers all
belong to the host (`/admin`); players never enter any of that.

**Hosting beyond your LAN**: the app serves plain HTTP — put a
TLS-terminating layer in front of it (reverse proxy, tunnel, or VPN) before
sending seat tokens across the internet, and always set both secrets.

### Optional: Desktop Shell (dev tooling)

A standalone Tauri window for quicker local testing — same server, same UI, same
database; the browser path stays canonical. One-time setup (needs the Rust
toolchain and `webkit2gtk-4.1`):

```bash
npm install --prefix desktop
```

Then launch with:

```bash
npm run desktop
```

The shell reuses a server already running on port 3000, or starts `node server.js`
itself and shuts it down again on exit (a reused server is left running). Set
`AETHERIA_SERVER_DIR` if the shell binary is run from outside the repo.

---

## Docker Installation (Optional)

To deploy Aetheria GM securely on a Linux server:

```bash
# Build and run in background (runs under rootless node user)
docker-compose up -d
```
The server will be available on port `3000` with the SQLite database persisted inside the `rpg-data` docker volume.

---

## Using Local Models (Ollama Configuration)

To query a local Ollama instance from the game client, you must enable **CORS (Cross-Origin Resource Sharing)** permissions in Ollama.

- **Linux / macOS**:
  Run Ollama in your terminal with the `OLLAMA_ORIGINS` environment variable:
  ```bash
  OLLAMA_ORIGINS="*" ollama serve
  ```
- **Windows**:
  1. Quit Ollama from the Taskbar Tray.
  2. Open PowerShell and run:
     ```powershell
     [System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')
     ```
  3. Relaunch Ollama from the Start Menu.

Select **Ollama** in the game's AI Settings panel, verify your Ollama URL (default: `http://localhost:11434`), and enter the exact model name (e.g. `llama3`).

## Council GM Pipeline

Player turns use the **Council GM Pipeline**. It presents as one GM to the player while the server runs ordered context calls behind the scenes:

* **Interaction** interprets the player's exact input and proposes intent.
* **Continuity** approves, denies, or revises that proposal against established facts, pacing, NPC memory, and campaign archive.
* **Referee** adjudicates whether the proposal is approved, denied, or needs clarification, and defines allowed state changes.
* **Continuity final check** verifies the ruling and prepares archive notes.
* **Interaction narration** relays the final result in in-world terms as a single GM response.

The engine has five first-class AI roles, each independently configurable in `/admin` (or via `SETUP_*`, `INTERACTION_*`, `CONTINUITY_*`, `REFEREE_*`, `NARRATION_*` env variables; admin settings win): **Setup** designs the campaign outline and opening scene (once per campaign — use your strongest model), **Interaction** classifies player input every turn (fast/cheap wins), **Continuity** grounds everything against the campaign record, **Referee** adjudicates actions and dice, and **Narration** writes the final player-facing prose (your best stylist). Unconfigured roles inherit the primary config. Council turns make 2 model calls for table talk and 5 for committed actions.

## Voice Narration

Voice narration can be enabled in the player settings panel (voice choice and style are player preferences). It uses the server endpoint `/api/audio/narrate` to generate MP3 audio from the final GM narrative via OpenAI's speech endpoint; the voice API key and TTS model are server-owned — set them at `/admin` or via `OPENAI_API_KEY` / `TTS_MODEL`. The app labels the feature as AI-generated voice narration for user disclosure.

---

## Model Context Protocol (MCP) Integration

Aetheria GM acts as an MCP server using Server-Sent Events (SSE). External LLM clients (like Claude Desktop or Cursor) can connect to the server to look up campaign history.

### Claude Desktop Configuration
Add the following configuration to your `claude_desktop_config.json` (located at `%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "aetheria-gm": {
      "command": "node",
      "args": ["/absolute/path/to/ai-rpg-engine/server.js"],
      "env": {
         "NODE_ENV": "production",
         "ACCESS_SECRET": "your_secret_access_password"
      }
    }
  }
}
```
*(Alternatively, you can connect using SSE transport by providing the URL: `http://localhost:3000/api/mcp/sse?token=your_secret_access_password` if the client supports SSE connections)*.

### Exposed Tools
* `list_campaigns`: Returns IDs, titles, and genres of all games.
* `list_characters`: Returns reusable character profiles, checkout status, stats, inventory, abilities, and progression notes.
* `get_campaign_outline`: Returns the full story blueprint and NPC index.
* `get_campaign_history`: Retreives the full dialogue log of what happened.
* `get_character_state`: Returns campaign character stats (HP/Mana/XP), items, abilities, and progression notes.
* `search_memories`: Runs search queries on campaign memories.
