export const ALLOWED_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_UPLOAD_BYTES = 250 * 1024 * 1024;

export function sanitizeFilename(value) {
    const clean = String(value || 'afbeelding')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/-+\./g, '.')
        .replace(/^[-.]+|[-.]+$/g, '');
    return clean || 'afbeelding';
}

export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function sha256Hex(blob) {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createUploadDescriptor(file, sourceId, alt) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error(`${file.name}: gebruik een JPEG-, PNG- of WebP-bestand.`);
    }
    if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(`${file.name}: het bestand is groter dan 20 MB.`);
    }

    const id = `upload:${crypto.randomUUID()}`;
    const safeFilename = sanitizeFilename(file.name);
    return {
        id,
        originalFilename: file.name,
        mimeType: file.type,
        size: file.size,
        sha256: await sha256Hex(file),
        packagePath: `uploaded-images/${sourceId}/${id.slice(7)}-${safeFilename}`,
        alt: alt || ''
    };
}
