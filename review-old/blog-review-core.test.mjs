import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    activeImages,
    addUploads,
    buildExportPayload,
    buildStoragePayload,
    createRecord,
    decidedRecord,
    dutchDateToIso,
    formatTitle,
    hydrateRecords,
    isoDateToDutch,
    modifiedRecord,
    moveImage,
    removeImage,
    replaceImage,
    resetRecord,
    restoreImage,
    reviewedDiffers,
    selectReviewedText,
    summarize
} from './blog-review-core.mjs';

const fixture = JSON.parse(await readFile(new URL('./blogs-data.json', import.meta.url), 'utf8'));
const posts = fixture.posts;

test('frozen review data has the verified size and unique IDs', () => {
    assert.equal(fixture.schemaVersion, 3);
    assert.equal(fixture.kind, 'anyway-old-blog-review-source');
    assert.equal(posts.length, 41);
    assert.equal(new Set(posts.map(post => post.sourceId)).size, 41);
    assert.equal(posts.flatMap(post => post.images).length, 58);
    posts.forEach(post => {
        assert.ok(post.sourceTitle.trim());
        assert.ok(post.title.trim());
        assert.ok(post.date.trim());
        assert.equal(typeof post.location, 'string');
        assert.ok(post.content.trim());
        assert.ok(post.improvedContent.trim());
    });
    assert.equal(posts.filter(post => post.location).length, 35);
});

test('formatted titles match the public title - location convention', () => {
    const located = posts.filter(post => post.location);
    const unlocated = posts.filter(post => !post.location);

    assert.equal(located.length, 35);
    assert.equal(unlocated.length, 6);
    located.forEach(post => {
        assert.equal(formatTitle(post.title, post.location), `${post.title} - ${post.location}`);
    });
    unlocated.forEach(post => {
        assert.equal(formatTitle(post.title, post.location), post.title);
        assert.equal(formatTitle(`  ${post.title}  `, '  '), post.title);
    });
});

test('Dutch dates round-trip through the date editor format', () => {
    assert.equal(dutchDateToIso('19 december 2012'), '2012-12-19');
    assert.equal(isoDateToDutch('2012-12-19'), '19 december 2012');
    assert.equal(dutchDateToIso('31 februari 2012'), '');
    assert.equal(isoDateToDutch('2012-02-31'), '');
});

test('stored state is hydrated safely and ignores unknown records', () => {
    const first = posts[0];
    const stored = buildStoragePayload({
        [first.sourceId]: modifiedRecord({
            title: 'Nieuwe titel',
            date: first.date,
            content: 'Nieuwe tekst'
        }),
        unknown: { decision: 'approved', reviewed: {} }
    });
    const records = hydrateRecords(posts, stored);
    assert.equal(Object.keys(records).length, 41);
    assert.equal(records[first.sourceId].decision, 'modified');
    assert.equal(records[first.sourceId].reviewed.title, 'Nieuwe titel');
    assert.equal(records[posts[1].sourceId].decision, 'pending');
});

test('version 1 stored reviews reset decisions and select improved text', () => {
    const first = posts.find(post => post.sourceTitle !== post.title);
    const records = hydrateRecords(posts, {
        schemaVersion: 1,
        records: {
            [first.sourceId]: {
                decision: 'approved',
                reviewed: {
                    title: first.sourceTitle,
                    date: first.date,
                    content: first.content
                }
            }
        }
    });

    assert.equal(records[first.sourceId].decision, 'pending');
    assert.equal(records[first.sourceId].reviewed.title, first.title);
    assert.equal(records[first.sourceId].reviewed.location, first.location);
    assert.equal(records[first.sourceId].reviewed.textSelection, 'improved');
    assert.equal(records[first.sourceId].reviewed.content, first.improvedContent);
});

test('version 2 migration preserves genuinely edited titles', () => {
    const first = posts.find(post => post.sourceTitle !== post.title);
    const records = hydrateRecords(posts, {
        schemaVersion: 2,
        records: {
            [first.sourceId]: {
                decision: 'modified',
                reviewed: {
                    title: 'Mijn eigen titel',
                    date: first.date,
                    location: first.location,
                    content: first.content
                }
            }
        }
    });

    assert.equal(records[first.sourceId].decision, 'pending');
    assert.equal(records[first.sourceId].reviewed.title, 'Mijn eigen titel');
});

