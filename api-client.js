import net from 'net';
import dns from 'dns';
import { promisify } from 'util';
import dotenv from 'dotenv';
dotenv.config();

const dnsLookup = promisify(dns.lookup);

/**
 * Checks if a given IP address is private, loopback, or link-local.
 */
function isPrivateIp(ip) {
  if (!ip) return false;
  
  // Clean brackets if it's an IPv6 literal
  const cleanIp = ip.replace(/^\[|\]$/g, '');

  const family = net.isIP(cleanIp);
  if (family === 4) {
    const parts = cleanIp.split('.').map(Number);
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8 (broadcast/any)
    if (parts[0] === 0) return true;
    return false;
  }
  
  if (family === 6) {
    const lowerIp = cleanIp.toLowerCase();
    // Loopback (::1)
    if (lowerIp === '::1' || lowerIp === '0:0:0:0:0:0:0:1') return true;
    // Unspecified (::)
    if (lowerIp === '::' || lowerIp === '0:0:0:0:0:0:0:0') return true;
    // Link-local (fe80::/10)
    if (lowerIp.startsWith('fe8') || lowerIp.startsWith('fe9') || lowerIp.startsWith('fea') || lowerIp.startsWith('feb')) return true;
    // Unique local address (fc00::/7)
    if (lowerIp.startsWith('fc') || lowerIp.startsWith('fd')) return true;
    
    // IPv4-mapped IPv6 address (::ffff:127.0.0.1)
    if (lowerIp.startsWith('::ffff:')) {
      const ipv4Part = cleanIp.substring(7);
      return isPrivateIp(ipv4Part);
    }
    return false;
  }
  
  return false;
}

/**
 * Validates request URLs to block SSRF (Server-Side Request Forgery) attacks (synchronous literal check).
 */
function validateUrlForSsrfSync(urlString, allowedLocalUrl) {
  if (!urlString) return;
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS protocols are permitted.');
    }
    
    const hostname = url.hostname.toLowerCase();
    
    // If it matches the server administrator's configured URL in .env, trust it
    if (allowedLocalUrl) {
      try {
        const allowed = new URL(allowedLocalUrl);
        if (url.origin === allowed.origin) {
          return; // Match found. Trust
        }
      } catch (e) {}
    }

    // List of trusted public cloud LLM API domains
    const trustedHosts = [
      'generativelanguage.googleapis.com',
      'api.openai.com',
      'api.anthropic.com',
      'api.x.ai'
    ];

    if (trustedHosts.includes(hostname)) {
      return; 
    }

    if (isPrivateIp(hostname)) {
      throw new Error('Access to local/private network addresses is blocked.');
    }
  } catch (e) {
    throw new Error(`SSRF Blocked: URL "${urlString}" is invalid. Reason: ${e.message}`);
  }
}

/**
 * Validates request URLs to block SSRF attacks asynchronously by resolving hostnames.
 */
async function validateUrlForSsrfAsync(urlString, allowedLocalUrl) {
  validateUrlForSsrfSync(urlString, allowedLocalUrl);
  if (!urlString) return;

  const url = new URL(urlString);
  const hostname = url.hostname.toLowerCase();

  // If it's a trusted public cloud host or explicitly configured, bypass DNS lookup
  const trustedHosts = [
    'generativelanguage.googleapis.com',
    'api.openai.com',
    'api.anthropic.com',
    'api.x.ai'
  ];
  if (trustedHosts.includes(hostname)) return;

  if (allowedLocalUrl) {
    try {
      const allowed = new URL(allowedLocalUrl);
      if (url.origin === allowed.origin) return;
    } catch (e) {}
  }

  let lookupResult;
  try {
    lookupResult = await dnsLookup(hostname);
  } catch (dnsErr) {
    throw new Error(`SSRF Blocked: Unable to verify hostname "${hostname}". Reason: ${dnsErr.message}`);
  }

  if (isPrivateIp(lookupResult.address)) {
    throw new Error('SSRF Blocked: Resolved host points to local/private network address.');
  }
}

/**
 * Fetch wrapper with timeout protection to prevent hung requests from blocking queues.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 240000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // The SSRF guard validates DNS before fetch. Node's fetch performs its own
    // resolution afterward, so this reduces accidental/private endpoint access
    // but is not a complete DNS-rebinding defense for untrusted domains.
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`AI Request Timed Out (Limit: ${timeoutMs / 1000}s)`);
    }
    throw error;
  }
}

/**
 * AI client class to unify API calls across Gemini, OpenAI, Claude, xAI Grok, Ollama, and custom endpoints.
 */
export class AIClient {
  constructor(config = {}) {
    // Merge server environment configuration with optional runtime overrides
    this.provider = config.provider || process.env.AI_PROVIDER || 'gemini';
    this.model = config.model || process.env.AI_MODEL;
    this.apiKey = config.apiKey || this.getEnvKey(this.provider);
    
    const isProduction = process.env.NODE_ENV === 'production';
    const rawBaseUrl = (isProduction ? null : config.baseUrl) || process.env.CUSTOM_ENDPOINT_URL || '';
    const rawOllamaUrl = (isProduction ? null : config.ollamaUrl) || process.env.OLLAMA_URL || 'http://localhost:11434';

    // Run SSRF verification checks on endpoints
    validateUrlForSsrfSync(rawBaseUrl, process.env.CUSTOM_ENDPOINT_URL);
    validateUrlForSsrfSync(rawOllamaUrl, process.env.OLLAMA_URL || 'http://localhost:11434');

    this.baseUrl = rawBaseUrl;
    this.ollamaUrl = rawOllamaUrl;

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
        case 'grok':
          this.model = 'grok-3';
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
      case 'grok': return process.env.XAI_API_KEY || process.env.GROK_API_KEY;
      default: return null;
    }
  }

  async sendPrompt({ systemInstruction, prompt, jsonMode = false }) {
    if (this.baseUrl) {
      await validateUrlForSsrfAsync(this.baseUrl, process.env.CUSTOM_ENDPOINT_URL);
    }
    if (this.ollamaUrl && this.provider === 'ollama') {
      await validateUrlForSsrfAsync(this.ollamaUrl, process.env.OLLAMA_URL || 'http://localhost:11434');
    }

    if (this.provider === 'gemini') {
      return this.callGemini(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'openai') {
      return this.callOpenAI(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'claude') {
      return this.callClaude(systemInstruction, prompt, jsonMode);
    } else if (this.provider === 'grok') {
      return this.callGrok(systemInstruction, prompt, jsonMode);
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    
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

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
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

    const response = await fetchWithTimeout(url, {
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

  async callGrok(system, prompt, jsonMode) {
    const key = this.apiKey;
    if (!key) throw new Error('xAI Grok API key is not configured (set XAI_API_KEY or provide in UI).');

    // Allow baseUrl override (useful for proxies, OpenRouter with Grok models, etc.)
    // When using the native 'grok' provider the official endpoint is used by default.
    const url = this.baseUrl || 'https://api.x.ai/v1/chat/completions';
    
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

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`xAI Grok API error: ${response.status} ${response.statusText} - ${errText}`);
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
    const response = await fetchWithTimeout(url, {
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

    const response = await fetchWithTimeout(url, {
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

    const response = await fetchWithTimeout(this.baseUrl, {
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
