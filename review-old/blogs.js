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
import {
    deleteUpload,
    deleteUploads,
    getAllUploads,
    getUpload,
    openUploadStore,
    putUpload
} from './upload-store.mjs';
import {
    createUploadDescriptor,
    formatBytes,
    MAX_TOTAL_UPLOAD_BYTES
} from './upload-utils.mjs';
import { buildZip } from './zip-export.mjs';

const STORAGE_KEY = 'anyway-old-blog-review:v1';
const STATUS_LABELS = {
    pending: 'Openstaand',
    approved: 'Goedgekeurd',
    rejected: 'Afgekeurd',
    modified: 'Aangepast'
};
const EXPORT_BUTTON_LABEL = 'Reviewpakket downloaden (.zip)';

const elements = {
    posts: document.getElementById('posts-container'),
    empty: document.getElementById('empty-state'),
    error: document.getElementById('error-state'),
    exportButton: document.getElementById('export-button'),
    search: document.getElementById('search-input'),
    filterGroup: document.getElementById('filter-group'),
    status: document.getElementById('status-message'),
    reviewedCount: document.getElementById('reviewed-count'),
    totalCount: document.getElementById('total-count'),
    progressPercent: document.getElementById('progress-percent'),
    progressBar: document.getElementById('progress-bar'),
    countPending: document.getElementById('count-pending'),
    countApproved: document.getElementById('count-approved'),
    countRejected: document.getElementById('count-rejected'),
    countModified: document.getElementById('count-modified'),
    guidedReview: document.getElementById('guided-review'),
    overview: document.getElementById('overview-section'),
    guidedModeButton: document.getElementById('guided-mode-button'),
    overviewModeButton: document.getElementById('overview-mode-button'),
    progressNotice: document.getElementById('progress-notice')
};

let posts = [];
let records = {};
let activeFilter = 'all';
let editingId = null;
let comparingId = null;
let reviewMode = 'guided';
let focusedPostId = null;
let statusTimer = null;
let lightboxElements = null;
let lightboxObjectUrl = null;

function loadStoredPayload() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (error) {
        console.warn('Ongeldige opgeslagen reviewstatus genegeerd.', error);
        return null;
    }
}

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(buildStoragePayload(records)));
    } catch (error) {
        console.warn('Reviewstatus kon niet lokaal worden opgeslagen.', error);
        announce('Let op: je voortgang kon niet in deze browser worden opgeslagen.');
    }
}

function announce(message) {
    elements.status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
        elements.status.textContent = '';
    }, 4500);
}

function updateSummary() {
    const summary = summarize(posts, records);
    const reviewed = summary.total - summary.pending;
    const percent = summary.total ? Math.round((reviewed / summary.total) * 100) : 0;

    elements.reviewedCount.textContent = reviewed;
    elements.totalCount.textContent = summary.total;
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressBar.style.width = `${percent}%`;
    elements.countPending.textContent = summary.pending;
    elements.countApproved.textContent = summary.approved;
    elements.countRejected.textContent = summary.rejected;
    elements.countModified.textContent = summary.modified;
    if (summary.pending === 0) {
        elements.progressNotice.textContent = 'Alle berichten hebben een beslissing. Download nu het reviewpakket om je werk buiten deze browser te bewaren.';
    } else if (summary.total - summary.pending > 0) {
        elements.progressNotice.textContent = 'Je voortgang staat alleen in deze browser. Download het reviewpakket zodra je klaar bent.';
    } else {
        elements.progressNotice.textContent = 'Begin met één bericht tegelijk. Ontbrekende locatie of afbeeldingen geven een waarschuwing, maar blokkeren je keuze niet.';
    }

    elements.filterGroup.querySelector('[data-filter="all"] span').textContent = summary.total;
    ['pending', 'approved', 'rejected', 'modified'].forEach(decision => {
        elements.filterGroup.querySelector(`[data-filter="${decision}"] span`).textContent = summary[decision];
    });
}

function pendingPosts() {
    return posts.filter(post => (records[post.sourceId]?.decision || 'pending') === 'pending');
}

function moveGuidedQueueAfterDecision(completedPostId) {
    if (reviewMode !== 'guided') return;
    focusedPostId = pendingPosts().find(post => post.sourceId !== completedPostId)?.sourceId || completedPostId;
}

function focusedPost() {
    return posts.find(post => post.sourceId === focusedPostId) || pendingPosts()[0] || posts[0] || null;
}

function showGuidedReview(postId = null) {
    reviewMode = 'guided';
    focusedPostId = postId || focusedPostId || pendingPosts()[0]?.sourceId || posts[0]?.sourceId || null;
    editingId = null;
    render();
}

function showOverview() {
    reviewMode = 'overview';
    editingId = null;
    render();
}

function showNextOpenPost() {
    const open = pendingPosts();
    if (!open.length) {
        announce('Alle berichten hebben al een beslissing. Download het reviewpakket wanneer je klaar bent.');
        return;
    }
    const currentIndex = open.findIndex(post => post.sourceId === focusedPostId);
    focusedPostId = open[(currentIndex + 1 + open.length) % open.length].sourceId;
    editingId = null;
    render();
}

function matchesSearch(post, searchTerm) {
    if (!searchTerm) return true;
    const record = records[post.sourceId] || createRecord(post);
    const haystack = [
        post.title,
        post.sourceTitle,
        post.date,
        post.location,
        post.content,
        post.improvedContent,
        record.reviewed.title,
        record.reviewed.date,
        record.reviewed.location,
        record.reviewed.content,
        record.reviewed.customContent
    ].join(' ').toLocaleLowerCase('nl');
    return haystack.includes(searchTerm);
}

