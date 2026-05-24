import dotenv from 'dotenv';
dotenv.config();

/**
 * AI client class to unify API calls across Gemini, OpenAI, Claude, Ollama, and custom endpoints.
 */
export class AIClient {
  constructor(config = {}) {
    // Merge server environment configuration with optional runtime overrides
    this.provider = config.provider || process.env.AI_PROVIDER || 'gemini';
    this.model = config.model || process.env.AI_MODEL;
    this.apiKey = config.apiKey || this.getEnvKey(this.provider);
    this.baseUrl = config.baseUrl || process.env.CUSTOM_ENDPOINT_URL || '';
    this.ollamaUrl = config.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';

    // Set default models based on provider
    if (!this.model) {
      switch (this.provider) {
        case 'gemini':
          this.model = 'gemini-1.5-flash';
          break;
        case 'openai':
          this.model = 'gpt-4o-mini';
          break;
        case 'claude':
          this.model = 'claude-3-5-sonnet-20241022';
          break;
        case 'ollama':
          this.model = 'llama3';
          break;
        default:
          this.model = 'gpt-4o-mini';
      }
    }
  }

  getEnvKey(provider) {
    switch (provider) {
      case 'gemini': return process.env.GEMINI_API_KEY;
      case 'openai': return process.env.OPENAI_API_KEY;
      case 'claude': return process.env.ANTHROPIC_API_KEY;
      default: return null;
    }
  }

  async sendPrompt({ systemInstruction, prompt, jsonMode = false }) {
    if (this.provider === 'gemini') {
      return this.callGemini(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'openai') {
      return this.callOpenAI(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'claude') {
      return this.callClaude(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'ollama') {
      return this.callOllama(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'custom') {
      return this.callCustomOpenAI(systemInstruction, prompt, jsonMode);
    } else {
      throw new Error(`Unsupported AI provider: ${this.provider}`);
    }
  }

  async callGemini(system, prompt, jsonMode) {
    const key = this.apiKey;
    if (!key) throw new Error('Gemini API key is not configured.');

    // Note: Gemini 1.5 flash uses v1beta endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${key}`;
    
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {}
    };

    if (system) {
      requestBody.systemInstruction = {
        parts: [{ text: system }]
      };
    }

    if (jsonMode) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    try {
      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      throw new Error(`Failed to parse Gemini response structure: ${JSON.stringify(data)}`);
    }
  }

  async callOpenAI(system, prompt, jsonMode) {
    const key = this.apiKey;
    if (!key) throw new Error('OpenAI API key is not configured.');

    const url = 'https://api.openai.com/v1/chat/completions';
    
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: this.model,
      messages,
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async callClaude(system, prompt, jsonMode) {
    const key = this.apiKey;
    if (!key) throw new Error('Claude API key is not configured.');

    // Directly queries Anthropic API. (CORS not an issue as we are calling from Node.js backend)
    const url = this.baseUrl || 'https://api.anthropic.com/v1/messages';
    
    const messages = [{ role: 'user', content: prompt }];
    
    const requestBody = {
      model: this.model,
      messages,
      max_tokens: 4000
    };

    if (system) {
      requestBody.system = system;
    }

    // Claude does not support jsonMode response parameter directly in the same way,
    // but we prompt it strongly to return JSON in the system instruction.
    // If it's a proxy that supports OpenAI format, we could route through callCustomOpenAI.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async callOllama(system, prompt, jsonMode) {
    const url = `${this.ollamaUrl}/api/chat`;

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: this.model,
      messages,
      stream: false
    };

    if (jsonMode) {
      requestBody.format = 'json';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    return data.message.content;
  }

  async callCustomOpenAI(system, prompt, jsonMode) {
    if (!this.baseUrl) throw new Error('Custom endpoint base URL is not configured.');

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: this.model,
      messages
    };

    if (jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Custom OpenAI endpoint error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
