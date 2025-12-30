/**
 * Shared utility functions for Anyway website
 */

// Helper to parse dates robustly (handles Dutch months, DD-MM-YYYY, etc.)
function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    
    // Normalize
    let str = dateStr.trim().toLowerCase();

    // Handle multi-day formats like "17, 18 mei 2024" or "3, 4, 5 juni 2022"
    // Extract the first day and the month/year
    const multiDayMatch = str.match(/^(\d{1,2})(?:,\s*\d{1,2})+\s+(\w+)\s+(\d{4})$/);
    if (multiDayMatch) {
        str = `${multiDayMatch[1]} ${multiDayMatch[2]} ${multiDayMatch[3]}`;
    }

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

    // Try extracting a date pattern (e.g. "17 en 18 may 2024" -> "18 may 2024")
    // This finds the last number followed by a month and year
    // Improved regex to handle optional dot after month and case insensitivity
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