function visiblePosts() {
    const searchTerm = elements.search.value.trim().toLocaleLowerCase('nl');
    return posts.filter(post => {
        const decision = records[post.sourceId]?.decision || 'pending';
        return (activeFilter === 'all' || activeFilter === decision)
            && matchesSearch(post, searchTerm);
    });
}

function textElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
}

function actionButton(label, className, handler) {
    const button = textElement('button', `action-button ${className}`, label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
}

function confirmDiscard(post, record) {
    if (!reviewedDiffers(post, record.reviewed)) return true;
    return window.confirm('Hiermee worden je wijzigingen aan tekst en afbeeldingen verwijderd. Doorgaan?');
}

async function discardRecordUploads(record) {
    const uploadIds = record.reviewed.images?.uploads?.map(upload => upload.id) || [];
    await deleteUploads(uploadIds);
}

async function rejectPost(post) {
    const current = records[post.sourceId];
    if (!confirmDiscard(post, current)) return;
    try {
        await discardRecordUploads(current);
        records[post.sourceId] = resetRecord(post, 'rejected');
        moveGuidedQueueAfterDecision(post.sourceId);
        editingId = null;
        persist();
        render();
        announce('Bericht afgekeurd.');
    } catch (error) {
        announce('De opgeslagen uploads konden niet worden verwijderd. Probeer het opnieuw.');
    }
}

function approvePost(post, options = {}) {
    const current = records[post.sourceId];
    records[post.sourceId] = decidedRecord({
        ...current.reviewed,
        location: String(options.location ?? current.reviewed.location).trim(),
        images: options.images || current.reviewed.images
    }, 'approved');
    moveGuidedQueueAfterDecision(post.sourceId);
    editingId = null;
    persist();
    render();
    announce('Bericht goedgekeurd.');
}

function requestApproval(post) {
    const record = records[post.sourceId] || createRecord(post);
    const missingLocation = !record.reviewed.location.trim();
    const missingImages = activeImages(record.reviewed.images).length === 0;
    if (!missingLocation && !missingImages) {
        approvePost(post);
        return;
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'approval-dialog';
    const titleId = `approval-title-${post.sourceId}`;
    dialog.setAttribute('aria-labelledby', titleId);

    const form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'approval-dialog-content';
    const heading = textElement('h2', '', 'Nog even controleren');
    heading.id = titleId;
    form.appendChild(heading);
    form.appendChild(textElement('p', 'approval-intro', `Je staat op het punt “${formatTitle(record.reviewed.title, record.reviewed.location)}” goed te keuren.`));

    const warnings = document.createElement('div');
    warnings.className = 'approval-warnings';
    if (missingLocation) {
        const warning = document.createElement('div');
        warning.className = 'approval-warning';
        warning.append(
            textElement('strong', '', 'Er is nog geen locatie ingevuld.'),
            textElement('p', '', 'Je kunt nu een locatie toevoegen of bewust zonder locatie doorgaan.')
        );
        warnings.appendChild(warning);
    }
    if (missingImages) {
        const warning = document.createElement('div');
        warning.className = 'approval-warning';
        warning.append(
            textElement('strong', '', 'Dit blogbericht heeft geen afbeelding.'),
            textElement('p', '', 'Controleer of dat de bedoeling is voordat je het bericht goedkeurt.')
        );
        warnings.appendChild(warning);
    }
    form.appendChild(warnings);

    let locationInput = null;
    let uploadButton = null;
    let stagedUploads = [];
    let processingUploads = false;
    let uploadsCommitted = false;
    const previewUrls = new Map();
    const error = textElement('p', 'approval-error', '');
    error.setAttribute('role', 'alert');
    if (missingLocation) {
        const label = document.createElement('label');
        label.className = 'approval-location';
        label.appendChild(textElement('span', '', 'Locatie'));
        locationInput = document.createElement('input');
        locationInput.type = 'text';
        locationInput.autocomplete = 'off';
        locationInput.placeholder = 'Bijv. Klif 12 - Den Hoorn - Texel';
        label.appendChild(locationInput);
        form.appendChild(label);
    }

    const stagedList = document.createElement('div');
    stagedList.className = 'approval-upload-list';
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'image/jpeg,image/png,image/webp';
    uploadInput.multiple = true;
    uploadInput.hidden = true;
    if (missingImages) {
        const uploadSection = document.createElement('section');
        uploadSection.className = 'approval-upload';
        uploadSection.setAttribute('aria-label', 'Afbeeldingen toevoegen');
        uploadButton = actionButton('Afbeelding(en) kiezen', 'upload', () => uploadInput.click());
        uploadSection.append(uploadButton, uploadInput, stagedList);
        form.appendChild(uploadSection);
    }
    form.appendChild(error);

    const actions = document.createElement('div');
    actions.className = 'approval-actions';
    const actionButtons = [];
    const setProcessing = processing => {
        processingUploads = processing;
        uploadButton?.toggleAttribute('disabled', processing);
        actionButtons.forEach(button => button.toggleAttribute('disabled', processing));
        stagedList.querySelectorAll('button').forEach(button => button.toggleAttribute('disabled', processing));
        if (processing) error.textContent = 'Afbeelding(en) verwerken…';
    };
    const releasePreview = uploadId => {
        const url = previewUrls.get(uploadId);
        if (url) URL.revokeObjectURL(url);
        previewUrls.delete(uploadId);
    };
    const releaseAllPreviews = () => {
        previewUrls.forEach(url => URL.revokeObjectURL(url));
        previewUrls.clear();
    };
    const close = () => {
        if (!processingUploads) dialog.close();
    };
    const cancelButton = actionButton('Annuleren', '', close);
    actionButtons.push(cancelButton);
    let primaryButton;
    let ignoreLocationButton = null;
    const nextImages = () => stagedUploads.length
        ? addUploads(records[post.sourceId].reviewed.images, stagedUploads)
        : records[post.sourceId].reviewed.images;
    const commitApproval = location => {
        uploadsCommitted = true;
        releaseAllPreviews();
        dialog.close();
        approvePost(post, { location, images: nextImages() });
    };
    const updateActionLabels = () => {
        const withUploads = stagedUploads.length > 0;
        if (missingLocation) {
            primaryButton.textContent = withUploads
                ? 'Locatie en afbeelding(en) opslaan en goedkeuren'
                : 'Locatie opslaan en goedkeuren';
            ignoreLocationButton.textContent = withUploads
                ? 'Afbeelding(en) toevoegen en zonder locatie goedkeuren'
                : 'Zonder locatie goedkeuren';
        } else {
            primaryButton.textContent = withUploads
                ? 'Afbeelding(en) toevoegen en goedkeuren'
                : 'Zonder afbeelding goedkeuren';
        }
    };
    const renderStagedUploads = () => {
        stagedList.replaceChildren();
        stagedUploads.forEach(upload => {
            const item = document.createElement('div');
            item.className = 'approval-upload-item';
            const image = document.createElement('img');
            image.src = previewUrls.get(upload.id);
            image.alt = upload.alt || upload.originalFilename;
            const details = document.createElement('div');
            details.append(
                textElement('strong', '', upload.originalFilename),
                textElement('span', '', formatBytes(upload.size))
            );
            const removeButton = actionButton('Verwijderen', 'gallery-action', async () => {
                setProcessing(true);
                try {
                    await deleteUpload(upload.id);
                    stagedUploads = stagedUploads.filter(candidate => candidate.id !== upload.id);
                    releasePreview(upload.id);
                    renderStagedUploads();
                    error.textContent = '';
                } catch (removeError) {
                    error.textContent = 'De geselecteerde afbeelding kon niet worden verwijderd.';
                } finally {
                    setProcessing(false);
                }
            });
            item.append(image, details, removeButton);
            stagedList.appendChild(item);
        });
        updateActionLabels();
    };

    if (missingLocation) {
        primaryButton = actionButton('Locatie opslaan en goedkeuren', 'primary', () => {
            const location = locationInput.value.trim();
            if (!location) {
                error.textContent = 'Vul een locatie in, of kies “Zonder locatie goedkeuren”.';
                locationInput.focus();
                return;
            }
            commitApproval(location);
        });
        ignoreLocationButton = actionButton('Zonder locatie goedkeuren', 'approve', () => commitApproval(''));
        actions.append(
            cancelButton,
            ignoreLocationButton,
            primaryButton
        );
        actionButtons.push(ignoreLocationButton, primaryButton);
        form.addEventListener('submit', event => {
            event.preventDefault();
            primaryButton.click();
        });
    } else {
        primaryButton = actionButton('Zonder afbeelding goedkeuren', 'approve primary-approve', () => commitApproval(record.reviewed.location));
        actions.append(cancelButton, primaryButton);
        actionButtons.push(primaryButton);
    }
    updateActionLabels();
    uploadInput.addEventListener('change', async () => {
        const files = Array.from(uploadInput.files || []);
        uploadInput.value = '';
        if (!files.length) return;
        setProcessing(true);
        try {
            const uploads = await prepareUploads(post, files);
            uploads.forEach((upload, index) => {
                stagedUploads.push(upload);
                previewUrls.set(upload.id, URL.createObjectURL(files[index]));
            });
            error.textContent = '';
            renderStagedUploads();
        } catch (uploadError) {
            error.textContent = uploadError.message || 'Afbeeldingen konden niet worden toegevoegd.';
        } finally {
            setProcessing(false);
        }
    });
    form.appendChild(actions);
    dialog.appendChild(form);
    dialog.addEventListener('click', event => {
        if (event.target === dialog && !processingUploads) dialog.close();
    });
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        if (!processingUploads) dialog.close();
    });
    dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape' && dialog.open) {
            event.preventDefault();
            dialog.close();
        }
    });
    dialog.addEventListener('close', () => {
        releaseAllPreviews();
        const abandonedUploadIds = uploadsCommitted ? [] : stagedUploads.map(upload => upload.id);
        deleteUploads(abandonedUploadIds)
            .catch(cleanupError => console.warn('Tijdelijke uploads konden niet worden verwijderd.', cleanupError))
            .finally(() => dialog.remove());
    }, { once: true });
    document.body.appendChild(dialog);
    dialog.showModal();
    requestAnimationFrame(() => (locationInput || uploadButton || primaryButton).focus());
}

