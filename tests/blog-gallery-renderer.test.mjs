import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../assets/js/blog.js', import.meta.url), 'utf8');

test('single-image renderer uses its natural-aspect styling hook', () => {
    assert.match(source, /class="image fit blog-single-image"/);
});

test('renderer inserts preformatted semantic content without wrapping it in one paragraph', () => {
    assert.match(source, /const contentHtml = formatContentParagraphs\(processedContent\)/);
    assert.match(source, /\$\{contentHtml\}/);
    assert.doesNotMatch(source, /<p>\$\{processedContent\}<\/p>/);
});

test('gallery renderer places controls below the image and does not relayout on photo changes', () => {
    assert.match(source, /blog-gallery-previous[^>]*aria-label="Vorige afbeelding"[^>]*>.*‹/s);
    assert.match(source, /blog-gallery-next[^>]*aria-label="Volgende afbeelding"[^>]*>.*›/s);
    assert.match(source, /<span class="blog-gallery-image">/);
    assert.doesNotMatch(source, /image fit blog-gallery-image/);
    assert.match(source, /<\/div>\s*<div class="blog-gallery-controls" aria-label="Galerijbediening">/);
    assert.match(source, /touchstart/);
    assert.match(source, /touchend/);
    const showFunction = source.slice(source.indexOf('const show ='), source.indexOf("previous.addEventListener"));
    assert.doesNotMatch(showFunction, /layoutBlogPosts/);
    assert.doesNotMatch(showFunction, /image\.(width|height)\s*=/);
});
