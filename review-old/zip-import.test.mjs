import assert from 'node:assert/strict';
import test from 'node:test';
import { buildZip } from './zip-export.mjs';
import { readCheckpointZip } from './zip-import.mjs';

test('checkpoint ZIP reader restores files created by the exporter', async () => {
    const zip = await buildZip([
        { path: 'review.json', data: new Blob(['{"ok":true}\n']) },
        { path: 'uploaded-images/post/photo.jpg', data: new Blob(['image']) }
    ]);
    const files = readCheckpointZip(new Uint8Array(await zip.arrayBuffer()));
    assert.equal(new TextDecoder().decode(files.get('review.json')), '{"ok":true}\n');
    assert.equal(new TextDecoder().decode(files.get('uploaded-images/post/photo.jpg')), 'image');
});

test('checkpoint ZIP reader rejects unsafe paths and corrupt bytes', async () => {
    const unsafe = await buildZip([{ path: '../review.json', data: new Blob(['{}']) }]);
    const unsafeBytes = new Uint8Array(await unsafe.arrayBuffer());
    assert.throws(() => readCheckpointZip(unsafeBytes), /onveilig/);

    const valid = new Uint8Array(await (await buildZip([{ path: 'review.json', data: new Blob(['{}']) }])).arrayBuffer());
    valid[41] ^= 1;
    assert.throws(() => readCheckpointZip(valid), /beschadigd/);
});

test('checkpoint ZIP reader rejects bytes appended after a valid archive', async () => {
    const zip = await buildZip([{ path: 'review.json', data: new Blob(['{}']) }]);
    const original = new Uint8Array(await zip.arrayBuffer());
    const withTrailingBytes = new Uint8Array(original.length + 1);
    withTrailingBytes.set(original);
    withTrailingBytes[withTrailingBytes.length - 1] = 1;
    assert.throws(() => readCheckpointZip(withTrailingBytes), /beschadigd/);
});

test('checkpoint ZIP reader rejects a mismatched central-directory size', async () => {
    const zip = await buildZip([{ path: 'review.json', data: new Blob(['{}']) }]);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    const centralOffset = 30 + 'review.json'.length + 2;
    new DataView(bytes.buffer).setUint32(centralOffset + 20, 3, true);
    assert.throws(() => readCheckpointZip(bytes), /beschadigd/);
});