test('versions 1 through 3 migrate review text and initialize original galleries', () => {
    const post = posts.find(candidate => candidate.images.length > 1);
    [1, 2, 3].forEach(schemaVersion => {
        const records = hydrateRecords(posts, {
            schemaVersion,
            records: {
                [post.sourceId]: {
                    decision: 'modified',
                    reviewed: {
                        title: 'Bewaarde titel',
                        date: post.date,
                        location: post.location,
                        content: 'Bewaarde tekst'
                    }
                }
            }
        });
        assert.equal(records[post.sourceId].reviewed.title, 'Bewaarde titel');
        assert.equal(records[post.sourceId].reviewed.content, 'Bewaarde tekst');
        assert.equal(records[post.sourceId].reviewed.textSelection, 'custom');
        assert.equal(records[post.sourceId].reviewed.customContent, 'Bewaarde tekst');
        assert.equal(activeImages(records[post.sourceId].reviewed.images).length, post.images.length);
    });
});

test('version 4 removes proven Typepad comment artifacts without losing edits or images', () => {
    const post = posts.find(candidate => candidate.sourceId === '2007-09-17-trouwerij-in-carre');
    const reviewed = createRecord(post).reviewed;
    const upload = {
        id: 'upload:migrated',
        originalFilename: 'migrated.webp',
        mimeType: 'image/webp',
        size: 123,
        sha256: 'migrated-hash',
        packagePath: `uploaded-images/${post.sourceId}/migrated.webp`,
        alt: 'Migrated image'
    };
    const editedContent = `Reviewer introduction.\n\n${post.content}\n\nURL: http://profile.typekey.com/1233844586s3136/\nDATE: 15 februari 2009\nHet was heel bijzonder om mee te maken`;
    const records = hydrateRecords(posts, {
        schemaVersion: 4,
        records: {
            [post.sourceId]: {
                decision: 'approved',
                reviewed: {
                    ...reviewed,
                    content: editedContent,
                    images: addUploads(reviewed.images, [upload])
                }
            }
        }
    });

    assert.equal(records[post.sourceId].decision, 'pending');
    assert.equal(records[post.sourceId].reviewed.content, `Reviewer introduction.\n\n${post.content}`);
    assert.equal(records[post.sourceId].reviewed.textSelection, 'custom');
    assert.deepEqual(records[post.sourceId].reviewed.images.uploads, [upload]);
    assert.equal(records[post.sourceId].reviewed.images.order.at(-1), upload.id);
});

test('version 4 strips proven heading markup but preserves unrelated custom content', () => {
    const broadway = posts.find(candidate => candidate.sourceId === '2004-05-28-broadway-den-hoorn');
    const custom = posts.find(candidate => candidate.sourceId === '2009-08-22-molenaarsweekend');
    const records = hydrateRecords(posts, {
        schemaVersion: 4,
        records: {
            [broadway.sourceId]: {
                decision: 'modified',
                reviewed: {
                    ...createRecord(broadway).reviewed,
                    content: `<h1>Broadway opnieuw bijzonder festival</h1>\n<small></small>\n\nReviewer edit.`
                }
            },
            [custom.sourceId]: {
                decision: 'modified',
                reviewed: {
                    ...createRecord(custom).reviewed,
                    content: 'Custom reviewer text with DATE mentioned naturally.'
                }
            }
        }
    });

    assert.equal(records[broadway.sourceId].reviewed.content, 'Broadway opnieuw bijzonder festival\n\nReviewer edit.');
    assert.equal(records[custom.sourceId].reviewed.content, 'Custom reviewer text with DATE mentioned naturally.');
});

