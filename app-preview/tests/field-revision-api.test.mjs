import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const output = await build({
  entryPoints: ['src/lib/lesson-coach-api.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{
    name: 'test-only-settings',
    setup(builder) {
      builder.onResolve({ filter: /LL_SettingsService$/ }, () => ({ path: 'settings', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const LL_SettingsService = { getAll: async () => ({success:true,data:[{CoachFlowUrl:"https://flow.example.test/revision"}]}) };' }));
      builder.onResolve({ filter: /\?raw$/ }, (args) => ({ path: path.resolve('src/prompts/prompt.md'), namespace: 'raw' }));
      builder.onLoad({ filter: /.*/, namespace: 'raw' }, async (args) => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
    },
  }],
});
const api = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
test('real request builder uses existing flow, sends bounded references and no attachments or identity', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ reply: JSON.stringify({ field: 'recommendation', replacement: 'Proposed check.', explanation: 'Use the source practice.', questions: [], sourceIds: [71] }) }));
  };
  try {
    const source = { id: 71, title: 'Cable tray check', recommendation: 'Confirm clearance.', pdf: { link: 'https://example.test/source', name: 'PDF' } };
    const form = { title: 'A draft', situation: 'A conflict.', rootCause: 'Unknown.', impact: 'Rework.', recommendation: 'Check first.', author: 'private person', attachments: [{ name: 'private-file' }] };
    const reply = await api.askFieldRevision('recommendation', form, [source]);
    assert.equal(captured.url, 'https://flow.example.test/revision');
    assert.equal(captured.body.author, undefined);
    assert.equal(captured.body.attachments, undefined);
    assert(captured.body.question.includes('Confirm clearance.'));
    assert(captured.body.question.includes('never turn their events or outcomes into claims'));
    assert.equal(reply.replacement, 'Proposed check.');
    const controller = new AbortController(); controller.abort();
    await assert.rejects(api.askFieldRevision('recommendation', form, [], controller.signal), /abort/i);
  } finally { globalThis.fetch = originalFetch; }
});
