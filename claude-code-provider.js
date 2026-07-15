import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 240_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 900_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const STRIPPED_AUTH_ENV = new Set([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY'
]);

function providerError(message, { status, transient = false, code } = {}) {
  const error = new Error(message);
  error.name = 'ClaudeCodeProviderError';
  if (Number.isInteger(status)) error.status = status;
  if (transient) error.transient = true;
  if (code) error.code = code;
  return error;
}

function safeStatusField(value) {
  if (typeof value !== 'string') return '';
  const clean = value.trim().slice(0, 80);
  return /^[A-Za-z0-9._ -]*$/.test(clean) ? clean : '';
}

export function claudeCodeTimeoutMs(env = process.env) {
  const configured = Number(env.CLAUDE_CODE_TIMEOUT_MS);
  return Number.isInteger(configured) && configured >= MIN_TIMEOUT_MS && configured <= MAX_TIMEOUT_MS
    ? configured
    : DEFAULT_TIMEOUT_MS;
}

export function resolveClaudeCodeExecutable(env = process.env) {
  const configured = typeof env.CLAUDE_CODE_PATH === 'string' ? env.CLAUDE_CODE_PATH.trim() : '';
  if (!configured) return 'claude';
  if (!path.isAbsolute(configured)) {
    throw providerError('Claude Code executable configuration is invalid.', { code: 'INVALID_EXECUTABLE' });
  }
  return configured;
}

export function sanitizeClaudeCodeEnv(env = process.env) {
  const sanitized = { ...env };
  for (const key of Object.keys(sanitized)) {
    if (STRIPPED_AUTH_ENV.has(key.toUpperCase())) delete sanitized[key];
  }
  return sanitized;
}

function boundedRunnerResult(result, maxOutputBytes = MAX_OUTPUT_BYTES) {
  const stdout = typeof result?.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result?.stderr === 'string' ? result.stderr : '';
  if (Buffer.byteLength(stdout) > maxOutputBytes || Buffer.byteLength(stderr) > maxOutputBytes) {
    throw providerError('Claude Code response exceeded the output limit.', { code: 'OUTPUT_LIMIT' });
  }
  return {
    exitCode: Number.isInteger(result?.exitCode) ? result.exitCode : 1,
    stdout,
    stderr
  };
}

/**
 * Bounded, shell-free process runner. The returned strings are consumed only
 * by the parsers below; raw output is never placed into an error message.
 */
export function runClaudeCodeProcess({
  executable,
  args,
  stdin = '',
  env,
  cwd,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxOutputBytes = MAX_OUTPUT_BYTES
}, { spawnImpl = spawn } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(executable, args, {
        cwd,
        env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      reject(providerError('Claude Code is not installed or executable.', { code: 'EXECUTABLE_UNAVAILABLE' }));
      return;
    }

    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let terminalError = null;
    let settled = false;
    let escalationTimer = null;
    let giveUpTimer = null;

    const clearTimers = () => {
      clearTimeout(timeoutTimer);
      if (escalationTimer) clearTimeout(escalationTimer);
      if (giveUpTimer) clearTimeout(giveUpTimer);
    };
    const finish = (method, value) => {
      if (settled) return;
      settled = true;
      clearTimers();
      method(value);
    };
    const terminate = error => {
      if (terminalError) return;
      terminalError = error;
      try { child.kill('SIGTERM'); } catch (killError) { /* close/error handlers settle */ }
      escalationTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (killError) { /* bounded fallback below settles */ }
      }, 250);
      giveUpTimer = setTimeout(() => finish(reject, terminalError), 1_000);
    };

    const timeoutTimer = setTimeout(() => {
      terminate(providerError('Claude Code request timed out.', {
        transient: true,
        code: 'TIMEOUT'
      }));
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      const buffer = Buffer.from(chunk);
      stdoutBytes += buffer.length;
      if (stdoutBytes > maxOutputBytes) {
        terminate(providerError('Claude Code response exceeded the output limit.', { code: 'OUTPUT_LIMIT' }));
        return;
      }
      stdout.push(buffer);
    });
    child.stderr.on('data', chunk => {
      const buffer = Buffer.from(chunk);
      stderrBytes += buffer.length;
      if (stderrBytes > maxOutputBytes) {
        terminate(providerError('Claude Code response exceeded the output limit.', { code: 'OUTPUT_LIMIT' }));
        return;
      }
      stderr.push(buffer);
    });
    child.on('error', error => {
      finish(reject, providerError('Claude Code is not installed or executable.', {
        code: 'EXECUTABLE_UNAVAILABLE'
      }));
    });
    child.on('close', exitCode => {
      if (terminalError) {
        finish(reject, terminalError);
        return;
      }
      finish(resolve, {
        exitCode: Number.isInteger(exitCode) ? exitCode : 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8')
      });
    });
    child.stdin.on('error', () => { /* early child exit is classified from close/output */ });
    child.stdin.end(String(stdin));
  });
}

export function parseClaudeCodeAuthStatus(stdout, exitCode = 0) {
  let data;
  try {
    data = JSON.parse(stdout);
  } catch (error) {
    throw providerError('Claude Code authentication status could not be verified.', {
      code: 'AUTH_STATUS_INVALID'
    });
  }
  if (exitCode !== 0 || data?.loggedIn !== true || data?.authMethod !== 'claude.ai') {
    throw providerError('Claude Code is not logged in through a Claude.ai subscription.', {
      code: 'SUBSCRIPTION_AUTH_REQUIRED'
    });
  }
  return {
    installed: true,
    loggedIn: true,
    authMethod: 'claude.ai',
    subscriptionType: safeStatusField(data.subscriptionType),
    apiProvider: safeStatusField(data.apiProvider)
  };
}

