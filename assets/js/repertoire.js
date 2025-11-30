document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('repertoire-search');
    const filterAll = document.getElementById('filter-all');
    const filterVideo = document.getElementById('filter-video');
    let showYoutubeOnly = false;
    
    const tableBody = document.getElementById('repertoire-body');
    const rows = Array.from(tableBody.getElementsByTagName('tr'));

    function filterRepertoire() {
        const searchTerm = searchInput.value.toLowerCase();
        let visibleRows = [];

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const hasYoutube = row.querySelector('a[href*="youtu"]');
            
            const matchesSearch = text.includes(searchTerm);
            const matchesYoutube = !showYoutubeOnly || hasYoutube;

            if (matchesSearch && matchesYoutube) {
                row.style.display = '';
                visibleRows.push(row);
            } else {
                row.style.display = 'none';
            }
        });

        // Re-apply zebra striping logic for grid layout
        // We need to manually handle the background colors because CSS nth-child counts hidden rows
        const isDesktop = window.innerWidth >= 737;
        
        visibleRows.forEach((row, index) => {
            // Reset styles first
            row.classList.remove('highlight-row');
            
            let shouldBeGray = false;
            
            if (isDesktop) {
                // Desktop: Pairs of 2 (Gray, Gray, White, White)
                // Formula: Math.floor(index / 2) % 2 === 0 ? Gray : White
                shouldBeGray = Math.floor(index / 2) % 2 === 0;
            } else {
                // Mobile: Alternating (Gray, White, Gray, White)
                // Formula: index % 2 === 0 ? Gray : White
                shouldBeGray = index % 2 === 0;
            }
            
            if (shouldBeGray) {
                row.classList.add('highlight-row');
            }
        });
        
        // Fix borders for the last visible row(s)
        // Reset borders
        rows.forEach(r => {
            const td = r.querySelector('td');
            if(td) td.style.borderBottom = '';
        });

        if (visibleRows.length > 0) {
            // Remove no-results message if it exists
            const noResultsRow = document.getElementById('no-results-row');
            if (noResultsRow) {
                noResultsRow.remove();
            }

            const lastRow = visibleRows[visibleRows.length - 1];
            const secondLastRow = visibleRows.length > 1 ? visibleRows[visibleRows.length - 2] : null;
            
            if (lastRow) lastRow.querySelector('td').style.borderBottom = 'none';
            
            // In a 2-column grid (desktop), the second to last item might also be at the bottom visually
            if (isDesktop && secondLastRow && visibleRows.length % 2 === 0) {
                secondLastRow.querySelector('td').style.borderBottom = 'none';
            }
        } else {
            // Show no-results message if it doesn't exist
            if (!document.getElementById('no-results-row')) {
                const noResultsRow = document.createElement('tr');
                noResultsRow.id = 'no-results-row';
                // Ensure it spans full width in grid layout
                noResultsRow.style.gridColumn = '1 / -1';
                noResultsRow.innerHTML = '<td style="text-align: center; border: none; padding: 2rem;">Geen nummers gevonden.</td>';
                tableBody.appendChild(noResultsRow);
            }
        }
    }

    searchInput.addEventListener('input', filterRepertoire);
    
    // Re-calculate on resize to switch between mobile/desktop striping
    window.addEventListener('resize', filterRepertoire);
    
    filterAll.addEventListener('click', () => {
        showYoutubeOnly = false;
        filterAll.classList.add('active');
        filterVideo.classList.remove('active');
        filterRepertoire();
    });

    filterVideo.addEventListener('click', () => {
        showYoutubeOnly = true;
        filterVideo.classList.add('active');
        filterAll.classList.remove('active');
        filterRepertoire();
    });
    
    // Initial run to set striping correctly if needed
    filterRepertoire();
});
