import assert from 'node:assert/strict';
import test from 'node:test';
import { carouselIndex, gestureDirection, normalizeImages, swipeOffset } from '../assets/js/blog-gallery-core.mjs';

test('gallery normalization supports canonical galleries and legacy images', () => {
    assert.deepEqual(normalizeImages({ title: 'Legacy', image: 'content/images/legacy.webp' }), [
        { src: 'content/images/legacy.webp', alt: 'Legacy', width: null, height: null }
    ]);
    assert.deepEqual(normalizeImages({
        title: 'Galerij',
        images: [{ src: ' content/images/one.webp ', alt: 'Eén', width: 640, height: 480 }, { src: '' }]
    }), [{ src: 'content/images/one.webp', alt: 'Eén', width: 640, height: 480 }]);
    assert.deepEqual(normalizeImages({ image: 'content/images/' }), []);
});

test('carousel index wraps safely at both ends', () => {
    assert.equal(carouselIndex(0, -1, 3), 2);
    assert.equal(carouselIndex(2, 1, 3), 0);
    assert.equal(carouselIndex(1, -1, 3), 0);
    assert.equal(carouselIndex(1, 1, 3), 2);
    assert.equal(carouselIndex(0, 1, 0), 0);
});

test('gesture direction locks only after deliberate movement', () => {
    assert.equal(gestureDirection({ x: 100, y: 100 }, { x: 105, y: 103 }), 'undecided');
    assert.equal(gestureDirection({ x: 100, y: 100 }, { x: 120, y: 105 }), 'horizontal');
    assert.equal(gestureDirection({ x: 100, y: 100 }, { x: 105, y: 120 }), 'vertical');
    assert.equal(gestureDirection({ x: 100, y: 100 }, { x: 112, y: 112 }), 'vertical');
});

test('swipes navigate only on deliberate horizontal movement', () => {
    assert.equal(swipeOffset({ x: 100, y: 100 }, { x: 50, y: 105 }), 1);
    assert.equal(swipeOffset({ x: 100, y: 100 }, { x: 150, y: 95 }), -1);
    assert.equal(swipeOffset({ x: 100, y: 100 }, { x: 65, y: 100 }), 0);
    assert.equal(swipeOffset({ x: 100, y: 100 }, { x: 80, y: 160 }), 0);
});
