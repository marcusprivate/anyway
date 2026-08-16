import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createUploadDescriptor,
    formatBytes,
    MAX_IMAGE_BYTES,
    sanitizeFilename
} from './upload-utils.mjs';

test('uploaded filenames are safe and byte sizes are readable', () => {
    assert.equal(sanitizeFilename(' Café foto (1).webp '), 'Cafe-foto-1.webp');
    assert.equal(sanitizeFilename('../../'), 'afbeelding');
    assert.equal(formatBytes(1024), '1 KB');
    assert.equal(formatBytes(1572864), '1.5 MB');
});

test('upload descriptors contain package metadata and a SHA-256 hash', async () => {
    const blob = new Blob(['image-data'], { type: 'image/webp' });
    const file = Object.assign(blob, { name: 'Nieuwe foto.webp' });
    const descriptor = await createUploadDescriptor(file, 'post-id', 'Blogtitel');

    assert.match(descriptor.id, /^upload:/);
    assert.equal(descriptor.originalFilename, 'Nieuwe foto.webp');
    assert.equal(descriptor.size, blob.size);
    assert.equal(descriptor.sha256.length, 64);
    assert.match(descriptor.packagePath, /^uploaded-images\/post-id\/[^/]+-Nieuwe-foto\.webp$/);
});

test('upload descriptors reject unsupported and oversized files', async () => {
    const unsupported = Object.assign(new Blob(['x'], { type: 'image/svg+xml' }), { name: 'x.svg' });
    await assert.rejects(() => createUploadDescriptor(unsupported, 'post', ''), /JPEG/);

    const oversized = {
        name: 'huge.jpg',
        type: 'image/jpeg',
        size: MAX_IMAGE_BYTES + 1,
        arrayBuffer: async () => new ArrayBuffer(0)
    };
    await assert.rejects(() => createUploadDescriptor(oversized, 'post', ''), /20 MB/);
});