async function resetDecision(post) {
    const current = records[post.sourceId];
    if (!confirmDiscard(post, current)) return;
    try {
        await discardRecordUploads(current);
        records[post.sourceId] = resetRecord(post);
        editingId = null;
        persist();
        render();
        announce('Beoordeling teruggezet naar openstaand.');
    } catch (error) {
        announce('De opgeslagen uploads konden niet worden verwijderd. Probeer het opnieuw.');
    }
}

function validateImageDecode(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve();
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`${file.name}: dit bestand kon niet als afbeelding worden gelezen.`));
        };
        image.src = url;
    });
}

function saveGallery(post, images, message) {
    const current = records[post.sourceId] || createRecord(post);
    records[post.sourceId] = modifiedRecord({ ...current.reviewed, images });
    persist();
    render();
    announce(message);
}

async function prepareUploads(post, files) {
    const selected = Array.from(files);
    const stored = await getAllUploads();
    const newTotal = stored.reduce((sum, upload) => sum + Number(upload.size || 0), 0)
        + selected.reduce((sum, file) => sum + file.size, 0);
    if (newTotal > MAX_TOTAL_UPLOAD_BYTES) {
        throw new Error('De totale lokale afbeeldingsopslag mag niet groter zijn dan 250 MB.');
    }

    const created = [];
    try {
        for (const file of selected) {
            await validateImageDecode(file);
            const descriptor = await createUploadDescriptor(
                file,
                post.sourceId,
                formatTitle(records[post.sourceId].reviewed.title, records[post.sourceId].reviewed.location)
            );
            await putUpload({ ...descriptor, sourceId: post.sourceId, blob: file });
            created.push(descriptor);
        }
        return created;
    } catch (error) {
        await deleteUploads(created.map(upload => upload.id));
        throw error;
    }
}

