import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../assets/css/main.css', import.meta.url), 'utf8');

test('desktop single blog images retain their natural aspect ratio', () => {
    assert.match(css, /#blog-container \.blog-single-image img\s*\{[^}]*height:\s*auto;[^}]*max-width:\s*100%;[^}]*max-height:\s*50vh;/s);
});

test('mobile single blog images do not depend on viewport height', () => {
    const mobileBlogStyles = css.match(/@media screen and \(max-width: 736px\) \{([\s\S]*?)\n\}\n\n\/\* Custom: Homepage Magazine Layout \*\//)?.[1];

    assert.ok(mobileBlogStyles, 'missing blog mobile breakpoint');
    assert.match(mobileBlogStyles, /#blog-container \.blog-single-image img\s*\{[^}]*max-height:\s*none;/s);
});

test('blog paragraphs and card titles use the refined readable styles', () => {
    assert.match(css, /#blog-container article > p\s*\{[^}]*line-height:\s*1\.65;[^}]*margin:\s*0 0 0\.75rem 0;[^}]*text-align:\s*left;/s);
    assert.match(css, /#blog-container article > p:last-of-type\s*\{[^}]*margin-bottom:\s*0;/s);
    assert.match(css, /#blog-container article header h2\s*\{[^}]*font-size:\s*clamp\([^}]*text-wrap:\s*balance;/s);
});

test('mobile compaction is scoped to the blog page', () => {
    assert.match(css, /@media screen and \(max-width: 736px\)[\s\S]*?\.blog-page #header\s*\{[^}]*height:\s*10rem;/);
    assert.match(css, /\.blog-page #main > \.blog-tools\s*\{[^}]*padding:\s*2rem 1\.5rem 1rem 1\.5rem;/);
});
