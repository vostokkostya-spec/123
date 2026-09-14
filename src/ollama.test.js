import test from 'node:test';
import assert from 'node:assert/strict';

import { generateWithOllama, pickPreferredModel, resolveAgentModel, resolveNumCtx } from './ollama.js';

test('resolveAgentModel supports role-specific model switching', () => {
  const previous = process.env.OLLAMA_PLANNER_MODEL;
  process.env.OLLAMA_PLANNER_MODEL = 'gpt-oss:120b-cloud';
  try {
    assert.equal(resolveAgentModel('planner'), 'gpt-oss:120b-cloud');
    assert.equal(resolveAgentModel('coder', 'qwen3:4b-instruct'), 'qwen3:4b-instruct');
  } finally {
    if (previous === undefined) delete process.env.OLLAMA_PLANNER_MODEL;
    else process.env.OLLAMA_PLANNER_MODEL = previous;
  }
});

test('pickPreferredModel accepts an explicit override', () => {
  assert.equal(pickPreferredModel('custom-model', ['qwen3:4b', 'all-minilm:latest']), 'custom-model');
});

test('pickPreferredModel ignores embedding-only models and prefers chat defaults', () => {
  const chosen = pickPreferredModel(null, ['all-minilm:latest', 'qwen3:4b-instruct', 'gemma4:26b']);
  assert.equal(chosen, 'qwen3:4b-instruct');
});

test('resolveNumCtx respects the environment override', () => {
  const previous = process.env.OLLAMA_NUM_CTX;
  process.env.OLLAMA_NUM_CTX = '16384';

  try {
    assert.equal(resolveNumCtx(), 16384);
  } finally {
    if (previous === undefined) {
      delete process.env.OLLAMA_NUM_CTX;
    } else {
      process.env.OLLAMA_NUM_CTX = previous;
    }
  }
});

test('generateWithOllama chooses a safe chat model and passes num_ctx', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (url.endsWith('/api/version')) {
      return {
        ok: true,
        json: async () => ({ version: '0.7.0' })
      };
    }

    if (url.endsWith('/api/tags')) {
      return {
        ok: true,
        json: async () => ({
          models: [
            { name: 'all-minilm:latest' },
            { name: 'qwen3:4b-instruct' }
          ]
        })
      };
    }

    if (url.endsWith('/api/generate')) {
      const body = JSON.parse(options.body || '{}');
      assert.equal(body.model, 'qwen3:4b-instruct');
      assert.equal(body.options.num_ctx, 8192);
      return {
        ok: true,
        json: async () => ({ response: 'hello from test', done: true })
      };
    }

    throw new Error(`Unexpected URL during test: ${url}`);
  };

  try {
    const result = await generateWithOllama('Say hello');
    assert.equal(result.model, 'qwen3:4b-instruct');
    assert.equal(result.text, 'hello from test');
    assert.equal(result.num_ctx, 8192);
  } finally {
    global.fetch = previousFetch;
  }
});

test('generateWithOllama throws a usable error when Ollama is unavailable', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('connect ECONNREFUSED');
  };

  try {
    await assert.rejects(generateWithOllama('ping'), /Ollama is unavailable|Start Ollama/);
  } finally {
    global.fetch = previousFetch;
  }
});

test('generateWithOllama surfaces a timeout without hiding it', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  };

  try {
    await assert.rejects(generateWithOllama('ping'), /timeout|aborted/i);
  } finally {
    global.fetch = previousFetch;
  }
});
