import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import * as db from './db.js';
import * as rpg from './rpg-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Store active MCP connections
const mcpConnections = new Map();

// -------------------------------------------------------------
// GAME API ENDPOINTS
// -------------------------------------------------------------

// Initialize database schema
db.initDb().catch(err => {
  console.error('Failed to initialize database:', err);
});

// List all campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await db.all(`SELECT * FROM campaigns ORDER BY created_at DESC`);
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const { genre, characterName, characterClass, apiConfig } = req.body;
    if (!genre || !characterName || !characterClass) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }
    const state = await rpg.createCampaign({ genre, characterName, characterClass, apiConfig });
    res.json(state);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load an existing campaign
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const state = await rpg.getCampaignState(campaignId);
    if (!state) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process a game turn
app.post('/api/campaigns/:id/turn', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    const { playerAction, apiConfig } = req.body;
    if (!playerAction) {
      return res.status(400).json({ error: 'Missing playerAction' });
    }
    const state = await rpg.takeTurn(campaignId, playerAction, apiConfig);
    res.json(state);
  } catch (error) {
    console.error('Error processing turn:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a campaign
app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.id);
    await db.run(`DELETE FROM campaigns WHERE id = ?`, [campaignId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// MODEL CONTEXT PROTOCOL (MCP) IMPLEMENTATION OVER SSE
// -------------------------------------------------------------

// MCP SSE Handshake Endpoint
app.get('/api/mcp/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const connectionId = crypto.randomUUID();
  console.log(`MCP client connected. Connection ID: ${connectionId}`);

  mcpConnections.set(connectionId, res);

  // Send the URI of the message endpoint for client POSTs
  const messageUrl = `/api/mcp/message?connection_id=${connectionId}`;
  res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);

  req.on('close', () => {
    console.log(`MCP client disconnected. Connection ID: ${connectionId}`);
    mcpConnections.delete(connectionId);
  });
});

// MCP Client Message Endpoint
app.post('/api/mcp/message', async (req, res) => {
  const connectionId = req.query.connection_id;
  const clientResponseStream = mcpConnections.get(connectionId);

  if (!clientResponseStream) {
    return res.status(400).json({ error: 'Connection expired or invalid.' });
  }

  const rpcRequest = req.body;
  console.log(`Received MCP RPC request on ${connectionId}:`, rpcRequest.method);

  let rpcResponse = {
    jsonrpc: '2.0',
    id: rpcRequest.id
  };

  try {
    switch (rpcRequest.method) {
      case 'initialize':
        rpcResponse.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'aetheria-dm-mcp',
            version: '1.0.0'
          }
        };
        break;

      case 'tools/list':
        rpcResponse.result = {
          tools: [
            {
              name: 'list_campaigns',
              description: 'Retrieve a list of all active and completed campaigns in the RPG engine database.',
              inputSchema: { type: 'object', properties: {} }
            },
            {
              name: 'get_campaign_outline',
              description: 'Retrieve the 2-4 hour quest outline, main NPCs, settings, and acts structure of a campaign.',
              inputSchema: {
                type: 'object',
                properties: {
                  campaign_id: { type: 'integer', description: 'The unique campaign ID' }
                },
                required: ['campaign_id']
              }
            },
            {
              name: 'get_campaign_history',
              description: 'Fetch the full chronological narrative log and choices of player actions and DM stories.',
              inputSchema: {
                type: 'object',
                properties: {
                  campaign_id: { type: 'integer', description: 'The unique campaign ID' },
                  limit: { type: 'integer', description: 'Number of turns to fetch (default: all)' }
                },
                required: ['campaign_id']
              }
            },
            {
              name: 'get_character_state',
              description: 'Retrieve the player character details, stats (HP/Mana/XP/Level), and inventory logs.',
              inputSchema: {
                type: 'object',
                properties: {
                  campaign_id: { type: 'integer', description: 'The unique campaign ID' }
                },
                required: ['campaign_id']
              }
            },
            {
              name: 'search_memories',
              description: 'Search campaign long-term memories for important plot points, character events, or summaries.',
              inputSchema: {
                type: 'object',
                properties: {
                  campaign_id: { type: 'integer', description: 'The unique campaign ID' },
                  query: { type: 'string', description: 'Keyword query search terms' }
                },
                required: ['campaign_id', 'query']
              }
            }
          ]
        };
        break;

      case 'tools/call':
        rpcResponse.result = await handleToolCall(rpcRequest.params.name, rpcRequest.params.arguments);
        break;

      default:
        rpcResponse.error = {
          code: -32601,
          message: `Method not found: ${rpcRequest.method}`
        };
    }
  } catch (error) {
    rpcResponse.error = {
      code: -32603,
      message: error.message
    };
  }

  // Send the RPC response back via the open SSE stream
  clientResponseStream.write(`event: message\ndata: ${JSON.stringify(rpcResponse)}\n\n`);
  res.status(202).send('Accepted'); // Standard HTTP acknowledgement for SSE message receivers
});

