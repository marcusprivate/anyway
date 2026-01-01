document.addEventListener('DOMContentLoaded', function() {
    const blogContainer = document.getElementById('blog-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const searchInput = document.getElementById('blog-search');
    const yearSelect = document.getElementById('blog-year');
    
    const itemsPerBatch = 6; // 6 items per batch for grid layout
    let displayedCount = 0;
    let currentData = []; // Will hold filtered data
    let isLoading = false; // Prevent rapid-fire loading
    let scrollObserver = null; // IntersectionObserver instance

    function createPost(item) {
        const article = document.createElement('article');
        const linkAttributes = getLinkAttributes(item.link);
        
        let imageHtml = '';
        if (item.image) {
            const altText = item.title || 'Blog afbeelding';
            // Add lazy loading and responsive image attributes for performance
            imageHtml = `<span class="image fit"><img src="${item.image}" alt="${altText}" loading="lazy" width="100%" height="auto" onload="if(this.naturalWidth < 600) { this.style.maxWidth = this.naturalWidth + 'px'; this.style.margin = '0 auto'; this.style.display = 'block'; }" /></span>`;
        }

        let linkHtml = '';
        if (item.link) {
            linkHtml = `
                <ul class="actions special">
                    <li><a href="${item.link}" class="button"${linkAttributes}>Meer info</a></li>
                </ul>`;
        }

        // Process content to make external links open in new tab
        let processedContent = item.content || '';
        if (processedContent && processedContent.includes('<a')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = processedContent;
            const contentLinks = tempDiv.querySelectorAll('a');
            contentLinks.forEach(link => {
                if (link.hostname !== window.location.hostname) {
                    link.setAttribute('target', '_blank');
                    link.setAttribute('rel', 'noopener noreferrer');
                }
            });
            processedContent = tempDiv.innerHTML;
        }

        // Convert newlines to <br> for display
        if (processedContent) {
            processedContent = processedContent.replace(/\n/g, '<br>');
        }

        article.innerHTML = `
            <header>
                <span class="date">${item.date || ''}</span>
                <h2>${item.title || 'Zonder titel'}</h2>
            </header>
            ${imageHtml}
            <p>${processedContent}</p>
            ${linkHtml}
        `;
        
        return article;
    }

    // Interleave items for correct reading order in 2-column CSS column layout
    // Column layout fills top-to-bottom, so we reorder items to appear left-to-right
    // With 6 items, columns show: Col1[0,1,2] Col2[3,4,5]
    // We want visual order: Row1(1,2) Row2(3,4) Row3(5,6)
    // So we need to output: [1,3,5,2,4,6] -> Col1 shows 1,3,5 and Col2 shows 2,4,6
    function interleaveForColumns(items) {
        if (window.innerWidth <= 736 || items.length <= 2) {
            return items; // Single column on mobile, no reordering needed
        }
        
        const half = Math.ceil(items.length / 2);
        const col1 = []; // Items for left column (odd positions: 1st, 3rd, 5th...)
        const col2 = []; // Items for right column (even positions: 2nd, 4th, 6th...)
        
        for (let i = 0; i < items.length; i++) {
            if (i % 2 === 0) {
                col1.push(items[i]); // 0, 2, 4 -> visual positions 1, 3, 5
            } else {
                col2.push(items[i]); // 1, 3, 5 -> visual positions 2, 4, 6
            }
        }
        
        return [...col1, ...col2];
    }

    function renderBlog(append = false) {
        if (isLoading && append) return; // Only block append calls, not resets
        isLoading = true;
        
        if (!append) {
            blogContainer.innerHTML = '';
            displayedCount = 0;
        }
        
        const start = displayedCount;
        const end = Math.min(displayedCount + itemsPerBatch, currentData.length);
        const itemsToShow = currentData.slice(start, end);
        
        if (currentData.length === 0) {
            blogContainer.innerHTML = '<p style="text-align: center; width: 100%;">Geen resultaten gevonden.</p>';
            loadMoreBtn.style.display = 'none';
            isLoading = false; // Reset loading flag
        } else {
            // For append mode with column layout, we need to re-render all items
            // to maintain correct interleaved order
            if (append) {
                blogContainer.innerHTML = '';
                const allItemsToShow = currentData.slice(0, end);
                const interleaved = interleaveForColumns(allItemsToShow);
                const fragment = document.createDocumentFragment();
                interleaved.forEach(item => {
                    fragment.appendChild(createPost(item));
                });
                blogContainer.appendChild(fragment);
            } else {
                const interleaved = interleaveForColumns(itemsToShow);
                const fragment = document.createDocumentFragment();
                interleaved.forEach(item => {
                    fragment.appendChild(createPost(item));
                });
                blogContainer.appendChild(fragment);
            }
            displayedCount = end;
            
            // Show/hide loading indicator
            if (displayedCount >= currentData.length) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'block';
            }
            
            isLoading = false;
        }
    }



    function filterPosts() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedYear = yearSelect.value;

        currentData = blogData.filter(item => {
            const title = item.title || '';
            const content = item.content || '';
            const matchesSearch = title.toLowerCase().includes(searchTerm) || 
                                  content.toLowerCase().includes(searchTerm);
            
            // Parse year robustly
            const itemDate = parseDate(item.date);
            const itemYear = itemDate.getFullYear().toString();
            const matchesYear = selectedYear === '' || itemYear === selectedYear;

            return matchesSearch && matchesYear;
        });

        renderBlog(false); // Reset and show first batch
    }

    let blogData = []; // Will hold all data loaded from YAML

    // Function to load and parse YAML data
    async function loadBlogData() {
        try {
            blogData = await loadYamlData('content/blog.yaml');
            
            if (blogData && blogData.length > 0) {
                initializeBlog();
            } else {
                showNoData();
            }
        } catch (e) {
            console.error('Error loading blog data:', e);
            showNoData();
        }
    }

    function showNoData() {
        blogContainer.innerHTML = '<p>Geen blog items gevonden.</p>';
        loadMoreBtn.style.display = 'none';
    }

    function initializeBlog() {
        // Sort data by date (newest first)
        blogData.sort((a, b) => parseDate(b.date) - parseDate(a.date));

        // Initialize data
        currentData = [...blogData];

        // Populate years
        const years = [...new Set(blogData.map(item => parseDate(item.date).getFullYear().toString()))].sort().reverse();
        years.forEach(year => {
            if (year !== '1970') { // Filter out invalid dates
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            }
        });

        // Initial render
        renderBlog(false);

        // Event listeners
        searchInput.addEventListener('input', filterPosts);
        yearSelect.addEventListener('change', filterPosts);

        // Infinite scroll: load more when user scrolls near bottom
        scrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && displayedCount < currentData.length && !isLoading) {
                renderBlog(true); // Append more items
            }
        }, { rootMargin: '200px' });
        
        scrollObserver.observe(loadMoreBtn);
    }

    // Start loading data
    loadBlogData();
});
