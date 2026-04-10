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

// Helper to parse dates robustly (handles Dutch months, multi-day dates, DD-MM-YYYY, etc.)
function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    
    const multiDayParts = extractMultiDayDateParts(dateStr);
    let str = (multiDayParts
        ? `${multiDayParts.days[0]} ${multiDayParts.month} ${multiDayParts.year}`
        : dateStr.trim()
    ).toLowerCase();

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

    // Try parsing as standard date string
    let date = new Date(str);
    if (!isNaN(date.getTime())) return date;

    // Try parsing DD-MM-YYYY or DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) return new Date(dmy[3], dmy[2] - 1, dmy[1]);

    // Fallback: extract a day + month + year sequence from a more complex string
    const complexDate = str.match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/i);
    if (complexDate) {
        const extractedDate = new Date(`${complexDate[1]} ${complexDate[2]} ${complexDate[3]}`);
        if (!isNaN(extractedDate.getTime())) return extractedDate;
    }

    return new Date(0); // Unknown format
}

// Helper to check if a date is in the past
function isPast(dateStr) {
    const eventDate = parseDate(dateStr);
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
