import test from 'node:test';
import assert from 'node:assert/strict';

import { createOrchestrator } from './orchestrator.js';

test('coder uses the Ollama-backed implementation prompt', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (url.endsWith('/api/version')) {
      return { ok: true, json: async () => ({ version: '0.34.0' }) };
    }

    if (url.endsWith('/api/tags')) {
      return {
        ok: true,
        json: async () => ({ models: [{ name: 'qwen3:4b-instruct' }] })
      };
    }

    if (url.endsWith('/api/generate')) {
      const body = JSON.parse(options.body || '{}');
      assert.match(body.prompt, /coding agent/i);
      assert.match(body.prompt, /files to change/i);
      return {
        ok: true,
        json: async () => ({ response: 'Change plan generated', done: true })
      };
    }

    throw new Error(`Unexpected URL during test: ${url}`);
  };

  try {
    const result = await createOrchestrator().run('Implement a health-check endpoint', { useLLM: true });
    assert.equal(result.selectedAgent, 'Coding Agent');
    assert.equal(result.llm.available, true);
    assert.equal(result.llm.agentId, 'coder');
    assert.equal(result.llm.summary, 'Change plan generated');
  } finally {
    global.fetch = previousFetch;
  }
});