async function addImageFiles(post, files) {
    if (!files.length) return;
    try {
        const uploads = await prepareUploads(post, files);
        const current = records[post.sourceId];
        saveGallery(post, addUploads(current.reviewed.images, uploads), `${uploads.length} afbeelding(en) toegevoegd.`);
    } catch (error) {
        announce(error.message || 'Afbeeldingen konden niet worden toegevoegd.');
    }
}

async function replaceImageFile(post, targetId, file) {
    if (!file) return;
    let upload;
    try {
        [upload] = await prepareUploads(post, [file]);
        const current = records[post.sourceId];
        const previousUpload = current.reviewed.images.uploads.find(image => image.id === targetId);
        if (previousUpload) await deleteUpload(previousUpload.id);
        saveGallery(post, replaceImage(current.reviewed.images, targetId, upload), 'Afbeelding vervangen.');
    } catch (error) {
        if (upload) await deleteUpload(upload.id).catch(() => {});
        announce(error.message || 'Afbeelding kon niet worden vervangen.');
    }
}

async function removeGalleryImage(post, imageId) {
    try {
        const current = records[post.sourceId];
        if (current.reviewed.images.uploads.some(image => image.id === imageId)) {
            await deleteUpload(imageId);
        }
        saveGallery(post, removeImage(current.reviewed.images, imageId), 'Afbeelding verwijderd.');
    } catch (error) {
        announce('Afbeelding kon niet worden verwijderd.');
    }
}

function loadUploadedPreview(img, uploadId) {
    getUpload(uploadId).then(stored => {
        if (!img.isConnected) return;
        if (!stored?.blob) {
            img.alt = 'Upload ontbreekt; voeg deze afbeelding opnieuw toe.';
            img.closest('.gallery-item')?.classList.add('missing-upload');
            return;
        }
        const url = URL.createObjectURL(stored.blob);
        img.onload = () => URL.revokeObjectURL(url);
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
    }).catch(() => {
        img.alt = 'Upload ontbreekt; voeg deze afbeelding opnieuw toe.';
        img.closest('.gallery-item')?.classList.add('missing-upload');
    });
}

function galleryButton(label, handler, disabled = false) {
    const button = actionButton(label, 'gallery-action', handler);
    button.disabled = disabled;
    return button;
}

function releaseLightboxObjectUrl() {
    if (!lightboxObjectUrl) return;
    URL.revokeObjectURL(lightboxObjectUrl);
    lightboxObjectUrl = null;
}

function ensureLightbox() {
    if (lightboxElements) return lightboxElements;

    const dialog = document.createElement('dialog');
    dialog.className = 'image-lightbox';
    dialog.setAttribute('aria-label', 'Afbeelding op volledige resolutie');
    const close = actionButton('Sluiten', 'lightbox-close', () => dialog.close());
    const image = document.createElement('img');
    image.alt = '';
    const caption = textElement('p', 'lightbox-caption', '');
    const status = textElement('p', 'lightbox-status', 'Afbeelding laden…');
    dialog.append(close, image, caption, status);
    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape' && dialog.open) {
            event.preventDefault();
            dialog.close();
        }
    });
    dialog.addEventListener('close', () => {
        image.removeAttribute('src');
        releaseLightboxObjectUrl();
    });
    document.body.appendChild(dialog);
    lightboxElements = { dialog, image, caption, status };
    return lightboxElements;
}

async function openImagePreview(image, post, record) {
    const lightbox = ensureLightbox();
    releaseLightboxObjectUrl();
    lightbox.image.removeAttribute('src');
    lightbox.image.alt = image.alt || `Afbeelding bij ${formatTitle(record.reviewed.title, record.reviewed.location)}`;
    lightbox.caption.textContent = image.originalFilename || image.path?.split('/').pop() || post.title;
    lightbox.status.textContent = 'Afbeelding laden…';
    lightbox.dialog.showModal();

    try {
        let source;
        if (image.id.startsWith('upload:')) {
            const stored = await getUpload(image.id);
            if (!stored?.blob) throw new Error('De geüploade afbeelding ontbreekt. Voeg deze opnieuw toe.');
            source = URL.createObjectURL(stored.blob);
            if (!lightbox.dialog.open) {
                URL.revokeObjectURL(source);
                return;
            }
            lightboxObjectUrl = source;
        } else {
            source = `../${image.path}`;
        }
        lightbox.image.src = source;
        lightbox.status.textContent = '';
    } catch (error) {
        lightbox.status.textContent = error.message || 'Afbeelding kon niet worden geladen.';
    }
}

