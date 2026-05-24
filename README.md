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
6. **Model Context Protocol (MCP)**: Hosts a Server-Sent Events (SSE) MCP server exposing tools (`list_campaigns`, `get_campaign_outline`, `get_campaign_history`, `get_character_state`, `search_memories`) for semantic query search of past sessions.

---

## Supported AI Providers

- **Google Gemini** (Recommended, default: `gemini-1.5-flash` or `gemini-2.5-flash`)
- **OpenAI GPT** (`gpt-4o-mini`, `gpt-4o`)
- **Anthropic Claude** (`claude-3-5-sonnet-20241022`)
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
Fill in your API Keys (e.g. `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`). 
*Note: If you leave keys empty in `.env`, you can still enter them directly in the browser's UI Settings panel (saved securely in your local browser storage).*

### 3. Run the Server
```bash
npm start
```
Open your browser to: **`http://localhost:3000`**

---

## Docker Installation (Optional)

To deploy Aetheria DM easily on a Linux server:

```bash
# Build and run in background
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
         "NODE_ENV": "production"
      }
    }
  }
}
```
*(Alternatively, you can connect using SSE transport by providing the URL: `http://localhost:3000/api/mcp/sse` if the client supports SSE connections)*.

### Exposed Tools
* `list_campaigns`: Returns IDs, titles, and genres of all games.
* `get_campaign_outline`: Returns the full story blueprint and NPC index.
* `get_campaign_history`: Retreives the full dialogue log of what happened.
* `get_character_state`: Returns stats (HP/Mana/XP) and items.
* `search_memories`: Runs search queries on campaign memories.
