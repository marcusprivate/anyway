export const STORAGE_SCHEMA_VERSION = 7;
export const EXPORT_KIND = 'anyway-old-blog-review';
export const DECISIONS = Object.freeze(['pending', 'approved', 'rejected', 'modified']);
export const IMAGE_DECISIONS = Object.freeze(['keep', 'remove']);
export const TEXT_SELECTIONS = Object.freeze(['original', 'improved', 'custom']);
export const CHECKLIST_KEYS = Object.freeze(['title', 'date', 'location', 'text', 'images']);

const DUTCH_MONTHS = Object.freeze([
    'januari',
    'februari',
    'maart',
    'april',
    'mei',
    'juni',
    'juli',
    'augustus',
    'september',
    'oktober',
    'november',
    'december'
]);

const LEGACY_CONTENT_REMOVALS = Object.freeze({
    '2010-06-06-opening-restaurant-de-luwte-den-burg-texel': [
        '\n\nDATE: 8 juni 2010\nErg genoten en heerlijk gegeten! Een aanwinst voor Texel!'
    ],
    '2009-04-04-opening-foto-tentoonstelling': [
        '\n\nDATE: 15 mei 2011\nDank jullie wel voor een half uur puur genot in Oudesluis op 15-05-2011.\n\nURL: http://www.darkrosie.nl\nDATE: 26 september 2012\nIedereen is van de wereld, en de wereld is van iedereen. Mooie samenzang, Ruthie! Nooit geweten dat ik zo\'n pittige tandarts had! Groetjes, Miranda.'
    ],
    '2007-09-17-trouwerij-in-carre': [
        '\n\nURL: http://profile.typekey.com/1233844586s3136/\nDATE: 15 februari 2009\nHet was heel bijzonder om mee te maken'
    ]
});

function clone(value) {
    return structuredClone(value);
}

export function existingImageId(image, index) {
    return `existing:${index}:${image.sourceRef || image.path}`;
}

export function originalImages(post) {
    const existing = (post.images || []).map((image, index) => ({
        id: existingImageId(image, index),
        sourceRef: image.sourceRef || '',
        path: image.path || '',
        alt: image.alt || '',
        decision: 'keep'
    }));

    return {
        order: existing.map(image => image.id),
        existing,
        uploads: []
    };
}

export function originalReviewed(post) {
    return {
        title: post.title,
        date: post.date,
        location: post.location || '',
        content: post.improvedContent,
        textSelection: 'improved',
        customContent: '',
        images: originalImages(post)
    };
}

export function createRecord(post) {
    return {
        decision: 'pending',
        reviewed: originalReviewed(post)
    };
}

function normalizeChecklist(candidate) {
    if (!candidate || typeof candidate !== 'object') return undefined;
    return Object.fromEntries(CHECKLIST_KEYS.map(key => [key, candidate?.[key] === true]));
}