function createGallery(post, record, compact = false) {
    const panel = document.createElement('section');
    panel.className = 'gallery-panel';
    panel.setAttribute('aria-label', `Afbeeldingen voor ${post.title}`);
    panel.appendChild(textElement('h4', '', 'Afbeeldingen'));

    const images = record.reviewed.images;
    const ordered = activeImages(images);
    const grid = document.createElement('div');
    grid.className = 'image-grid';

    ordered.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        const img = document.createElement('img');
        img.alt = image.alt || `Afbeelding bij ${formatTitle(record.reviewed.title, record.reviewed.location)}`;
        img.loading = 'lazy';
        img.decoding = 'async';
        if (image.id.startsWith('upload:')) {
            loadUploadedPreview(img, image.id);
        } else {
            img.src = `../${image.path}`;
        }
        const previewButton = document.createElement('button');
        previewButton.type = 'button';
        previewButton.className = 'image-preview-button';
        previewButton.setAttribute('aria-label', `Bekijk ${img.alt} op volledige resolutie`);
        previewButton.addEventListener('click', () => openImagePreview(image, post, record));
        previewButton.appendChild(img);
        item.appendChild(previewButton);

        const filename = image.originalFilename || image.path.split('/').pop() || 'Bestaande afbeelding';
        item.appendChild(textElement('span', 'image-name', filename));
        if (image.size != null) item.appendChild(textElement('span', 'image-size', formatBytes(image.size)));

        const controls = document.createElement('div');
        controls.className = 'gallery-controls';
        controls.append(
            galleryButton('←', () => saveGallery(post, moveImage(images, image.id, -1), 'Afbeeldingsvolgorde aangepast.'), index === 0),
            galleryButton('→', () => saveGallery(post, moveImage(images, image.id, 1), 'Afbeeldingsvolgorde aangepast.'), index === ordered.length - 1)
        );

        const replaceInput = document.createElement('input');
        replaceInput.type = 'file';
        replaceInput.accept = 'image/jpeg,image/png,image/webp';
        replaceInput.hidden = true;
        replaceInput.addEventListener('change', () => replaceImageFile(post, image.id, replaceInput.files[0]));
        controls.append(
            galleryButton('Vervangen', () => replaceInput.click()),
            galleryButton('Verwijderen', () => removeGalleryImage(post, image.id))
        );
        item.append(controls, replaceInput);
        grid.appendChild(item);
    });

    if (!ordered.length) grid.appendChild(textElement('p', 'gallery-empty', 'Nog geen actieve afbeeldingen.'));
    panel.appendChild(grid);

    const addInput = document.createElement('input');
    addInput.type = 'file';
    addInput.accept = 'image/jpeg,image/png,image/webp';
    addInput.multiple = true;
    addInput.hidden = true;
    addInput.addEventListener('change', () => addImageFiles(post, addInput.files));
    const addButton = actionButton('Afbeeldingen toevoegen', 'upload', () => addInput.click());
    panel.append(addButton, addInput);

    const removed = images.existing.filter(image => image.decision === 'remove');
    if (removed.length) {
        const removedList = document.createElement('div');
        removedList.className = 'removed-images';
        removedList.appendChild(textElement('strong', '', `Verwijderd (${removed.length})`));
        removed.forEach(image => {
            const row = document.createElement('div');
            row.append(
                textElement('span', '', image.path.split('/').pop() || image.sourceRef),
                galleryButton('Herstellen', () => saveGallery(post, restoreImage(images, image.id), 'Afbeelding hersteld.'))
            );
            removedList.appendChild(row);
        });
        panel.appendChild(removedList);
    }

    if (!compact) return panel;
    const disclosure = document.createElement('section');
    disclosure.className = 'gallery-disclosure';
    const summary = document.createElement('p');
    summary.className = 'gallery-summary';
    const removedCount = images.existing.filter(image => image.decision === 'remove').length;
    const uploadCount = images.uploads.length;
    summary.textContent = `${ordered.length} actieve afbeelding${ordered.length === 1 ? '' : 'en'}${removedCount ? ` · ${removedCount} verwijderd` : ''}${uploadCount ? ` · ${uploadCount} toegevoegd` : ''}`;
    disclosure.append(summary, panel);
    return disclosure;
}

