const encoder = new TextEncoder();

function makeCrcTable() {
    return Array.from({ length: 256 }, (_, index) => {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        return value >>> 0;
    });
}

const CRC_TABLE = makeCrcTable();

export function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    const year = Math.max(1980, date.getFullYear());
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
}

function header(size) {
    return new Uint8Array(size);
}

export async function buildZip(files, timestamp = new Date()) {
    const seen = new Set();
    const entries = [];
    const parts = [];
    let offset = 0;
    const { time, date } = dosDateTime(timestamp);

    for (const file of files) {
        if (!file?.path || seen.has(file.path)) throw new Error(`Ongeldig of dubbel ZIP-pad: ${file?.path || ''}`);
        seen.add(file.path);
        const name = encoder.encode(file.path);
        const data = file.data instanceof Uint8Array
            ? file.data
            : new Uint8Array(await file.data.arrayBuffer());
        const crc = crc32(data);
        const local = header(30);
        const view = new DataView(local.buffer);
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 0x0800, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, time, true);
        view.setUint16(12, date, true);
        view.setUint32(14, crc, true);
        view.setUint32(18, data.length, true);
        view.setUint32(22, data.length, true);
        view.setUint16(26, name.length, true);
        view.setUint16(28, 0, true);
        parts.push(local, name, data);
        entries.push({ name, crc, size: data.length, offset });
        offset += local.length + name.length + data.length;
    }

    const centralOffset = offset;
    for (const entry of entries) {
        const central = header(46);
        const view = new DataView(central.buffer);
        view.setUint32(0, 0x02014b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(6, 20, true);
        view.setUint16(8, 0x0800, true);
        view.setUint16(10, 0, true);
        view.setUint16(12, time, true);
        view.setUint16(14, date, true);
        view.setUint32(16, entry.crc, true);
        view.setUint32(20, entry.size, true);
        view.setUint32(24, entry.size, true);
        view.setUint16(28, entry.name.length, true);
        view.setUint16(30, 0, true);
        view.setUint16(32, 0, true);
        view.setUint16(34, 0, true);
        view.setUint16(36, 0, true);
        view.setUint32(38, 0, true);
        view.setUint32(42, entry.offset, true);
        parts.push(central, entry.name);
        offset += central.length + entry.name.length;
    }

    const end = header(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, offset - centralOffset, true);
    endView.setUint32(16, centralOffset, true);
    parts.push(end);

    return new Blob(parts, { type: 'application/zip' });
}
