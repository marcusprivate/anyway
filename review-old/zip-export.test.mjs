import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildZip, crc32 } from './zip-export.mjs';

test('CRC32 matches the standard check value', () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('ZIP package contains review JSON and uploaded image bytes', async () => {
    const zip = await buildZip([
        { path: 'review.json', data: new Blob(['{"ok":true}\n']) },
        { path: 'uploaded-images/post/foto.webp', data: new Blob(['fake-image']) }
    ], new Date('2026-08-16T12:00:00'));
    const directory = await mkdtemp(path.join(tmpdir(), 'anyway-review-'));
    const archive = path.join(directory, 'review.zip');
    await writeFile(archive, new Uint8Array(await zip.arrayBuffer()));

    const result = spawnSync('unzip', ['-t', archive], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /review\.json/);
    assert.match(result.stdout, /uploaded-images\/post\/foto\.webp/);
});