function createEditor(post, record) {
    const editor = document.createElement('form');
    editor.className = 'editor';
    editor.noValidate = true;

    const grid = document.createElement('div');
    grid.className = 'editor-grid';

    const titleLabel = textElement('label', '', '');
    titleLabel.appendChild(textElement('span', '', 'Titel'));
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.required = true;
    titleInput.value = record.reviewed.title;
    titleLabel.appendChild(titleInput);

    const dateLabel = textElement('label', '', '');
    dateLabel.appendChild(textElement('span', '', 'Datum'));
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.required = true;
    dateInput.value = dutchDateToIso(record.reviewed.date);
    dateLabel.appendChild(dateInput);

    const locationLabel = textElement('label', '', '');
    locationLabel.appendChild(textElement('span', '', 'Locatie (mag leeg blijven)'));
    const locationInput = document.createElement('input');
    locationInput.type = 'text';
    locationInput.value = record.reviewed.location || '';
    locationInput.placeholder = 'Bijv. Klif 12 - Den Hoorn - Texel';
    locationLabel.appendChild(locationInput);

    grid.append(titleLabel, dateLabel, locationLabel);
    editor.appendChild(grid);

    const contentLabel = textElement('label', '', '');
    contentLabel.appendChild(textElement('span', '', 'Blogtekst (eigen aanpassing)'));
    const baseHint = textElement('p', 'editor-base-hint', 'Kies hieronder de versie waarop je eigen aanpassing begint. Wisselen na het typen vraagt om bevestiging.');
    contentLabel.appendChild(baseHint);
    const baseChoices = document.createElement('div');
    baseChoices.className = 'text-version-selector editor-version-selector';
    const contentInput = document.createElement('textarea');
    contentInput.required = true;
    contentInput.value = record.reviewed.content;
    let selectedBase = record.reviewed.textSelection === 'custom' ? 'improved' : record.reviewed.textSelection;
    ['improved', 'original'].forEach(selection => {
        const label = selection === 'improved' ? 'Verbeterd met AI' : 'Origineel';
        const button = actionButton(label, '', () => {
            if (selection === selectedBase) return;
            if (contentInput.value.trim() !== record.reviewed.content.trim()
                && !window.confirm('De tekst in de editor wordt vervangen door de gekozen basisversie. Doorgaan?')) return;
            selectedBase = selection;
            contentInput.value = selection === 'original' ? post.content : post.improvedContent;
            baseChoices.querySelectorAll('button').forEach(candidate => candidate.classList.toggle('active', candidate.dataset.selection === selection));
        });
        button.dataset.selection = selection;
        button.classList.toggle('active', selection === selectedBase);
        baseChoices.appendChild(button);
    });
    contentLabel.appendChild(baseChoices);
    contentLabel.appendChild(contentInput);
    editor.appendChild(contentLabel);

    const error = textElement('p', 'editor-error', '');
    error.setAttribute('role', 'alert');
    editor.appendChild(error);

    const actions = document.createElement('div');
    actions.className = 'editor-actions';
    actions.appendChild(actionButton('Annuleren', '', () => {
        editingId = null;
        render();
    }));

    const saveButton = actionButton('Wijzigingen opslaan', 'primary', () => {});
    saveButton.type = 'submit';
    actions.appendChild(saveButton);
    editor.appendChild(actions);

    editor.addEventListener('submit', event => {
        event.preventDefault();
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const date = isoDateToDutch(dateInput.value);
        const location = locationInput.value.trim();

        if (!title || !content || !date) {
            error.textContent = 'Vul een geldige titel, datum en blogtekst in.';
            return;
        }

        const reviewed = {
            title, date, location, content,
            textSelection: 'custom',
            customContent: content === (selectedBase === 'original' ? post.content : post.improvedContent)
                ? record.reviewed.customContent
                : content,
            baseSelection: selectedBase,
            baseContent: selectedBase === 'original' ? post.content : post.improvedContent,
            preserveCustomDraft: Boolean(record.reviewed.customContent),
            images: record.reviewed.images
        };
        const savedRecord = modifiedRecord(reviewed);
        if (!reviewedDiffers(post, savedRecord.reviewed)) {
            error.textContent = 'Er zijn nog geen wijzigingen ten opzichte van het origineel.';
            return;
        }

        records[post.sourceId] = savedRecord;
        editingId = null;
        persist();
        render();
        announce('Aangepaste blogtekst opgeslagen.');
    });

    requestAnimationFrame(() => titleInput.focus());
    return editor;
}

function textVersionLabel(selection) {
    return ({ improved: 'Verbeterd met AI', original: 'Origineel', custom: 'Eigen aanpassing' })[selection] || 'Verbeterd met AI';
}