export function formatTitle(title, location = '') {
    const cleanTitle = String(title || '').trim();
    const cleanLocation = String(location || '').trim();
    return cleanLocation ? `${cleanTitle} - ${cleanLocation}` : cleanTitle;
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeImages(candidate, fallback) {
    if (!candidate || typeof candidate !== 'object') return clone(fallback);

    const candidateExisting = new Map(
        Array.isArray(candidate.existing)
            ? candidate.existing.filter(image => image && typeof image.id === 'string').map(image => [image.id, image])
            : []
    );
    const existing = fallback.existing.map(original => ({
        ...original,
        decision: candidateExisting.get(original.id)?.decision === 'remove' ? 'remove' : 'keep'
    }));
    const uploads = Array.isArray(candidate.uploads)
        ? candidate.uploads.filter(upload => upload
            && isNonEmptyString(upload.id)
            && isNonEmptyString(upload.originalFilename)
            && isNonEmptyString(upload.mimeType)
            && Number.isFinite(upload.size)
            && upload.size >= 0
            && isNonEmptyString(upload.sha256)
            && isNonEmptyString(upload.packagePath))
            .map(upload => ({
                id: upload.id.trim(),
                originalFilename: upload.originalFilename.trim(),
                mimeType: upload.mimeType.trim(),
                size: upload.size,
                sha256: upload.sha256.trim(),
                packagePath: upload.packagePath.trim(),
                alt: typeof upload.alt === 'string' ? upload.alt : ''
            }))
        : [];

    const activeIds = new Set([
        ...existing.filter(image => image.decision === 'keep').map(image => image.id),
        ...uploads.map(upload => upload.id)
    ]);
    const requestedOrder = Array.isArray(candidate.order) ? candidate.order : [];
    const order = [];
    requestedOrder.forEach(id => {
        if (activeIds.has(id) && !order.includes(id)) order.push(id);
    });
    activeIds.forEach(id => {
        if (!order.includes(id)) order.push(id);
    });

    return { order, existing, uploads };
}

function migrateLegacyContent(post, content, storedSchemaVersion) {
    if (storedSchemaVersion >= STORAGE_SCHEMA_VERSION) return content;

    let migrated = content;
    (LEGACY_CONTENT_REMOVALS[post.sourceId] || []).forEach(fragment => {
        migrated = migrated.replace(fragment, '');
    });
    if (post.sourceId === '2004-05-28-broadway-den-hoorn') {
        migrated = migrated
            .replace('<h1>Broadway opnieuw bijzonder festival</h1>', 'Broadway opnieuw bijzonder festival')
            .replace('\n<small></small>', '');
    }
    return migrated.trim();
}

export function contentForSelection(post, selection, customContent = '') {
    if (selection === 'original') return post.content;
    if (selection === 'custom' && isNonEmptyString(customContent)) return customContent.trim();
    return post.improvedContent;
}

export function selectReviewedText(post, reviewed, selection) {
    const safeSelection = TEXT_SELECTIONS.includes(selection) ? selection : 'improved';
    const customContent = typeof reviewed?.customContent === 'string' ? reviewed.customContent.trim() : '';
    const textSelection = safeSelection === 'custom' && !customContent ? 'improved' : safeSelection;
    return {
        ...clone(reviewed),
        textSelection,
        customContent,
        content: contentForSelection(post, textSelection, customContent)
    };
}

function normalizeTextSelection(post, candidate, fallback, storedSchemaVersion) {
    const legacyContent = migrateLegacyContent(
        post,
        isNonEmptyString(candidate.content) ? candidate.content : post.content,
        storedSchemaVersion
    );
    if (storedSchemaVersion < 6) {
        if (legacyContent === post.content) {
            return { content: post.improvedContent, textSelection: 'improved', customContent: '' };
        }
        return { content: legacyContent, textSelection: 'custom', customContent: legacyContent };
    }

    const textSelection = TEXT_SELECTIONS.includes(candidate.textSelection)
        ? candidate.textSelection
        : fallback.textSelection;
    const customContent = isNonEmptyString(candidate.customContent) ? candidate.customContent.trim() : '';
    const safeSelection = textSelection === 'custom' && !customContent ? 'improved' : textSelection;
    return {
        content: contentForSelection(post, safeSelection, customContent),
        textSelection: safeSelection,
        customContent
    };
}

function validReviewed(candidate, fallback, post, storedSchemaVersion) {
    if (!candidate || typeof candidate !== 'object') {
        return fallback;
    }

    let title = isNonEmptyString(candidate.title) ? candidate.title : fallback.title;
    const legacyTitleIsUnchanged = storedSchemaVersion < 6
        && isNonEmptyString(post.sourceTitle)
        && title.trim() === post.sourceTitle.trim();
    if (legacyTitleIsUnchanged) title = fallback.title;

    const text = normalizeTextSelection(post, candidate, fallback, storedSchemaVersion);
    return {
        title,
        date: isNonEmptyString(candidate.date) ? candidate.date : fallback.date,
        location: typeof candidate.location === 'string' ? candidate.location : fallback.location,
        ...text,
        images: storedSchemaVersion >= 4
            ? normalizeImages(candidate.images, fallback.images)
            : clone(fallback.images)
    };
}

export function hydrateRecords(posts, storedPayload) {
    const storedSchemaVersion = Number(storedPayload?.schemaVersion);
    const supportedStoredSchema = [1, 2, 3, 4, 5, 6, STORAGE_SCHEMA_VERSION].includes(storedSchemaVersion);
    const storedRecords = supportedStoredSchema
        && storedPayload.records
        && typeof storedPayload.records === 'object'
        ? storedPayload.records
        : {};

    return Object.fromEntries(posts.map(post => {
        const fallback = originalReviewed(post);
        const stored = storedRecords[post.sourceId];
        const checklist = normalizeChecklist(stored?.checklist);
        return [post.sourceId, {
            decision: storedSchemaVersion < 6
                ? 'pending'
                : stored && DECISIONS.includes(stored.decision)
                    ? stored.decision
                    : 'pending',
            reviewed: validReviewed(stored?.reviewed, fallback, post, storedSchemaVersion),
            ...(checklist ? { checklist } : {})
        }];
    }));
}

export function resetRecord(post, decision = 'pending') {
    if (!DECISIONS.includes(decision) || decision === 'modified') {
        throw new Error(`Invalid reset decision: ${decision}`);
    }
    return {
        decision,
        reviewed: originalReviewed(post)
    };
}

export function modifiedRecord(reviewed) {
    if (!isNonEmptyString(reviewed?.title)
        || !isNonEmptyString(reviewed?.date)
        || !isNonEmptyString(reviewed?.content)) {
        throw new Error('Modified posts require a title, date, and content');
    }

    const requestedSelection = TEXT_SELECTIONS.includes(reviewed.textSelection) ? reviewed.textSelection : 'custom';
    const requestedCustomContent = typeof reviewed.customContent === 'string' ? reviewed.customContent.trim() : '';
    const baseSelection = TEXT_SELECTIONS.includes(reviewed.baseSelection) && reviewed.baseSelection !== 'custom'
        ? reviewed.baseSelection
        : '';
    const baseContent = typeof reviewed.baseContent === 'string' ? reviewed.baseContent.trim() : '';
    const unchangedBaseText = requestedSelection === 'custom'
        && baseSelection
        && baseContent
        && reviewed.content.trim() === baseContent;
    const textSelection = unchangedBaseText
        ? baseSelection
        : requestedSelection === 'custom' && !requestedCustomContent ? 'custom' : requestedSelection;
    const customContent = unchangedBaseText
        ? reviewed.preserveCustomDraft ? requestedCustomContent : ''
        : textSelection === 'custom'
            ? (requestedCustomContent || reviewed.content.trim())
            : requestedCustomContent;
    return {
        decision: 'modified',
        reviewed: {
            title: reviewed.title.trim(),
            date: reviewed.date.trim(),
            location: typeof reviewed.location === 'string' ? reviewed.location.trim() : '',
            content: reviewed.content.trim(),
            textSelection,
            customContent,
            ...(reviewed.images ? { images: clone(reviewed.images) } : {})
        }
    };
}

export function decidedRecord(reviewed, decision) {
    if (!['approved', 'rejected'].includes(decision)) {
        throw new Error(`Invalid reviewed decision: ${decision}`);
    }
    return {
        ...modifiedRecord(reviewed),
        decision
    };
}

export function activeImages(images) {
    const byId = new Map([
        ...images.existing.filter(image => image.decision === 'keep').map(image => [image.id, image]),
        ...images.uploads.map(image => [image.id, image])
    ]);
    return images.order.map(id => byId.get(id)).filter(Boolean);
}

export function addUploads(images, uploads, insertAt = images.order.length) {
    const next = clone(images);
    const unique = uploads.filter(upload => !next.uploads.some(existing => existing.id === upload.id));
    next.uploads.push(...clone(unique));
    const index = Math.max(0, Math.min(Number(insertAt) || 0, next.order.length));
    next.order.splice(index, 0, ...unique.map(upload => upload.id));
    return next;
}

export function removeImage(images, imageId) {
    const next = clone(images);
    const existing = next.existing.find(image => image.id === imageId);
    if (existing) existing.decision = 'remove';
    next.uploads = next.uploads.filter(image => image.id !== imageId);
    next.order = next.order.filter(id => id !== imageId);
    return next;
}

export function restoreImage(images, imageId) {
    const next = clone(images);
    const existing = next.existing.find(image => image.id === imageId);
    if (!existing) return next;
    existing.decision = 'keep';
    if (!next.order.includes(imageId)) next.order.push(imageId);
    return next;
}

export function moveImage(images, imageId, offset) {
    const next = clone(images);
    const from = next.order.indexOf(imageId);
    if (from === -1) return next;
    const to = Math.max(0, Math.min(from + offset, next.order.length - 1));
    if (from === to) return next;
    next.order.splice(from, 1);
    next.order.splice(to, 0, imageId);
    return next;
}

export function replaceImage(images, imageId, upload) {
    const position = images.order.indexOf(imageId);
    const withoutTarget = removeImage(images, imageId);
    return addUploads(withoutTarget, [upload], position === -1 ? withoutTarget.order.length : position);
}

function comparableImages(images) {
    return {
        order: images.order,
        existing: images.existing.map(image => ({ id: image.id, decision: image.decision })),
        uploads: images.uploads
    };
}

export function reviewedDiffers(post, reviewed) {
    const fallback = originalReviewed(post);
    return fallback.title !== reviewed.title
        || fallback.date !== reviewed.date
        || fallback.location !== (reviewed.location || '')
        || fallback.content !== reviewed.content
        || fallback.textSelection !== reviewed.textSelection
        || fallback.customContent !== (reviewed.customContent || '')
        || JSON.stringify(comparableImages(reviewed.images || originalImages(post)))
            !== JSON.stringify(comparableImages(originalImages(post)));
}

export function summarize(posts, records) {
    const summary = {
        total: posts.length,
        pending: 0,
        approved: 0,
        rejected: 0,
        modified: 0
    };

    posts.forEach(post => {
        const decision = records[post.sourceId]?.decision || 'pending';
        summary[DECISIONS.includes(decision) ? decision : 'pending'] += 1;
    });

    return summary;
}

export function buildStoragePayload(records) {
    return {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        records
    };
}

export function buildCheckpoint(posts, records, focusedPostId = null) {
    return {
        schemaVersion: 1,
        sourceIds: posts.map(post => post.sourceId),
        state: buildStoragePayload(records),
        focusedPostId: posts.some(post => post.sourceId === focusedPostId) ? focusedPostId : null
    };
}

function validCheckpointImages(images, post) {
    const original = originalImages(post).existing;
    if (!images || !Array.isArray(images.order) || !Array.isArray(images.existing) || !Array.isArray(images.uploads)
        || images.existing.length !== original.length) return false;
    if (!images.existing.every((image, index) => image && image.id === original[index].id
        && image.sourceRef === original[index].sourceRef && image.path === original[index].path
        && image.alt === original[index].alt && IMAGE_DECISIONS.includes(image.decision))) return false;
    if (!images.uploads.every(upload => upload && isNonEmptyString(upload.id) && isNonEmptyString(upload.originalFilename)
        && isNonEmptyString(upload.mimeType) && Number.isFinite(upload.size) && upload.size >= 0
        && isNonEmptyString(upload.sha256) && isNonEmptyString(upload.packagePath) && typeof upload.alt === 'string')) return false;
    const activeIds = new Set([
        ...images.existing.filter(image => image.decision === 'keep').map(image => image.id),
        ...images.uploads.map(upload => upload.id)
    ]);
    return images.order.length === activeIds.size
        && images.order.every((id, index) => typeof id === 'string' && activeIds.has(id) && images.order.indexOf(id) === index);
}

export function restoreCheckpoint(posts, checkpoint) {
    if (!checkpoint || checkpoint.schemaVersion !== 1 || !Array.isArray(checkpoint.sourceIds)
        || !checkpoint.state || typeof checkpoint.state !== 'object') {
        throw new Error('Dit reviewpakket bevat geen geldig hervatpunt.');
    }
    const expectedIds = posts.map(post => post.sourceId);
    if (checkpoint.sourceIds.length !== expectedIds.length
        || checkpoint.sourceIds.some((sourceId, index) => sourceId !== expectedIds[index])) {
        throw new Error('Dit reviewpakket hoort bij een andere set blogberichten.');
    }
    if (checkpoint.state.schemaVersion !== STORAGE_SCHEMA_VERSION
        || !checkpoint.state.records || typeof checkpoint.state.records !== 'object') {
        throw new Error('De opgeslagen reviewstatus heeft een ongeldige versie.');
    }
    if (Object.keys(checkpoint.state.records).length !== expectedIds.length
        || expectedIds.some(sourceId => !Object.hasOwn(checkpoint.state.records, sourceId))) {
        throw new Error('De opgeslagen reviewstatus is onvolledig.');
    }
    const invalidRecord = expectedIds.find(sourceId => {
        const record = checkpoint.state.records[sourceId];
        const reviewed = record?.reviewed;
        return !record || !DECISIONS.includes(record.decision)
            || !reviewed || !isNonEmptyString(reviewed.title) || !isNonEmptyString(reviewed.date)
            || !isNonEmptyString(reviewed.content) || typeof reviewed.location !== 'string'
            || !TEXT_SELECTIONS.includes(reviewed.textSelection) || typeof reviewed.customContent !== 'string'
            || !validCheckpointImages(reviewed.images, posts.find(post => post.sourceId === sourceId));
    });
    if (invalidRecord) throw new Error(`De reviewstatus voor ${invalidRecord} is ongeldig.`);
    return {
        records: hydrateRecords(posts, checkpoint.state),
        focusedPostId: expectedIds.includes(checkpoint.focusedPostId) ? checkpoint.focusedPostId : null
    };
}

function recordsEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeCheckpointRecords(posts, localRecords, importedRecords) {
    const records = {};
    const conflicts = [];
    posts.forEach(post => {
        const sourceId = post.sourceId;
        const baseline = createRecord(post);
        const local = localRecords[sourceId] || baseline;
        const imported = importedRecords[sourceId] || baseline;
        const localChanged = !recordsEqual(local, baseline);
        const importedChanged = !recordsEqual(imported, baseline);
        if (!localChanged || recordsEqual(local, imported)) {
            records[sourceId] = imported;
        } else if (!importedChanged) {
            records[sourceId] = local;
        } else {
            records[sourceId] = local;
            conflicts.push({ sourceId, local, imported });
        }
    });
    return { records, conflicts };
}

export function buildExportPayload(posts, records, exportedAt = new Date().toISOString()) {
    return {
        schemaVersion: 6,
        kind: EXPORT_KIND,
        exportedAt,
        source: {
            exportFile: 'content/typepad_export_cleaned.txt',
            blogFile: 'content/blog.yaml'
        },
        summary: summarize(posts, records),
        posts: posts.map(post => {
            const record = records[post.sourceId] || createRecord(post);
            return {
                sourceId: post.sourceId,
                decision: record.decision,
                original: {
                    sourceTitle: post.sourceTitle || post.title,
                    title: post.title,
                    date: post.date,
                    location: post.location || '',
                    formattedTitle: formatTitle(post.title, post.location),
                    content: post.content,
                    images: post.images.map(image => ({ ...image }))
                },
                suggested: {
                    kind: 'ai-copy-edit',
                    content: post.improvedContent
                },
                reviewed: {
                    title: record.reviewed.title,
                    date: record.reviewed.date,
                    location: record.reviewed.location,
                    content: record.reviewed.content,
                    textSelection: record.reviewed.textSelection,
                    images: clone(record.reviewed.images || originalImages(post)),
                    formattedTitle: formatTitle(record.reviewed.title, record.reviewed.location)
                }
            };
        })
    };
}

export function dutchDateToIso(value) {
    const match = String(value || '').trim().toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
    if (!match) return '';

    const monthIndex = DUTCH_MONTHS.indexOf(match[2]);
    if (monthIndex === -1) return '';

    const day = Number(match[1]);
    const year = Number(match[3]);
    const candidate = new Date(Date.UTC(year, monthIndex, day));
    if (candidate.getUTCFullYear() !== year
        || candidate.getUTCMonth() !== monthIndex
        || candidate.getUTCDate() !== day) {
        return '';
    }

    return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isoDateToDutch(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    if (monthIndex < 0 || monthIndex >= DUTCH_MONTHS.length) return '';

    const candidate = new Date(Date.UTC(year, monthIndex, day));
    if (candidate.getUTCFullYear() !== year
        || candidate.getUTCMonth() !== monthIndex
        || candidate.getUTCDate() !== day) {
        return '';
    }

    return `${day} ${DUTCH_MONTHS[monthIndex]} ${year}`;
}
