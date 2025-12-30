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
            // Prevent upscaling low-res images (only apply if image is smaller than 600px)
            imageHtml = `<span class="image fit"><img src="${item.image}" alt="${altText}" onload="if(this.naturalWidth < 600) { this.style.maxWidth = this.naturalWidth + 'px'; this.style.margin = '0 auto'; this.style.display = 'block'; }" /></span>`;
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
            itemsToShow.forEach(item => {
                blogContainer.appendChild(createPost(item));
            });
            displayedCount = end;
            
            // Show/hide loading indicator
            if (displayedCount >= currentData.length) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'block';
            }
            
            // Remove bottom border from articles that are at the bottom of their column
            // Use setTimeout to ensure layout has finished rendering
            setTimeout(() => {
                removeBottomBordersFromColumnEnds();
                isLoading = false; // Allow next load after render complete
            }, 50);
        }
    }

    function removeBottomBordersFromColumnEnds() {
        const articles = blogContainer.querySelectorAll('article');
        if (articles.length === 0) return;

        // Reset all borders first (clear any inline styles)
        articles.forEach(article => {
            article.style.borderBottom = '';
        });

        // On mobile, CSS handles everything with !important - don't touch
        if (window.innerWidth <= 736) {
            return;
        }

        // Multi-column: find articles at the bottom of each column
        // Group articles by their horizontal position (left offset)
        const columns = {};
        articles.forEach((article, index) => {
            const left = article.offsetLeft;
            if (!columns[left]) {
                columns[left] = [];
            }
            columns[left].push({ article, index });
        });

        // For each column, find the last article (highest offsetTop)
        Object.values(columns).forEach(columnArticles => {
            let lastArticle = columnArticles[0];
            columnArticles.forEach(item => {
                if (item.article.offsetTop >= lastArticle.article.offsetTop) {
                    lastArticle = item;
                }
            });
            lastArticle.article.style.borderBottom = 'none';
        });
    }

    // Re-run border detection on window resize (handles orientation change)
    window.addEventListener('resize', debounce(removeBottomBordersFromColumnEnds, 100));

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