// Helper for MCP Tools router
async function handleToolCall(toolName, args) {
  let contentText = '';

  try {
    switch (toolName) {
      case 'list_campaigns': {
        const campaigns = await db.all(`SELECT * FROM campaigns`);
        contentText = JSON.stringify(campaigns, null, 2);
        break;
      }

      case 'get_campaign_outline': {
        const row = await db.get(`SELECT * FROM campaign_outlines WHERE campaign_id = ?`, [args.campaign_id]);
        contentText = row ? JSON.stringify(JSON.parse(row.outline_json), null, 2) : 'Campaign outline not found.';
        break;
      }

      case 'get_campaign_history': {
        const limit = args.limit ? parseInt(args.limit) : 1000;
        const rows = await db.all(
          `SELECT turn_number, player_action, narrative FROM turns WHERE campaign_id = ? ORDER BY turn_number ASC LIMIT ?`,
          [args.campaign_id, limit]
        );
        if (rows.length === 0) {
          contentText = 'No history turns found for this campaign.';
        } else {
          contentText = rows.map(r => `[Turn ${r.turn_number}]\nPLAYER: ${r.player_action || '(Start Campaign)'}\nDM: ${r.narrative}\n---`).join('\n\n');
        }
        break;
      }

      case 'get_character_state': {
        const row = await db.get(`SELECT * FROM characters WHERE campaign_id = ?`, [args.campaign_id]);
        if (!row) {
          contentText = 'Character state not found.';
        } else {
          contentText = JSON.stringify({
            name: row.name,
            class: row.class,
            health: `${row.health}/${row.max_health}`,
            mana: `${row.mana}/${row.max_mana}`,
            level: row.level,
            xp: row.xp,
            inventory: JSON.parse(row.inventory_json),
            attributes: JSON.parse(row.attributes_json)
          }, null, 2);
        }
        break;
      }

      case 'search_memories': {
        const query = `%${args.query}%`;
        const rows = await db.all(
          `SELECT summary, keywords, created_at FROM memories WHERE campaign_id = ? AND (summary LIKE ? OR keywords LIKE ?) ORDER BY id DESC`,
          [args.campaign_id, query, query]
        );
        contentText = rows.length > 0 
          ? rows.map(r => `- [${r.created_at}] [Tags: ${r.keywords || 'None'}]: ${r.summary}`).join('\n')
          : `No memories found matching "${args.query}"`;
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (err) {
    contentText = `Error executing tool: ${err.message}`;
  }

  return {
    content: [
      {
        type: 'text',
        text: contentText
      }
    ]
  };
}

// Start server
app.listen(PORT, () => {
  console.log(`--------------------------------------------------------`);
  console.log(`   Aetheria DM Game & MCP Server running on port ${PORT}`);
  console.log(`   Local URL: http://localhost:${PORT}`);
  console.log(`   MCP SSE Endpoint: http://localhost:${PORT}/api/mcp/sse`);
  console.log(`--------------------------------------------------------`);
});