export function parseClaudeCodeStatus(stdout, exitCode = 0) {
  let data;
  try {
    data = JSON.parse(stdout);
  } catch (error) {
    data = {};
  }
  const authMethod = safeStatusField(data.authMethod);
  return {
    loggedIn: exitCode === 0 && data.loggedIn === true && authMethod === 'claude.ai',
    authMethod,
    subscriptionType: safeStatusField(data.subscriptionType)
  };
}

function parseClaudeCodeVersion(stdout, exitCode = 0) {
  if (exitCode !== 0 || typeof stdout !== 'string') return '';
  const match = stdout.trim().match(/^([0-9]+(?:\.[0-9]+){1,3})(?:\s|$)/);
  return match ? match[1] : '';
}

/** Safe, usage-free install/login/plan status for the admin catalog route. */
export async function getClaudeCodeStatus({
  env = process.env,
  runner = runClaudeCodeProcess,
  timeoutMs = 10_000
} = {}) {
  const unavailable = {
    installed: false,
    loggedIn: false,
    authMethod: '',
    subscriptionType: '',
    version: ''
  };
  let executable;
  try {
    executable = resolveClaudeCodeExecutable(env);
  } catch (error) {
    return unavailable;
  }

  const childEnv = sanitizeClaudeCodeEnv(env);
  const deadline = Date.now() + timeoutMs;
  let cwd;
  let installed = false;
  let version = '';
  try {
    cwd = await mkdtemp(path.join(os.tmpdir(), 'aetheria-claude-code-status-'));
    const run = async args => boundedRunnerResult(await runner({
      executable,
      args,
      stdin: '',
      env: childEnv,
      cwd,
      shell: false,
      timeoutMs: Math.max(1, deadline - Date.now()),
      maxOutputBytes: MAX_OUTPUT_BYTES
    }));

    const versionResult = await run(['--version']);
    version = parseClaudeCodeVersion(versionResult.stdout, versionResult.exitCode);
    if (!version) return unavailable;
    installed = true;
    const authResult = await run(['auth', 'status', '--json']);
    return {
      installed,
      ...parseClaudeCodeStatus(authResult.stdout, authResult.exitCode),
      version
    };
  } catch (error) {
    return {
      ...unavailable,
      installed,
      version
    };
  } finally {
    if (cwd) await rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
}

export function parseClaudeCodeGeneration(stdout, exitCode = 0) {
  let data;
  try {
    data = JSON.parse(stdout);
  } catch (error) {
    throw providerError('Claude Code returned an invalid response.', { code: 'INVALID_RESPONSE' });
  }

  if (exitCode === 0 && data?.is_error !== true && typeof data?.result === 'string') {
    return data.result;
  }

  const status = Number.isInteger(data?.api_error_status) && data.api_error_status >= 100
    && data.api_error_status <= 599
    ? data.api_error_status
    : undefined;
  throw providerError(
    status ? `Claude Code request failed (status ${status}).` : 'Claude Code request failed.',
    { status, code: 'GENERATION_FAILED' }
  );
}

function generationArgs(systemInstruction, model) {
  const args = [
    '--print',
    '--output-format', 'json',
    '--no-session-persistence',
    '--max-turns', '1',
    '--tools', '',
    '--disable-slash-commands',
    '--setting-sources', '',
    '--strict-mcp-config',
    '--mcp-config', '{"mcpServers":{}}',
    '--no-chrome',
    '--permission-mode', 'dontAsk',
    '--system-prompt', String(systemInstruction ?? '')
  ];
  const selectedModel = typeof model === 'string' ? model.trim() : '';
  if (selectedModel && selectedModel !== 'default') args.push('--model', selectedModel);
  return args;
}

/**
 * Invoke the logged-in Claude Code subscription as one AIClient transport.
 * Tests inject runner; production uses the bounded child-process runner above.
 */
export async function callClaudeCode({
  systemInstruction,
  prompt,
  model,
  env = process.env,
  runner = runClaudeCodeProcess
}) {
  const executable = resolveClaudeCodeExecutable(env);
  const childEnv = sanitizeClaudeCodeEnv(env);
  const timeoutMs = claudeCodeTimeoutMs(env);
  const deadline = Date.now() + timeoutMs;
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'aetheria-claude-code-'));
  const run = async (args, stdin = '') => boundedRunnerResult(await runner({
    executable,
    args,
    stdin,
    env: childEnv,
    cwd,
    shell: false,
    timeoutMs: Math.max(1, deadline - Date.now()),
    maxOutputBytes: MAX_OUTPUT_BYTES
  }));

  try {
    const auth = await run(['auth', 'status', '--json']);
    parseClaudeCodeAuthStatus(auth.stdout, auth.exitCode);
    const generated = await run(generationArgs(systemInstruction, model), String(prompt ?? ''));
    return parseClaudeCodeGeneration(generated.stdout, generated.exitCode);
  } finally {
    try {
      await rm(cwd, { recursive: true, force: true });
    } catch (error) {
      throw providerError('Claude Code temporary workspace cleanup failed.', {
        code: 'WORKSPACE_CLEANUP_FAILED'
      });
    }
  }
}
