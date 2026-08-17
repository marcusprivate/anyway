import { crc32 } from './zip-export.mjs';

const decoder = new TextDecoder();
const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;

function fail(message) {
    throw new Error(message);
}

export function readCheckpointZip(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const files = new Map();
    const entries = [];
    let offset = 0;
    while (offset < data.length) {
        if (offset + 4 > data.length || new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true) !== LOCAL_SIGNATURE) break;
        if (offset + 30 > data.length) fail('Het ZIP-bestand is beschadigd.');
        const view = new DataView(data.buffer, data.byteOffset + offset, 30);
        const flags = view.getUint16(6, true);
        const method = view.getUint16(8, true);
        const expectedCrc = view.getUint32(14, true);
        const compressedSize = view.getUint32(18, true);
        const size = view.getUint32(22, true);
        const nameLength = view.getUint16(26, true);
        const extraLength = view.getUint16(28, true);
        if (flags !== 0x0800 || method !== 0 || compressedSize !== size) fail('Dit ZIP-formaat wordt niet ondersteund.');
        const start = offset + 30;
        const contentStart = start + nameLength + extraLength;
        const end = contentStart + size;
        if (end > data.length) fail('Het ZIP-bestand is beschadigd.');
        const name = decoder.decode(data.slice(start, start + nameLength));
        if (!name || name.includes('..') || name.startsWith('/') || name.includes('\\') || files.has(name)) {
            fail('Het ZIP-bestand bevat een onveilig of dubbel bestandspad.');
        }
        const content = data.slice(contentStart, end);
        if (crc32(content) !== expectedCrc) fail(`Bestand is beschadigd: ${name}.`);
        files.set(name, content);
        entries.push({ name, crc: expectedCrc, size, offset });
        offset = end;
    }
    const centralOffset = offset;
    const centralEntries = [];
    while (offset < data.length && offset + 4 <= data.length
        && new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true) === CENTRAL_SIGNATURE) {
        if (offset + 46 > data.length) fail('Het ZIP-bestand is beschadigd.');
        const view = new DataView(data.buffer, data.byteOffset + offset, 46);
        const flags = view.getUint16(8, true);
        const method = view.getUint16(10, true);
        const crc = view.getUint32(16, true);
        const compressedSize = view.getUint32(20, true);
        const size = view.getUint32(24, true);
        const nameLength = view.getUint16(28, true);
        const extraLength = view.getUint16(30, true);
        const commentLength = view.getUint16(32, true);
        const localOffset = view.getUint32(42, true);
        const end = offset + 46 + nameLength + extraLength + commentLength;
        if (end > data.length || flags !== 0x0800 || method !== 0 || compressedSize !== size) fail('Het ZIP-bestand is beschadigd.');
        centralEntries.push({
            name: decoder.decode(data.slice(offset + 46, offset + 46 + nameLength)), crc, size, offset: localOffset
        });
        offset = end;
    }
    if (offset + 22 > data.length || new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true) !== END_SIGNATURE) {
        fail('Het ZIP-bestand is beschadigd.');
    }
    const endView = new DataView(data.buffer, data.byteOffset + offset, 22);
    const count = endView.getUint16(10, true);
    const centralSize = endView.getUint32(12, true);
    const declaredCentralOffset = endView.getUint32(16, true);
    const commentLength = endView.getUint16(20, true);
    if (offset + 22 + commentLength !== data.length || count !== entries.length || count !== centralEntries.length
        || declaredCentralOffset !== centralOffset || centralSize !== offset - centralOffset
        || entries.some((entry, index) => JSON.stringify(entry) !== JSON.stringify(centralEntries[index]))) {
        fail('Het ZIP-bestand is beschadigd.');
    }
    if (!files.has('review.json') || files.size === 0) fail('Dit ZIP-bestand bevat geen reviewpakket.');
    return files;
}
