import assert from 'node:assert/strict';
import test from 'node:test';

import { formatContentParagraphs } from '../assets/js/blog-content-core.mjs';

test('blank lines create separate semantic paragraphs', () => {
    assert.equal(
        formatContentParagraphs('Eerste alinea.\n\nTweede alinea.'),
        '<p>Eerste alinea.</p><p>Tweede alinea.</p>'
    );
});

test('a single newline stays a line break within its paragraph', () => {
    assert.equal(
        formatContentParagraphs('Eerste regel\nTweede regel'),
        '<p>Eerste regel<br>Tweede regel</p>'
    );
});

test('paragraph formatting preserves inline HTML and normalizes line endings', () => {
    assert.equal(
        formatContentParagraphs('  Lees <a href="/agenda.html">de agenda</a>.\r\n\r\nTot snel.  '),
        '<p>Lees <a href="/agenda.html">de agenda</a>.</p><p>Tot snel.</p>'
    );
});

test('empty and non-string content render no paragraphs', () => {
    assert.equal(formatContentParagraphs(' \n\n '), '');
    assert.equal(formatContentParagraphs(null), '');
});
