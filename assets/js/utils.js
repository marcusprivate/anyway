/**
 * Shared utility functions for Anyway website
 */

function extractMultiDayDateParts(dateStr) {
    if (!dateStr) return null;

    const match = dateStr.trim().match(/^(\d{1,2}(?:\s*,\s*\d{1,2})*)(?:\s+en\s+(\d{1,2}))?\s+([^\d\s]+)\s+(\d{4})$/i);
    if (!match) return null;

    const days = match[1]
        .split(/\s*,\s*/)
        .map(day => day.trim())
        .filter(Boolean);

    if (match[2]) {
        days.push(match[2].trim());
    }

    if (days.length < 2) return null;

    return {
        days,
        month: match[3],
        year: match[4]
    };
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';

    const multiDayParts = extractMultiDayDateParts(dateStr);
    if (!multiDayParts) return dateStr;

    const { days, month, year } = multiDayParts;
    const formattedDays = days.length === 2
        ? `${days[0]} en ${days[1]}`
        : `${days.slice(0, -1).join(', ')} en ${days[days.length - 1]}`;

    return `${formattedDays} ${month} ${year}`;
}

function normalizeDateString(dateStr) {
    if (!dateStr) return '';

    let str = dateStr.trim().toLowerCase();

    // Map Dutch months to English
    const months = {
        'januari': 'January', 'februari': 'February', 'maart': 'March', 'april': 'April', 'mei': 'May', 'juni': 'June',
        'juli': 'July', 'augustus': 'August', 'september': 'September', 'oktober': 'October', 'november': 'November', 'december': 'December',
        'jan': 'Jan', 'feb': 'Feb', 'mrt': 'Mar', 'apr': 'Apr', 'jun': 'Jun', 'jul': 'Jul', 'aug': 'Aug', 'sep': 'Sep', 'okt': 'Oct', 'nov': 'Nov', 'dec': 'Dec',
        'jan.': 'Jan', 'feb.': 'Feb', 'mrt.': 'Mar', 'apr.': 'Apr', 'jun.': 'Jun', 'jul.': 'Jul', 'aug.': 'Aug', 'sep.': 'Sep', 'sept.': 'Sep', 'okt.': 'Oct', 'nov.': 'Nov', 'dec.': 'Dec'
    };

    // Replace month names
    for (let [nl, en] of Object.entries(months)) {
        const regex = new RegExp(nl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        str = str.replace(regex, en);
    }

    return str;
}

function parseSingleDate(dateStr) {
    if (!dateStr) return new Date(0);

    const str = normalizeDateString(dateStr);
    const monthIndexes = {
        january: 0, jan: 0,
        february: 1, feb: 1,
        march: 2, mar: 2,
        april: 3, apr: 3,
        may: 4,
        june: 5, jun: 5,
        july: 6, jul: 6,
        august: 7, aug: 7,
        september: 8, sep: 8,
        october: 9, oct: 9,
        november: 10, nov: 10,
        december: 11, dec: 11
    };

    // Try parsing DD-MM-YYYY or DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) return new Date(dmy[3], dmy[2] - 1, dmy[1]);

    // Parse "DD Month YYYY" explicitly to avoid browser-specific timezone coercion.
    const monthDate = str.match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/i);
    if (monthDate) {
        const monthIndex = monthIndexes[monthDate[2].toLowerCase()];
        if (monthIndex != null) {
            return new Date(monthDate[3], monthIndex, monthDate[1]);
        }
    }

    // Fallback: extract a day + month + year sequence from a more complex string.
    const complexDate = str.match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/i);
    if (complexDate) {
        const monthIndex = monthIndexes[complexDate[2].toLowerCase()];
        if (monthIndex != null) {
            return new Date(complexDate[3], monthIndex, complexDate[1]);
        }
    }

    // Last resort for formats outside the curated set.
    const fallbackDate = new Date(str);
    if (!isNaN(fallbackDate.getTime())) return fallbackDate;

    return new Date(0); // Unknown format
}

// Helper to derive a start/end range for single and multi-day events.
function getDateRange(dateStr) {
    if (!dateStr) {
        const unknownDate = new Date(0);
        return { startDate: unknownDate, endDate: unknownDate };
    }

    const multiDayParts = extractMultiDayDateParts(dateStr);
    if (!multiDayParts) {
        const singleDate = parseSingleDate(dateStr);
        return { startDate: singleDate, endDate: singleDate };
    }

    const sortedDays = multiDayParts.days
        .map(day => parseInt(day, 10))
        .filter(day => !Number.isNaN(day))
        .sort((a, b) => a - b);

    if (sortedDays.length === 0) {
        const unknownDate = new Date(0);
        return { startDate: unknownDate, endDate: unknownDate };
    }

    const startDate = parseSingleDate(`${sortedDays[0]} ${multiDayParts.month} ${multiDayParts.year}`);
    const endDate = parseSingleDate(`${sortedDays[sortedDays.length - 1]} ${multiDayParts.month} ${multiDayParts.year}`);

    return { startDate, endDate };
}

// Helper to parse dates robustly (handles Dutch months, multi-day dates, DD-MM-YYYY, etc.)
function parseDate(dateStr) {
    return getDateRange(dateStr).startDate;
}

// Helper to check if a date is in the past
function isPast(dateStr) {
    const eventDate = getDateRange(dateStr).endDate;
    const now = new Date();
    now.setHours(0,0,0,0);
    return eventDate < now;
}

// Helper to determine if a link is external and return attributes
function getLinkAttributes(url) {
    if (!url || url.startsWith('#')) return '';
    try {
        const linkUrl = new URL(url, window.location.href);
        if (linkUrl.hostname !== window.location.hostname) {
            return ' target="_blank" rel="noopener noreferrer"';
        }
    } catch (e) {
        // Ignore invalid URLs
    }
    return '';
}

// Debounce helper: delays function execution until after wait ms of inactivity
function debounce(fn, wait) {
    let timeoutId = null;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Load and parse YAML data from a file path
async function loadYamlData(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return jsyaml.load(text);
}

// Safely get a property value with a default fallback
function safeGet(obj, key, defaultValue = '') {
    return (obj && obj[key] != null) ? obj[key] : defaultValue;
}
