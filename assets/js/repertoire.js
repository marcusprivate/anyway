let repertoireData = [];

async function loadRepertoireData() {
    try {
        const response = await fetch('content/repertoire.yaml');
        const yamlText = await response.text();
        repertoireData = jsyaml.load(yamlText);
        initRepertoire();
    } catch (error) {
        console.error('Error loading repertoire data:', error);
    }
}

function initRepertoire() {
    const searchInput = document.getElementById('repertoire-search');
    const filterAll = document.getElementById('filter-all');
    const filterVideo = document.getElementById('filter-video');
    const tableBody = document.getElementById('repertoire-body');
    
    let showYoutubeOnly = false;

    if (repertoireData.length === 0) {
        console.error('repertoireData is empty.');
        return;
    }

    function renderRepertoire() {
        const searchTerm = searchInput.value.toLowerCase();
        const isDesktop = window.innerWidth >= 737;
        
        // Clear current content
        tableBody.innerHTML = '';

        // Filter data
        const visibleItems = repertoireData.filter(item => {
            const text = (item.id + '. ' + item.title).toLowerCase();
            const hasYoutube = !!item.youtube;
            
            const matchesSearch = text.includes(searchTerm);
            const matchesYoutube = !showYoutubeOnly || hasYoutube;
            
            return matchesSearch && matchesYoutube;
        });

        if (visibleItems.length === 0) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.id = 'no-results-row';
            noResultsRow.style.gridColumn = '1 / -1';
            noResultsRow.innerHTML = '<td style="text-align: center; border: none; padding: 2rem;">Geen nummers gevonden.</td>';
            tableBody.appendChild(noResultsRow);
            return;
        }

        // Render items
        visibleItems.forEach((item, index) => {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            
            // Build content
            let content = `${item.id}. `;
            
            if (item.youtube) {
                content += `<a href="${item.youtube}" target="_blank" rel="noopener noreferrer">${item.title} <i class="icon brands fa-youtube" style="color: #cc181e;"></i></a>`;
            } else {
                content += item.title;
            }
            
            td.innerHTML = content;
            tr.appendChild(td);
            
            // Apply zebra striping logic
            let shouldBeGray = false;
            if (isDesktop) {
                // Desktop: Pairs of 2 (Gray, Gray, White, White)
                shouldBeGray = Math.floor(index / 2) % 2 === 0;
            } else {
                // Mobile: Alternating (Gray, White, Gray, White)
                shouldBeGray = index % 2 === 0;
            }
            
            if (shouldBeGray) {
                tr.classList.add('highlight-row');
            }
            
            // Handle borders
            const isLast = index === visibleItems.length - 1;
            const isSecondLast = index === visibleItems.length - 2;
            
            if (isLast) {
                td.style.borderBottom = 'none';
            }
            
            if (isDesktop && isSecondLast && visibleItems.length % 2 === 0) {
                td.style.borderBottom = 'none';
            }

            tableBody.appendChild(tr);
        });
    }

    searchInput.addEventListener('input', renderRepertoire);
    
    // Re-render on resize to switch between mobile/desktop striping
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(renderRepertoire, 250);
    });
    
    filterAll.addEventListener('click', () => {
        showYoutubeOnly = false;
        filterAll.classList.add('active');
        filterVideo.classList.remove('active');
        renderRepertoire();
    });

    filterVideo.addEventListener('click', () => {
        showYoutubeOnly = true;
        filterVideo.classList.add('active');
        filterAll.classList.remove('active');
        renderRepertoire();
    });
    
    // Initial render
    renderRepertoire();
}

document.addEventListener('DOMContentLoaded', loadRepertoireData);
