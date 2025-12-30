let agendaData = [];

async function loadAgendaData() {
    try {
        const response = await fetch('content/agenda.yaml');
        const yamlText = await response.text();
        agendaData = jsyaml.load(yamlText);
        initAgenda();
    } catch (error) {
        console.error('Error loading agenda data:', error);
    }
}

function initAgenda() {
    const tbody = document.getElementById('agenda-body');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');
    const tableWrapper = document.querySelector('.table-wrapper');
    const table = tableWrapper.querySelector('table');
    
    const itemsPerPage = 10;
    let currentPage = 1;
    let nextShowIndex = -1;
    
    function createRow(item, index) {
        const row = document.createElement('tr');
        
        const itemDate = item.date || '';
        const itemLocation = item.location || '';
        const itemEvent = item.event || '';
        
        if (itemDate && isPast(itemDate)) {
            row.classList.add('past-event');
        } else if (index === nextShowIndex) {
            row.classList.add('next-show');
            // Add a "Next Show" badge or label if desired, or just rely on styling
        }

        const dateCell = document.createElement('td');
        dateCell.textContent = itemDate;
        if (index === nextShowIndex) {
            dateCell.innerHTML += ' <span class="next-show-badge">Eerstvolgende</span>';
        }
        row.appendChild(dateCell);
        
        const locationCell = document.createElement('td');
        locationCell.textContent = itemLocation;
        row.appendChild(locationCell);
        
        const eventCell = document.createElement('td');
        eventCell.textContent = itemEvent;
        row.appendChild(eventCell);
        
        return row;
    }

    function renderTable(page) {
        tbody.innerHTML = '';
        
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedItems = agendaData.slice(start, end);
        
        paginatedItems.forEach((item, i) => {
            tbody.appendChild(createRow(item, start + i));
        });

        // Update controls
        pageInfo.textContent = `Pagina ${currentPage} van ${Math.ceil(agendaData.length / itemsPerPage)}`;
        
        if (currentPage === 1) {
            prevBtn.classList.add('disabled');
        } else {
            prevBtn.classList.remove('disabled');
        }
        
        if (end >= agendaData.length) {
            nextBtn.classList.add('disabled');
        } else {
            nextBtn.classList.remove('disabled');
        }
    }

    if (agendaData.length > 0) {
        // Sort agendaData by date descending (Newest/Future first)
        agendaData.sort((a, b) => parseDate(b.date) - parseDate(a.date));

        // Calculate next show index (assuming descending order: Future -> Past)
        for (let i = 0; i < agendaData.length; i++) {
            if (isPast(agendaData[i].date)) {
                if (i > 0) {
                    nextShowIndex = i - 1;
                }
                break;
            }
        }
        // Edge case: All future
        if (nextShowIndex === -1 && agendaData.length > 0 && !isPast(agendaData[agendaData.length-1].date)) {
            nextShowIndex = agendaData.length - 1;
        }

        // If the next show is on a later page, maybe we should jump to that page?
        // For now, let's just start at page 1. If the next show is far in the future (top of list), it will be on page 1.
        // If the next show is the *last* future event, it might be on page 2 or 3 if there are many future events.
        // But usually "Next Show" is the one closest to today.
        // If the list is descending (2026, 2025...), the closest to today is the *last* one before the past ones.
        // So it could be deep in the list.
        
        // Let's calculate which page the next show is on and start there.
        if (nextShowIndex !== -1) {
            currentPage = Math.floor(nextShowIndex / itemsPerPage) + 1;
        }


        // Function to calculate and set max table height
        function updateTableHeight() {
            // Save current content to restore later
            const savedContent = tbody.innerHTML;
            
            let maxTableHeight = 0;
            const totalPages = Math.ceil(agendaData.length / itemsPerPage);
            
            // Temporarily remove height constraint to measure correctly
            tableWrapper.style.height = 'auto';
            tableWrapper.style.overflowY = 'visible';

            if (totalPages === 0) {
                tbody.innerHTML = '';
                maxTableHeight = table.offsetHeight;
            } else {
                // Render each page to find the tallest one
                for (let i = 1; i <= totalPages; i++) {
                    tbody.innerHTML = '';
                    const start = (i - 1) * itemsPerPage;
                    const end = start + itemsPerPage;
                    const items = agendaData.slice(start, end);
                    items.forEach((item, idx) => tbody.appendChild(createRow(item, start + idx)));
                    
                    const height = table.offsetHeight;
                    if (height > maxTableHeight) {
                        maxTableHeight = height;
                    }
                }
            }
            
            // Set fixed height on wrapper to prevent jumping
            // Add a buffer to prevent vertical scrollbars due to sub-pixel rendering
            tableWrapper.style.height = (maxTableHeight + 20) + 'px';
            tableWrapper.style.overflowY = 'hidden';
            
            // Restore content (or re-render current page)
            renderTable(currentPage);
        }

        // Initial calculation
        updateTableHeight();

        // Debounce resize event
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                updateTableHeight();
            }, 250);
        });

        function changePage(delta) {
            const newPage = currentPage + delta;
            const totalPages = Math.ceil(agendaData.length / itemsPerPage);
            if (newPage >= 1 && newPage <= totalPages) {
                currentPage = newPage;
                renderTable(currentPage);
            }
        }

        function addNavButtonListener(btn, delta) {
            let lastTouchTime = 0;

            const handleAction = (e) => {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                
                // CRITICAL: Remove focus from the button immediately.
                // This prevents "sticky focus" where subsequent swipes might trigger the focused element.
                btn.blur();
                
                changePage(delta);
            };

            // Handle touch events
            btn.addEventListener('touchend', (e) => {
                lastTouchTime = new Date().getTime();
                handleAction(e);
            });

            // Handle click events (for mouse/desktop or if touch event falls through)
            btn.addEventListener('click', (e) => {
                const now = new Date().getTime();
                // Ignore click if it happened shortly after touchend (ghost click prevention)
                if (now - lastTouchTime < 500) return;
                handleAction(e);
            });
        }

        addNavButtonListener(prevBtn, -1);
        addNavButtonListener(nextBtn, 1);

        // Swipe functionality
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        const minSwipeDistance = 30;

        tableWrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return; // Ignore multi-touch
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, {passive: true});

        tableWrapper.addEventListener('touchmove', (e) => {
            const currentX = e.changedTouches[0].screenX;
            const currentY = e.changedTouches[0].screenY;
            const diffX = Math.abs(currentX - touchStartX);
            const diffY = Math.abs(currentY - touchStartY);

            // If horizontal movement is dominant, prevent vertical scrolling
            if (diffX > diffY && diffX > 5) {
                e.preventDefault();
            }
        }, {passive: false});

        tableWrapper.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, {passive: true});
        
        tableWrapper.addEventListener('touchcancel', (e) => {
            touchStartX = 0;
            touchStartY = 0;
            touchEndX = 0;
            touchEndY = 0;
        }, {passive: true});

        function handleSwipe() {
            // Ensure we have valid start coordinates
            if (touchStartX === 0 && touchStartY === 0) return;

            const distanceX = touchEndX - touchStartX;
            const distanceY = touchEndY - touchStartY;
            
            // Check if horizontal swipe is dominant and long enough
            if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
                if (distanceX > 0) {
                    // Swiped Right -> Previous Page
                    changePage(-1);
                } else {
                    // Swiped Left -> Next Page
                    changePage(1);
                }
            }
            
            // Reset coordinates
            touchStartX = 0;
            touchStartY = 0;
            touchEndX = 0;
            touchEndY = 0;
        }

    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Geen agenda items gevonden.</td></tr>';
        pageInfo.style.display = 'none';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', loadAgendaData);
