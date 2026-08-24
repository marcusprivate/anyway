export function formatContentParagraphs(content) {
    if (typeof content !== 'string') {
        return '';
    }

    const normalized = content.replace(/\r\n?/g, '\n').trim();
    if (!normalized) {
        return '';
    }

    return normalized
        .split(/\n[\t ]*\n+/)
        .map(paragraph => `<p>${paragraph.trim().replace(/\n/g, '<br>')}</p>`)
        .join('');
}
