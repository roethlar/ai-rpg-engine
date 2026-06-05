# Aetheria DM - AI Persistent RPG Engine

Aetheria DM is an AI-backed, single-player role-playing game (RPG) engine. By defining any genre or setting, the AI Dungeon Master (DM) procedurally designs a coherent 2-4 hour questline divided into three structured acts. As you play, the DM logs your progress, tracks your stats/level/inventory, and generates beautiful vector SVG illustrations representing the locations, characters, and monsters you discover.

The engine stores all events in a persistent SQLite database, which double-functions as a **Model Context Protocol (MCP)** server endpoint. This allows external LLMs or future game sessions to connect directly to the database to retrieve memories, character status, and adventure logs!

---

## Features

1. **Infinite Genres**: Play anything from Gothic Eldritch Horror to Cyberpunk Detective Noir or High Fantasy.
2. **Coherent Game Outline**: At startup, the AI designs an Act-by-Act blueprint and sticks to it as a guideline, preventing the story from running off-track or concluding prematurely.
3. **Adaptive Visual Theme**: The user interface dynamically shifts HSL color palettes and fonts to match the atmosphere of your chosen genre.
4. **Scene Visualizer**: Renders custom inline SVG artwork generated procedurally by the AI for each encounter.
5. **Interactive Controls**: Suggests quick action choices or accepts free-form text input for full player agency.
6. **Reusable Player Characters**: Characters are stored as persistent profiles with stats, inventory, AI-managed abilities, progression notes, and checkout status. Available characters can be reused in new campaigns, active characters can be copied into a new branch, and campaign cards can release a character profile while preserving the campaign snapshot.
7. **Council DM Pipeline**: Player turns run through ordered interaction, continuity, referee, continuity archive, and final narration context calls. The player still sees one DM voice, and only the final checked response can update canonical state.
8. **Voice Narration**: Optional AI-generated text-to-speech narration plays only for the final player-facing DM response, never for internal council context calls.
9. **Model Context Protocol (MCP)**: Hosts a Server-Sent Events (SSE) MCP server exposing tools (`list_campaigns`, `list_characters`, `get_campaign_outline`, `get_campaign_history`, `get_character_state`, `search_memories`) for semantic query search of past sessions.
10. **Production Hardened Security & Concurrency**:
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

Aetheria DM runs on any machine (Windows, macOS, Linux) with Node.js installed.

### 1. Install Dependencies
Clone or copy the directory and run:
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file from the template:
```bash
cp .env.example .env
```
Fill in your API Keys (e.g. `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `XAI_API_KEY`). 

#### Setting Up Access Authentication (Optional)
To lock the server endpoints from unauthorized third-party users, add a secret token in your `.env` file:
```env
ACCESS_SECRET=your_secret_access_password
```
If this is configured, click **AI Settings** in the top right of the game interface and paste this token into the **Server Access Token** field to authorize play.

The campaign menu also includes **AI Settings**, so model keys and server access can be configured before the first campaign is created.

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

---

## Docker Installation (Optional)

To deploy Aetheria DM securely on a Linux server:

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

## Council DM Pipeline

Player turns use the **Council DM Pipeline**. It presents as one DM to the player while the server runs ordered context calls behind the scenes:

* **Interaction** interprets the player's exact input and proposes intent.
* **Continuity** approves, denies, or revises that proposal against established facts, pacing, NPC memory, and campaign archive.
* **Referee** adjudicates whether the proposal is approved, denied, or needs clarification, and defines allowed state changes.
* **Continuity final check** verifies the ruling and prepares archive notes.
* **Interaction narration** relays the final result in in-world terms as a single DM response.

The browser UI uses one primary model configuration for the visible DM. Server operators can route context calls to different models with environment variables such as `INTERACTION_AI_PROVIDER`, `CONTINUITY_AI_PROVIDER`, `REFEREE_AI_PROVIDER`, plus matching `*_AI_MODEL`, `*_API_KEY`, `*_CUSTOM_ENDPOINT_URL`, and `*_OLLAMA_URL` values. Council turns make multiple model calls and can take longer than single-model turns.

## Voice Narration

Voice narration can be enabled in **AI Settings**. It uses the server endpoint `/api/audio/narrate` to generate MP3 audio from the final DM narrative via OpenAI's speech endpoint. Set `OPENAI_API_KEY` server-side or provide a voice API key in the settings panel. The app labels the feature as AI-generated voice narration for user disclosure.

---

## Model Context Protocol (MCP) Integration

Aetheria DM acts as an MCP server using Server-Sent Events (SSE). External LLM clients (like Claude Desktop or Cursor) can connect to the server to look up campaign history.

### Claude Desktop Configuration
Add the following configuration to your `claude_desktop_config.json` (located at `%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "aetheria-dm": {
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
