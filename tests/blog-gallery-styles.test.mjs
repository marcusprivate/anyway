import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../assets/css/main.css', import.meta.url), 'utf8');

function rule(selector) {
    const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `missing ${selector} rule`);
    return match[1];
}

test('gallery reserves transparent space while styling the image itself as a card', () => {
    const frame = rule('#blog-container \\.blog-gallery-frame');
    const image = rule('#blog-container \\.blog-gallery-image img');

    assert.match(frame, /background:\s*transparent/);
    assert.match(frame, /overflow:\s*visible/);
    assert.match(image, /border-radius:/);
    assert.match(image, /box-shadow:/);
    assert.match(image, /min-height:\s*0/);
    assert.match(image, /height:\s*100%/);
    assert.match(image, /max-width:\s*100%/);
    assert.match(image, /max-height:\s*100%/);
});
