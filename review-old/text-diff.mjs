function tokenize(text) {
    return text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
}

function lcsTable(before, after) {
    const table = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0));
    for (let left = before.length - 1; left >= 0; left -= 1) {
        for (let right = after.length - 1; right >= 0; right -= 1) {
            table[left][right] = before[left] === after[right]
                ? table[left + 1][right + 1] + 1
                : Math.max(table[left + 1][right], table[left][right + 1]);
        }
    }
    return table;
}

function appendSegment(segments, type, text) {
    if (!text) return;
    const previous = segments.at(-1);
    if (previous && previous.type === type) previous.text += text;
    else segments.push({ type, text });
}

export function diffTokens(before, after) {
    const left = tokenize(before);
    const right = tokenize(after);
    const table = lcsTable(left, right);
    const segments = [];
    let a = 0;
    let b = 0;
    while (a < left.length || b < right.length) {
        if (a < left.length && b < right.length && left[a] === right[b]) {
            appendSegment(segments, 'same', left[a]); a += 1; b += 1;
        } else if (b < right.length && (a === left.length || table[a][b + 1] > table[a + 1][b])) {
            appendSegment(segments, 'add', right[b]); b += 1;
        } else {
            appendSegment(segments, 'remove', left[a]); a += 1;
        }
    }
    return segments;
}

function paragraphs(text) {
    return text.trim().split(/\n\s*\n/).filter(Boolean);
}

export function compareParagraphs(before, after) {
    const left = paragraphs(before);
    const right = paragraphs(after);
    const table = lcsTable(left, right);
    const anchors = [];
    let a = 0;
    let b = 0;
    while (a < left.length && b < right.length) {
        if (left[a] === right[b]) { anchors.push([a, b]); a += 1; b += 1; }
        else if (table[a][b + 1] >= table[a + 1][b]) b += 1;
        else a += 1;
    }

    const rows = [];
    let leftStart = 0;
    let rightStart = 0;
    const appendRange = (leftEnd, rightEnd) => {
        const length = Math.max(leftEnd - leftStart, rightEnd - rightStart);
        for (let index = 0; index < length; index += 1) {
            const original = left[leftStart + index] || '';
            const improved = right[rightStart + index] || '';
            const segments = diffTokens(original, improved);
            rows.push({ original, improved, segments, changed: segments.some(segment => segment.type !== 'same') });
        }
    };
    anchors.forEach(([leftIndex, rightIndex]) => {
        appendRange(leftIndex, rightIndex);
        const original = left[leftIndex];
        rows.push({ original, improved: original, segments: [{ type: 'same', text: original }], changed: false });
        leftStart = leftIndex + 1;
        rightStart = rightIndex + 1;
    });
    appendRange(left.length, right.length);
    return rows;
}

export function comparisonRows(before, after, showFull = false) {
    const rows = compareParagraphs(before, after);
    if (showFull) return rows;
    return rows.filter((row, index) => row.changed || rows[index - 1]?.changed || rows[index + 1]?.changed);
}

export function comparisonSummary(rows) {
    const changed = rows.filter(row => row.changed);
    const edits = changed.reduce((total, row) => total + row.segments.filter(segment => segment.type !== 'same').length, 0);
    return { paragraphs: changed.length, edits };
}

function compactForComparison(value) {
    return value.toLocaleLowerCase('nl-NL').replace(/[\s\p{P}]/gu, '');
}

function editDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            current[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
                ? previous[rightIndex - 1]
                : Math.min(previous[rightIndex] + 1, current[rightIndex - 1] + 1, previous[rightIndex - 1] + 1);
        }
        previous.splice(0, previous.length, ...current);
    }
    return previous[right.length];
}

function contextualPhrase(text, start, end) {
    const words = [...text.matchAll(/\S+/g)];
    if (!words.length) return '';
    let first = words.findIndex(word => word.index + word[0].length > start);
    if (first === -1) first = words.length - 1;
    let last = words.findLastIndex(word => word.index < end);
    if (last === -1) last = first;
    first = Math.max(0, first - 1);
    last = Math.min(words.length - 1, last + 1);
    return text.slice(words[first].index, words[last].index + words[last][0].length);
}

function changeLabel(original, improved) {
    const from = original.trim();
    const to = improved.trim();
    if (from.replace(/\s/g, '') === to.replace(/\s/g, '') && from !== to) return 'Spatiëring';
    if (compactForComparison(from) === compactForComparison(to)) {
        if (!compactForComparison(from)) return 'Spatiëring';
        if (/\p{L}/u.test(from) && from.toLocaleLowerCase('nl-NL') === to.toLocaleLowerCase('nl-NL')) return 'Hoofdletter';
        return /\p{L}/u.test(from) ? 'Leesteken en hoofdletter' : 'Leesteken';
    }
    if (!from) return 'Toegevoegd';
    if (!to) return 'Verwijderd';
    if (/^[\p{L}]+$/u.test(from) && /^[\p{L}]+$/u.test(to) && Math.min(from.length, to.length) >= 4 && editDistance(from, to) <= 1) return 'Spelling';
    return '';
}

export function meaningfulChanges(rows) {
    const changes = [];
    rows.forEach((row, paragraphIndex) => {
        let originalOffset = 0;
        let improvedOffset = 0;
        let current = null;
        const finish = () => {
            if (!current) return;
            const original = row.original.slice(current.originalStart, current.originalEnd);
            const improved = row.improved.slice(current.improvedStart, current.improvedEnd);
            changes.push({
                paragraphIndex,
                original,
                improved,
                originalPhrase: contextualPhrase(row.original, current.originalStart, current.originalEnd),
                improvedPhrase: contextualPhrase(row.improved, current.improvedStart, current.improvedEnd),
                originalContext: row.original,
                improvedContext: row.improved,
                label: changeLabel(original, improved)
            });
            current = null;
        };
        row.segments.forEach(segment => {
            if (segment.type === 'same') {
                if (current && /^\s+$/u.test(segment.text)) {
                    originalOffset += segment.text.length;
                    improvedOffset += segment.text.length;
                    current.originalEnd = originalOffset;
                    current.improvedEnd = improvedOffset;
                    return;
                }
                finish();
                originalOffset += segment.text.length;
                improvedOffset += segment.text.length;
                return;
            }
            if (!current) current = {
                originalStart: originalOffset,
                originalEnd: originalOffset,
                improvedStart: improvedOffset,
                improvedEnd: improvedOffset
            };
            if (segment.type === 'remove') originalOffset += segment.text.length;
            if (segment.type === 'add') improvedOffset += segment.text.length;
            current.originalEnd = originalOffset;
            current.improvedEnd = improvedOffset;
        });
        finish();
    });
    return changes;
}

export function changeSummary(rows) {
    const changes = meaningfulChanges(rows);
    return { changes, paragraphs: new Set(changes.map(change => change.paragraphIndex)).size };
}
