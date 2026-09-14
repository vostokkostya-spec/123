import test from 'node:test';
import assert from 'node:assert/strict';

import { createOrchestrator, classifyTask, parseCoderResponse, parseReviewerVerdict, truncateFileContext } from './orchestrator.js';
import { getDefaultAgents } from './agents.js';

test('coder response parsing rejects missing required markers', () => {
  assert.throws(
    () => parseCoderResponse('plain text', 'src/example.js'),
    /expected ### FILE and ### EXPLANATION/
  );
});

test('coder context is bounded to the input budget', () => {
  const context = truncateFileContext('a'.repeat(20000));
  assert.ok(context.content.length < 20000);
  assert.equal(context.truncated, true);
  assert.match(context.content, /Context truncated/);
});

test('reviewer defaults to ISSUES when no verdict marker is returned', () => {
  assert.equal(parseReviewerVerdict('The proposed change looks reasonable.'), 'ISSUES');
  assert.equal(parseReviewerVerdict('VERDICT: APPROVE\nNo issues found.'), 'APPROVE');
});

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
    const result = await createOrchestrator().run('Implement a health-check endpoint', {
      useLLM: true,
      route: { agent: getDefaultAgents().find((agent) => agent.id === 'coder'), routing: 'keyword' }
    });
    assert.equal(result.selectedAgent, 'Coding Agent');
    assert.equal(result.llm.available, true);
    assert.equal(result.llm.agentId, 'coder');
    assert.equal(result.llm.summary, 'Change plan generated');
  } finally {
    global.fetch = previousFetch;
  }
});

function mockRouterFetch(responseFactory) {
  return async (url, options = {}) => {
    if (url.endsWith('/api/version')) return { ok: true, json: async () => ({ version: '0.34.0' }) };
    if (url.endsWith('/api/tags')) return { ok: true, json: async () => ({ models: [{ name: 'qwen3:4b-instruct' }] }) };
    if (url.endsWith('/api/generate')) {
      return {
        ok: true,
        json: async () => ({ response: responseFactory(options), done: true })
      };
    }
    throw new Error(`Unexpected URL during test: ${url}`);
  };
}

test('LLM router accepts a valid agent response', async () => {
  const previousFetch = global.fetch;
  global.fetch = mockRouterFetch((options) => {
    const body = JSON.parse(options.body || '{}');
    assert.equal(body.options.temperature, 0);
    assert.equal(body.options.num_predict, 120);
    return '### AGENT: security\n### REASON: The task concerns secrets.';
  });
  try {
    const result = await classifyTask('How should we rotate leaked API secrets?');
    assert.equal(result.available, true);
    assert.equal(result.agentId, 'security');
    assert.equal(result.reason, 'The task concerns secrets.');
  } finally {
    global.fetch = previousFetch;
  }
});

for (const [name, response] of [
  ['unknown agent', '### AGENT: unknown\n### REASON: Not valid.'],
  ['missing marker', 'security is the best agent']
]) {
  test(`LLM router falls back for ${name}`, async () => {
    const previousFetch = global.fetch;
    global.fetch = mockRouterFetch(() => response);
    try {
      const result = await createOrchestrator().routeTask('an ambiguous task', { forceLLM: true });
      assert.equal(result.routing, 'keyword');
      assert.match(result.warning, /fallback/i);
    } finally {
      global.fetch = previousFetch;
    }
  });
}

test('LLM router falls back on timeout and connection failure', async (t) => {
  for (const failure of ['timeout', 'connection']) {
    await t.test(failure, async () => {
      const previousFetch = global.fetch;
      global.fetch = async () => {
        throw new Error(failure === 'timeout' ? 'operation timeout' : 'ECONNREFUSED');
      };
      try {
        const result = await createOrchestrator().routeTask('an ambiguous task', { forceLLM: true });
        assert.equal(result.routing, 'keyword');
        assert.match(result.warning, /fallback/i);
      } finally {
        global.fetch = previousFetch;
      }
    });
  }
});
