let agendaData = [];

async function loadAgendaData() {
    try {
        agendaData = await loadYamlData('content/agenda.yaml');
        initAgenda();
    } catch (error) {
        console.error('Error loading agenda data:', error);
        renderAgendaError();
    }
}

function initAgenda() {
    const searchInput = document.getElementById('agenda-search');
    const featureSection = document.getElementById('agenda-feature-section');
    const featureContainer = document.getElementById('agenda-feature');
    const upcomingCount = document.getElementById('agenda-upcoming-count');
    const archiveCount = document.getElementById('agenda-archive-count');
    const upcomingList = document.getElementById('agenda-upcoming-list');
    const archiveList = document.getElementById('agenda-archive-list');
    const pagination = document.getElementById('agenda-pagination');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');
    const upcomingSection = upcomingList ? upcomingList.closest('section') : null;
    const archiveItemsPerPage = 10;
    let currentPage = 1;

    if (!searchInput || !featureSection || !featureContainer || !upcomingCount || !archiveCount || !upcomingList || !archiveList || !pagination || !prevBtn || !nextBtn || !pageInfo || !upcomingSection) {
        return;
    }

    const today = getToday();
    const agendaItems = agendaData.map(item => createAgendaItemViewModel(item, today));

    function createAgendaItemViewModel(item, comparisonDate) {
        const rawDate = item.date || '';
        const location = item.location || '';
        const event = item.event || '';
        const { startDate, endDate } = getDateRange(rawDate);
        const displayDate = formatDateDisplay(rawDate);
        const statusText = `${location} ${event}`;
        const isPrivate = /\b(besloten|priv[eé])\b/i.test(statusText);
        const isCancelled = /\b(geannuleerd|afgelast)\b/i.test(statusText);
        const isArchived = endDate < comparisonDate;
        const isUpcoming = !isArchived;
        const isFeatureable = isUpcoming && !isCancelled;
        const searchText = [rawDate, displayDate, location, event].join(' ').toLowerCase();

        return {
            ...item,
            rawDate,
            location,
            event,
            displayDate,
            startDate,
            endDate,
            isUpcoming,
            isArchived,
            isPrivate,
            isCancelled,
            isFeatureable,
            searchText
        };
    }

    function getAgendaViewState() {
        const searchValue = searchInput.value.trim();
        const searchTerm = searchValue.toLowerCase();
        const filteredItems = agendaItems.filter(item => item.searchText.includes(searchTerm));
        const upcomingItems = filteredItems
            .filter(item => item.isUpcoming)
            .sort(compareUpcomingItems);
        const archiveItems = filteredItems
            .filter(item => item.isArchived)
            .sort(compareArchivedItems);
        const totalPages = Math.max(1, Math.ceil(archiveItems.length / archiveItemsPerPage));

        currentPage = Math.min(Math.max(currentPage, 1), totalPages);

        return {
            searchValue,
            searchTerm,
            upcomingItems,
            archiveItems,
            paginatedArchiveItems: archiveItems.slice((currentPage - 1) * archiveItemsPerPage, currentPage * archiveItemsPerPage),
            featuredItem: upcomingItems.find(item => item.isFeatureable) || null,
            totalPages
        };
    }

    function renderAgenda() {
        const state = getAgendaViewState();
        const isFirstPage = currentPage === 1;

        renderFeaturedItem(isFirstPage ? state.featuredItem : null);

        upcomingSection.hidden = !isFirstPage;
        if (isFirstPage) {
            renderAgendaSection(upcomingList, state.upcomingItems, {
                emptyState: state.searchTerm
                    ? `Geen komende optredens gevonden voor "${state.searchValue}".`
                    : 'Er staan op dit moment geen komende optredens in de agenda.'
            });
        } else {
            upcomingList.innerHTML = '';
        }

        renderAgendaSection(archiveList, state.paginatedArchiveItems, {
            emptyState: state.searchTerm
                ? `Geen archiefoptredens gevonden voor "${state.searchValue}".`
                : 'Er zijn nog geen archiefoptredens om te tonen.'
        });

        upcomingCount.textContent = formatCountLabel(state.upcomingItems.length, 'optreden');
        archiveCount.textContent = formatCountLabel(state.archiveItems.length, 'optreden');
        renderPagination(state.archiveItems.length, state.totalPages);
    }

    function renderFeaturedItem(item) {
        featureContainer.innerHTML = '';

        if (!item) {
            featureSection.hidden = true;
            return;
        }

        featureSection.hidden = false;
        featureContainer.appendChild(createAgendaCard(item, true));
    }

    function renderAgendaSection(container, items, options) {
        container.innerHTML = '';

        if (items.length === 0) {
            container.appendChild(createEmptyState(options.emptyState));
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => fragment.appendChild(createAgendaCard(item)));
        container.appendChild(fragment);
    }

    function renderPagination(totalArchiveItems, totalPages) {
        const showPagination = totalArchiveItems > archiveItemsPerPage;

        pagination.hidden = !showPagination;
        pageInfo.textContent = `Pagina ${currentPage} van ${totalPages}`;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
        prevBtn.classList.toggle('disabled', prevBtn.disabled);
        nextBtn.classList.toggle('disabled', nextBtn.disabled);
    }

    function changePage(delta) {
        const { totalPages } = getAgendaViewState();
        const nextPage = Math.min(Math.max(currentPage + delta, 1), totalPages);

        if (nextPage === currentPage) {
            return;
        }

        currentPage = nextPage;
        renderAgenda();
    }

    searchInput.addEventListener('input', () => {
        currentPage = 1;
        renderAgenda();
    });
    prevBtn.addEventListener('click', () => changePage(-1));
    nextBtn.addEventListener('click', () => changePage(1));

    renderAgenda();
}

function getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function compareUpcomingItems(a, b) {
    return (
        a.startDate - b.startDate ||
        a.endDate - b.endDate ||
        a.location.localeCompare(b.location, 'nl') ||
        a.event.localeCompare(b.event, 'nl')
    );
}

function compareArchivedItems(a, b) {
    return (
        b.endDate - a.endDate ||
        b.startDate - a.startDate ||
        a.location.localeCompare(b.location, 'nl') ||
        a.event.localeCompare(b.event, 'nl')
    );
}

function formatCountLabel(count, noun) {
    return `${count} ${noun}${count === 1 ? '' : 'en'}`;
}

function createAgendaCard(item, isFeatured = false) {
    const article = document.createElement('article');
    article.className = isFeatured ? 'agenda-entry agenda-entry-featured' : 'agenda-entry';

    const dateColumn = document.createElement('div');
    dateColumn.className = 'agenda-entry-date';

    const dateLabel = document.createElement('span');
    dateLabel.className = 'agenda-entry-date-label';
    dateLabel.textContent = isFeatured ? 'Datum' : 'Speeldatum';
    dateColumn.appendChild(dateLabel);

    const dateValue = document.createElement('strong');
    dateValue.className = 'agenda-entry-date-value';
    dateValue.textContent = item.displayDate;
    dateColumn.appendChild(dateValue);

    const content = document.createElement('div');
    content.className = 'agenda-entry-content';

    const meta = document.createElement('div');
    meta.className = 'agenda-entry-meta';

    const location = document.createElement('p');
    location.className = 'agenda-entry-location';
    location.textContent = item.location;
    meta.appendChild(location);

    const badges = createAgendaBadges(item);
    if (badges.childElementCount > 0) {
        meta.appendChild(badges);
    }

    const title = document.createElement(isFeatured ? 'h3' : 'h4');
    title.className = 'agenda-entry-title';
    title.textContent = item.event;

    content.appendChild(meta);
    content.appendChild(title);

    article.appendChild(dateColumn);
    article.appendChild(content);

    return article;
}

function createAgendaBadges(item) {
    const badgeRow = document.createElement('div');
    badgeRow.className = 'agenda-entry-badges';

    if (item.isCancelled) {
        const cancelledBadge = document.createElement('span');
        cancelledBadge.className = 'agenda-badge agenda-badge-cancelled';
        cancelledBadge.textContent = 'Geannuleerd';
        badgeRow.appendChild(cancelledBadge);
    }

    if (item.isPrivate) {
        const privateBadge = document.createElement('span');
        privateBadge.className = 'agenda-badge agenda-badge-private';
        privateBadge.textContent = 'Besloten';
        badgeRow.appendChild(privateBadge);
    }

    return badgeRow;
}

function createEmptyState(message) {
    const emptyState = document.createElement('div');
    emptyState.className = 'agenda-empty-state';
    emptyState.textContent = message;
    return emptyState;
}

function renderAgendaError() {
    const featureSection = document.getElementById('agenda-feature-section');
    const upcomingSection = document.getElementById('agenda-upcoming-list')?.closest('section');
    const upcomingList = document.getElementById('agenda-upcoming-list');
    const archiveList = document.getElementById('agenda-archive-list');
    const upcomingCount = document.getElementById('agenda-upcoming-count');
    const archiveCount = document.getElementById('agenda-archive-count');
    const pagination = document.getElementById('agenda-pagination');

    if (featureSection) {
        featureSection.hidden = true;
    }

    if (upcomingSection) {
        upcomingSection.hidden = false;
    }

    if (upcomingCount) {
        upcomingCount.textContent = '';
    }

    if (archiveCount) {
        archiveCount.textContent = '';
    }

    if (upcomingList) {
        upcomingList.innerHTML = '';
        upcomingList.appendChild(createEmptyState('De agenda kon niet geladen worden. Probeer het later opnieuw.'));
    }

    if (archiveList) {
        archiveList.innerHTML = '';
    }

    if (pagination) {
        pagination.hidden = true;
    }
}

document.addEventListener('DOMContentLoaded', loadAgendaData);