test('gallery operations keep explicit order and removal decisions', () => {
    const post = posts.find(candidate => candidate.images.length > 1);
    const original = createRecord(post).reviewed.images;
    const firstId = original.order[0];
    const secondId = original.order[1];
    const upload = {
        id: 'upload:test-id',
        originalFilename: 'nieuw.webp',
        mimeType: 'image/webp',
        size: 123,
        sha256: 'abc123',
        packagePath: `uploaded-images/${post.sourceId}/test-id-nieuw.webp`,
        alt: 'Nieuwe afbeelding'
    };

    const removed = removeImage(original, firstId);
    assert.equal(removed.existing.find(image => image.id === firstId).decision, 'remove');
    assert.equal(removed.order.includes(firstId), false);

    const restored = restoreImage(removed, firstId);
    assert.equal(restored.existing.find(image => image.id === firstId).decision, 'keep');
    assert.equal(restored.order.at(-1), firstId);

    const moved = moveImage(restored, firstId, -1);
    assert.equal(moved.order.at(-2), firstId);

    const added = addUploads(original, [upload], 1);
    assert.equal(added.order[1], upload.id);
    assert.equal(activeImages(added).length, post.images.length + 1);

    const replaced = replaceImage(original, secondId, upload);
    assert.equal(replaced.order[1], upload.id);
    assert.equal(replaced.existing.find(image => image.id === secondId).decision, 'remove');
    assert.equal(reviewedDiffers(post, { ...createRecord(post).reviewed, images: replaced }), true);
});

test('text selection preserves a custom draft and only modifies a decided post', () => {
    const post = posts[0];
    const original = createRecord(post).reviewed;
    const custom = { ...original, textSelection: 'custom', customContent: 'Eigen tekst', content: 'Eigen tekst' };
    const improved = selectReviewedText(post, custom, 'improved');
    assert.equal(improved.content, post.improvedContent);
    assert.equal(improved.customContent, 'Eigen tekst');
    const restored = selectReviewedText(post, improved, 'custom');
    assert.equal(restored.content, 'Eigen tekst');
});

test('saving metadata edits does not turn unchanged suggested text into a custom version', () => {
    const post = posts[0];
    const current = createRecord(post).reviewed;
    const saved = modifiedRecord({
        ...current,
        title: `${current.title} aangepast`,
        textSelection: 'custom',
        customContent: current.content,
        baseSelection: 'improved',
        baseContent: post.improvedContent
    });

    assert.equal(saved.reviewed.textSelection, 'improved');
    assert.equal(saved.reviewed.customContent, '');
});

test('metadata changes retain an inactive custom text draft', () => {
    const post = posts[0];
    const custom = {
        ...createRecord(post).reviewed,
        textSelection: 'custom',
        customContent: 'Mijn bewaarde eigen tekst.',
        content: 'Mijn bewaarde eigen tekst.'
    };
    const viewingOriginal = selectReviewedText(post, custom, 'original');
    const saved = modifiedRecord({
        ...viewingOriginal,
        title: `${viewingOriginal.title} aangepast`
    });

    assert.equal(saved.reviewed.textSelection, 'original');
    assert.equal(saved.reviewed.customContent, 'Mijn bewaarde eigen tekst.');
});

test('editor metadata saves retain an inactive custom text draft', () => {
    const post = posts[0];
    const current = {
        ...createRecord(post).reviewed,
        textSelection: 'original',
        content: post.content,
        customContent: 'Mijn bewaarde eigen tekst.'
    };
    const saved = modifiedRecord({
        ...current,
        title: `${current.title} aangepast`,
        textSelection: 'custom',
        customContent: current.customContent,
        baseSelection: 'original',
        baseContent: post.content,
        preserveCustomDraft: true
    });

    assert.equal(saved.reviewed.textSelection, 'original');
    assert.equal(saved.reviewed.customContent, 'Mijn bewaarde eigen tekst.');
});

test('version 6 state keeps decisions and refreshes the curated source text', () => {
    const post = posts[0];
    const saved = createRecord(post).reviewed;
    const records = hydrateRecords(posts, {
        schemaVersion: 6,
        records: {
            [post.sourceId]: {
                decision: 'approved',
                reviewed: { ...saved, content: 'Previously suggested wording' }
            }
        }
    });

    assert.equal(records[post.sourceId].decision, 'approved');
    assert.equal(records[post.sourceId].reviewed.textSelection, 'improved');
    assert.equal(records[post.sourceId].reviewed.content, post.improvedContent);
});

