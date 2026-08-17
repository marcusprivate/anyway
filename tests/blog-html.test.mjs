import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('blog page closes the wrapper before loading scripts', async () => {
    const html = await readFile(new URL('../blog.html', import.meta.url), 'utf8');
    const openingDivs = html.match(/<div\b[^>]*>/gi) ?? [];
    const closingDivs = html.match(/<\/div>/gi) ?? [];

    assert.equal(openingDivs.length, closingDivs.length, 'every div, including #wrapper, has a closing tag');
});

test('blog page does not disable browser zoom', async () => {
    const html = await readFile(new URL('../blog.html', import.meta.url), 'utf8');

    assert.doesNotMatch(html, /<meta\s+[^>]*name=["']viewport["'][^>]*user-scalable\s*=\s*no/i);
});

test('blog content is exposed as the page main landmark', async () => {
    const html = await readFile(new URL('../blog.html', import.meta.url), 'utf8');

    assert.match(html, /<main\s+id=["']main["']>/i);
});