function diffFragment(before, after) {
    const fragment = document.createDocumentFragment();
    const a = before.match(/\S+\s*/g) || [];
    const b = after.match(/\S+\s*/g) || [];
    let prefix = 0;
    while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
    let suffix = 0;
    while (suffix < a.length - prefix && suffix < b.length - prefix
        && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1;
    fragment.append(document.createTextNode(a.slice(0, prefix).join('')));
    if (a.length - prefix - suffix) fragment.appendChild(textElement('del', 'diff-remove', a.slice(prefix, a.length - suffix).join('')));
    if (b.length - prefix - suffix) fragment.appendChild(textElement('ins', 'diff-add', b.slice(prefix, b.length - suffix).join('')));
    fragment.append(document.createTextNode(a.slice(a.length - suffix).join('')));
    return fragment;
}

function createTextControls(post, record) {
    const wrapper = document.createElement('div');
    wrapper.className = 'text-review-controls';
    const selector = document.createElement('div');
    selector.className = 'text-version-selector';
    ['improved', 'original', ...(record.reviewed.customContent ? ['custom'] : [])].forEach(selection => {
        const button = actionButton(textVersionLabel(selection), '', () => {
            const nextReviewed = selectReviewedText(post, record.reviewed, selection);
            records[post.sourceId] = record.decision === 'pending'
                ? { decision: 'pending', reviewed: nextReviewed }
                : modifiedRecord(nextReviewed);
            persist();
            render();
        });
        button.classList.toggle('active', record.reviewed.textSelection === selection);
        button.setAttribute('aria-pressed', String(record.reviewed.textSelection === selection));
        selector.appendChild(button);
    });
    const compare = actionButton(comparingId === post.sourceId ? 'Vergelijking sluiten' : 'Teksten vergelijken', 'compare', () => {
        comparingId = comparingId === post.sourceId ? null : post.sourceId;
        render();
    });
    wrapper.append(selector, compare);
    return wrapper;
}

function createComparison(post) {
    const section = document.createElement('section');
    section.className = 'text-comparison';
    section.appendChild(textElement('p', 'diff-legend', 'Rood = verwijderd uit origineel · groen = toegevoegd in de AI-versie'));
    const columns = document.createElement('div');
    columns.className = 'comparison-columns';
    const original = document.createElement('div');
    original.appendChild(textElement('h4', '', 'Origineel'));
    original.appendChild(textElement('div', 'comparison-copy', post.content));
    const improved = document.createElement('div');
    improved.appendChild(textElement('h4', '', 'Verbeterd met AI'));
    const diff = document.createElement('div');
    diff.className = 'comparison-copy diff-copy';
    diff.appendChild(diffFragment(post.content, post.improvedContent));
    improved.appendChild(diff);
    columns.append(original, improved);
    section.appendChild(columns);
    return section;
}

function readinessItems(post, record) {
    const original = createRecord(post).reviewed;
    const images = record.reviewed.images;
    const active = activeImages(images).length;
    const removed = images.existing.filter(image => image.decision === 'remove').length;
    const uploads = images.uploads.length;
    return [
        { tone: record.reviewed.title.trim() ? 'ready' : 'warning', label: record.reviewed.title.trim() ? 'Titel gecontroleerd' : 'Titel ontbreekt' },
        { tone: record.reviewed.location.trim() ? 'ready' : 'warning', label: record.reviewed.location.trim() ? 'Locatie ingevuld' : 'Locatie ontbreekt — mag bewust leeg blijven' },
        { tone: record.reviewed.textSelection === 'improved' ? 'ready' : 'attention', label: record.reviewed.textSelection === 'improved' ? 'Aanbevolen AI-tekst geselecteerd' : `Tekstversie: ${textVersionLabel(record.reviewed.textSelection)}` },
        { tone: active ? 'ready' : 'warning', label: active ? `${active} actieve afbeelding${active === 1 ? '' : 'en'}` : 'Geen actieve afbeelding' },
        { tone: removed || uploads ? 'attention' : 'ready', label: removed || uploads ? `${removed ? `${removed} verwijderd` : ''}${removed && uploads ? ' · ' : ''}${uploads ? `${uploads} toegevoegd` : ''}` : 'Oorspronkelijke afbeeldingen behouden' },
        { tone: record.reviewed.title !== original.title || record.reviewed.date !== original.date ? 'attention' : 'ready', label: record.reviewed.title !== original.title || record.reviewed.date !== original.date ? 'Titel of datum aangepast' : 'Titel en datum ongewijzigd' }
    ];
}

function createReadinessChecklist(post, record) {
    const section = document.createElement('section');
    section.className = 'readiness-checklist';
    section.appendChild(textElement('h4', '', 'Controleer voordat je beslist'));
    const list = document.createElement('ul');
    readinessItems(post, record).forEach(item => {
        list.appendChild(textElement('li', item.tone, item.label));
    });
    section.appendChild(list);
    return section;
}

function createGuidedCard(post) {
    const record = records[post.sourceId] || createRecord(post);
    const card = document.createElement('article');
    card.className = 'guided-card';
    card.dataset.decision = record.decision;
    const pending = pendingPosts();
    const position = Math.max(1, pending.findIndex(candidate => candidate.sourceId === post.sourceId) + 1);
    card.appendChild(textElement('p', 'guided-kicker', pending.length ? `Open blogbericht ${position} van ${pending.length}` : 'Alle open blogberichten zijn afgehandeld'));
    card.appendChild(textElement('h2', '', formatTitle(record.reviewed.title, record.reviewed.location)));
    card.appendChild(textElement('p', 'guided-meta', `${record.reviewed.date}${record.reviewed.location ? ` · ${record.reviewed.location}` : ''}`));

    const layout = document.createElement('div');
    layout.className = 'guided-layout';
    const main = document.createElement('div');
    main.appendChild(createTextControls(post, record));
    main.appendChild(textElement('div', 'post-copy', record.reviewed.content));
    if (comparingId === post.sourceId) main.appendChild(createComparison(post));
    const aside = document.createElement('aside');
    aside.append(createReadinessChecklist(post, record), createGallery(post, record, true));
    layout.append(main, aside);
    card.appendChild(layout);

    const actions = document.createElement('div');
    actions.className = 'guided-actions';
    actions.append(
        actionButton('Afkeuren', 'reject', () => rejectPost(post)),
        actionButton('Aanpassen', 'modify', () => { editingId = post.sourceId; render(); }),
        actionButton('Overslaan', '', showNextOpenPost),
        actionButton('Volgende', '', showNextOpenPost),
        actionButton('Goedkeuren', 'approve primary-approve', () => requestApproval(post))
    );
    card.appendChild(actions);
    if (editingId === post.sourceId) card.appendChild(createEditor(post, record));
    return card;
}

function createPostCard(post) {
    const record = records[post.sourceId] || createRecord(post);
    const card = document.createElement('article');
    card.className = 'post-card';
    card.dataset.decision = record.decision;
    card.id = `post-${post.sourceId}`;

    const inner = document.createElement('div');
    inner.className = 'post-inner';
    const content = document.createElement('div');

    const meta = document.createElement('div');
    meta.className = 'post-meta';
    meta.append(
        textElement('span', 'post-date', record.reviewed.date),
        textElement('span', `post-location${record.reviewed.location ? '' : ' empty'}`, record.reviewed.location || 'Locatie nog niet vastgesteld'),
        textElement('span', 'status-chip', STATUS_LABELS[record.decision])
    );
    content.appendChild(meta);
    content.appendChild(textElement('h3', '', formatTitle(record.reviewed.title, record.reviewed.location)));
    content.appendChild(createTextControls(post, record));
    content.appendChild(textElement('div', 'post-copy', record.reviewed.content));
    if (comparingId === post.sourceId) content.appendChild(createComparison(post));

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    actions.append(
        actionButton('Goedkeuren', 'approve', () => requestApproval(post)),
        actionButton('Afkeuren', 'reject', () => rejectPost(post)),
        actionButton(record.decision === 'modified' ? 'Aanpassing bewerken' : 'Tekst aanpassen', 'modify', () => {
            editingId = post.sourceId;
            render();
        }),
        actionButton('Terugzetten', 'reset', () => resetDecision(post)),
        actionButton('In reviewmodus openen', '', () => showGuidedReview(post.sourceId))
    );
    content.appendChild(actions);
    inner.appendChild(content);
    inner.appendChild(createGallery(post, record));
    card.appendChild(inner);

    if (editingId === post.sourceId) {
        card.appendChild(createEditor(post, record));
    }

    return card;
}

function render() {
    updateSummary();
    const guided = reviewMode === 'guided';
    elements.guidedReview.hidden = !guided;
    elements.overview.hidden = guided;
    elements.guidedModeButton.classList.toggle('primary', guided);
    elements.guidedModeButton.setAttribute('aria-pressed', String(guided));
    elements.overviewModeButton.classList.toggle('primary', !guided);
    elements.overviewModeButton.setAttribute('aria-pressed', String(!guided));

    if (guided) {
        const post = focusedPost();
        elements.guidedReview.replaceChildren();
        if (post) {
            focusedPostId = post.sourceId;
            elements.guidedReview.appendChild(createGuidedCard(post));
        } else {
            elements.guidedReview.appendChild(textElement('div', 'empty-state', 'Er zijn geen blogberichten beschikbaar.'));
        }
        return;
    }

    const filtered = visiblePosts();
    const fragment = document.createDocumentFragment();
    filtered.forEach(post => fragment.appendChild(createPostCard(post)));

    elements.posts.replaceChildren(fragment);
    elements.posts.setAttribute('aria-busy', 'false');
    elements.empty.hidden = filtered.length > 0;
}

async function downloadReview() {
    elements.exportButton.disabled = true;
    elements.exportButton.textContent = 'Pakket maken…';
    try {
        const payload = buildExportPayload(posts, records);
        const uploadDescriptors = new Map();
        Object.values(records).forEach(record => {
            (record.reviewed.images?.uploads || []).forEach(upload => uploadDescriptors.set(upload.id, upload));
        });

        const files = [{
            path: 'review.json',
            data: new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' })
        }];
        for (const descriptor of uploadDescriptors.values()) {
            const stored = await getUpload(descriptor.id);
            if (!stored?.blob) {
                throw new Error(`Upload ontbreekt: ${descriptor.originalFilename}. Voeg deze afbeelding opnieuw toe.`);
            }
            if (stored.blob.size !== descriptor.size || stored.blob.type !== descriptor.mimeType) {
                throw new Error(`Upload is gewijzigd of beschadigd: ${descriptor.originalFilename}.`);
            }
            files.push({ path: descriptor.packagePath, data: stored.blob });
        }

        const zip = await buildZip(files);
        const url = URL.createObjectURL(zip);
        const anchor = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        anchor.href = url;
        anchor.download = `anyway-old-blog-review-${today}.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        announce('Reviewpakket gedownload.');
    } catch (error) {
        console.error('Reviewpakket kon niet worden gemaakt.', error);
        announce(error.message || 'Reviewpakket kon niet worden gemaakt.');
    } finally {
        elements.exportButton.disabled = false;
        elements.exportButton.textContent = EXPORT_BUTTON_LABEL;
    }
}

function bindControls() {
    elements.search.addEventListener('input', render);
    elements.filterGroup.addEventListener('click', event => {
        const button = event.target.closest('[data-filter]');
        if (!button) return;
        activeFilter = button.dataset.filter;
        elements.filterGroup.querySelectorAll('[data-filter]').forEach(candidate => {
            const active = candidate === button;
            candidate.classList.toggle('active', active);
            candidate.setAttribute('aria-pressed', String(active));
        });
        editingId = null;
        render();
    });
    elements.exportButton.addEventListener('click', downloadReview);
    elements.guidedModeButton.addEventListener('click', () => showGuidedReview());
    elements.overviewModeButton.addEventListener('click', showOverview);
    window.addEventListener('beforeunload', event => {
        const summary = summarize(posts, records);
        if (summary.total - summary.pending === 0 || summary.pending === 0) return;
        event.preventDefault();
        event.returnValue = '';
    });
}

async function initialize() {
    try {
        await openUploadStore();
        const response = await fetch('./blogs-data.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (payload.schemaVersion !== 3 || payload.kind !== 'anyway-old-blog-review-source' || !Array.isArray(payload.posts)) {
            throw new Error('Onverwacht gegevensformaat');
        }

        posts = payload.posts;
        records = hydrateRecords(posts, loadStoredPayload());
        const referencedUploadIds = new Set(
            Object.values(records).flatMap(record => record.reviewed.images?.uploads?.map(upload => upload.id) || [])
        );
        const storedUploads = await getAllUploads();
        await deleteUploads(storedUploads.filter(upload => !referencedUploadIds.has(upload.id)).map(upload => upload.id));
        persist();
        bindControls();
        elements.exportButton.disabled = false;
        render();
    } catch (error) {
        console.error('Reviewgegevens konden niet worden geladen.', error);
        elements.posts.hidden = true;
        elements.empty.hidden = true;
        elements.error.hidden = false;
    }
}

initialize();
