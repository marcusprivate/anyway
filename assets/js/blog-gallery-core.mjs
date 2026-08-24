export function normalizeImages(item) {
    if (Array.isArray(item.images) && item.images.length > 0) {
        return item.images
            .filter(image => image && typeof image.src === 'string' && image.src.trim())
            .map(image => ({
                src: image.src.trim(),
                alt: typeof image.alt === 'string' && image.alt.trim() ? image.alt.trim() : (item.title || 'Blog afbeelding'),
                width: Number(image.width) || null,
                height: Number(image.height) || null
            }));
    }
    if (typeof item.image === 'string' && item.image.trim() && !item.image.trim().endsWith('/')) {
        return [{ src: item.image.trim(), alt: item.title || 'Blog afbeelding', width: null, height: null }];
    }
    return [];
}

export function carouselIndex(current, offset, total) {
    if (!Number.isInteger(total) || total < 1) return 0;
    return (current + offset + total) % total;
}

export function gestureDirection(start, current, slop = 8) {
    const horizontalDistance = current.x - start.x;
    const verticalDistance = current.y - start.y;
    const horizontalMovement = Math.abs(horizontalDistance);
    const verticalMovement = Math.abs(verticalDistance);

    if (Math.max(horizontalMovement, verticalMovement) < slop) {
        return 'undecided';
    }

    return horizontalMovement > verticalMovement ? 'horizontal' : 'vertical';
}

export function swipeOffset(start, end, threshold = 40) {
    const horizontalDistance = end.x - start.x;
    const verticalDistance = end.y - start.y;

    if (Math.abs(horizontalDistance) < threshold || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) {
        return 0;
    }
    return horizontalDistance < 0 ? 1 : -1;
}