test('decision summary and export preserve original and reviewed text', () => {
    const records = hydrateRecords(posts, null);
    const first = posts[0];
    const second = posts[1];
    records[first.sourceId] = resetRecord(first, 'approved');
    records[second.sourceId] = modifiedRecord({
        title: `${second.title} aangepast`,
        date: second.date,
        location: 'Nieuwe locatie',
        content: `${second.content}\n\nAanvulling.`
    });

    assert.equal(reviewedDiffers(second, records[second.sourceId].reviewed), true);
    assert.deepEqual(summarize(posts, records), {
        total: 41,
        pending: 39,
        approved: 1,
        rejected: 0,
        modified: 1
    });

    const exported = buildExportPayload(posts, records, '2026-08-16T12:00:00.000Z');
    assert.equal(exported.schemaVersion, 5);
    assert.equal(exported.kind, 'anyway-old-blog-review');
    assert.equal(exported.posts.length, 41);
    assert.equal(exported.posts[0].original.sourceTitle, first.sourceTitle);
    assert.equal(exported.posts[0].original.title, first.title);
    assert.equal(exported.posts[0].original.location, first.location);
    assert.equal(exported.posts[0].original.formattedTitle, formatTitle(first.title, first.location));
    assert.equal(exported.posts[1].reviewed.location, 'Nieuwe locatie');
    assert.equal(exported.posts[1].reviewed.title, `${second.title} aangepast`);
    assert.equal(exported.posts[1].reviewed.formattedTitle, `${second.title} aangepast - Nieuwe locatie`);
    assert.equal(exported.posts[0].suggested.kind, 'ai-copy-edit');
    assert.equal(exported.posts[0].suggested.content, first.improvedContent);
    assert.equal(exported.posts[0].reviewed.textSelection, 'improved');
    assert.equal('customContent' in exported.posts[0].reviewed, false);
    assert.deepEqual(exported.posts[0].reviewed.images.order, createRecord(first).reviewed.images.order);
    assert.equal(exported.summary.modified, 1);
});

test('approval preserves the current reviewed content and gallery choices', () => {
    const post = posts.find(candidate => candidate.images.length > 1);
    const reviewed = createRecord(post).reviewed;
    const removedImages = removeImage(reviewed.images, reviewed.images.order[0]);
    const approved = decidedRecord({
        ...reviewed,
        title: `${reviewed.title} gecontroleerd`,
        location: 'Nieuwe locatie',
        content: `${reviewed.content}\n\nGecontroleerd.`,
        images: removedImages
    }, 'approved');

    assert.equal(approved.decision, 'approved');
    assert.equal(approved.reviewed.title, `${reviewed.title} gecontroleerd`);
    assert.equal(approved.reviewed.location, 'Nieuwe locatie');
    assert.equal(approved.reviewed.images.existing[0].decision, 'remove');
    assert.equal(activeImages(approved.reviewed.images).length, post.images.length - 1);

    const records = hydrateRecords(posts, null);
    records[post.sourceId] = approved;
    const exported = buildExportPayload(posts, records, '2026-08-16T12:00:00.000Z');
    const exportedPost = exported.posts.find(candidate => candidate.sourceId === post.sourceId);
    assert.equal(exportedPost.decision, 'approved');
    assert.equal(exportedPost.reviewed.formattedTitle, `${reviewed.title} gecontroleerd - Nieuwe locatie`);
    assert.equal(exportedPost.reviewed.images.existing[0].decision, 'remove');
});

test('approval can append staged uploads in selection order', () => {
    const post = posts.find(candidate => candidate.images.length === 0);
    const reviewed = createRecord(post).reviewed;
    const uploads = ['eerste.webp', 'tweede.png'].map((filename, index) => ({
        id: `upload:approval-${index}`,
        originalFilename: filename,
        mimeType: filename.endsWith('.png') ? 'image/png' : 'image/webp',
        size: 100 + index,
        sha256: `hash-${index}`,
        packagePath: `uploaded-images/${post.sourceId}/approval-${index}-${filename}`,
        alt: `Afbeelding ${index + 1}`
    }));
    const approved = decidedRecord({
        ...reviewed,
        images: addUploads(reviewed.images, uploads)
    }, 'approved');

    assert.equal(approved.decision, 'approved');
    assert.deepEqual(approved.reviewed.images.order, uploads.map(upload => upload.id));
    assert.deepEqual(approved.reviewed.images.uploads, uploads);

    const records = hydrateRecords(posts, null);
    records[post.sourceId] = approved;
    const exported = buildExportPayload(posts, records, '2026-08-16T12:00:00.000Z');
    const exportedPost = exported.posts.find(candidate => candidate.sourceId === post.sourceId);
    assert.deepEqual(exportedPost.reviewed.images.order, uploads.map(upload => upload.id));
    assert.deepEqual(exportedPost.reviewed.images.uploads, uploads);
});
