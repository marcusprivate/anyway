document.addEventListener('DOMContentLoaded', function() {
    const blogContainer = document.getElementById('blog-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const searchInput = document.getElementById('blog-search');
    const yearSelect = document.getElementById('blog-year');
    
    const itemsPerBatch = 8; // Larger batches reduce how often the layout shifts during long scrolls
    const mobileBreakpoint = 736;
    let displayedCount = 0;
    let currentData = []; // Will hold filtered data
    let isLoading = false; // Prevent rapid-fire loading
    let scrollObserver = null; // IntersectionObserver instance
    let renderVersion = 0; // Discard stale async renders
    const imageMetadataCache = new Map();
    let resizeTimeout = null;

    function getImageSource(item) {
        if (!item.image || !item.image.trim() || item.image.trim().endsWith('/')) {
            return null;
        }

        return item.image.trim();
    }

    function preloadImageMetadata(src) {
        if (!src) {
            return Promise.resolve(null);
        }

        if (imageMetadataCache.has(src)) {
            return imageMetadataCache.get(src);
        }

        const metadataPromise = new Promise(resolve => {
            const img = new Image();

            img.decoding = 'async';
            img.onload = function() {
                resolve({
                    width: img.naturalWidth || 1,
                    height: img.naturalHeight || 1
                });
            };
            img.onerror = function() {
                resolve(null);
            };
            img.src = src;
        });

        imageMetadataCache.set(src, metadataPromise);
        return metadataPromise;
    }

    async function prepareItems(items) {
        return Promise.all(items.map(async item => {
            const imageSrc = getImageSource(item);
            const imageMeta = await preloadImageMetadata(imageSrc);

            return {
                ...item,
                _imageSrc: imageSrc,
                _imageMeta: imageMeta
            };
        }));
    }

    function waitForNextFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    function layoutBlogPosts() {
        const articles = Array.from(blogContainer.querySelectorAll('article'));
        if (articles.length === 0) {
            blogContainer.style.height = '';
            return;
        }

        if (window.innerWidth <= mobileBreakpoint) {
            blogContainer.style.height = '';
            articles.forEach(article => {
                article.style.transform = '';
            });
            return;
        }

        const gap = parseFloat(getComputedStyle(blogContainer).getPropertyValue('--blog-gap')) || 0;
        const columnWidth = articles[0].getBoundingClientRect().width;
        const columnHeights = [0, 0];

        articles.forEach((article, index) => {
            const columnIndex = index < 2 ? index : (columnHeights[0] <= columnHeights[1] ? 0 : 1);
            const x = columnIndex * (columnWidth + gap);
            const y = columnHeights[columnIndex];

            article.style.transform = `translate(${x}px, ${y}px)`;
            columnHeights[columnIndex] += article.offsetHeight + gap;
        });

        blogContainer.style.height = `${Math.max(...columnHeights) - gap}px`;
    }

    function createPost(item) {
        const article = document.createElement('article');
        const linkAttributes = getLinkAttributes(item.link);
        const displayDate = formatDateDisplay(item.date || '');

        article.classList.add('is-pending-layout');
        
        let imageHtml = '';
        const imageSrc = item._imageSrc || getImageSource(item);
        const imageMeta = item._imageMeta || null;
        // Reserve image space before inserting the card to keep scroll position stable.
        if (imageSrc) {
            const altText = item.title || 'Blog afbeelding';
            const sizeAttributes = imageMeta
                ? ` width="${imageMeta.width}" height="${imageMeta.height}"`
                : '';
            const smallImageStyle = imageMeta && imageMeta.width < 600
                ? ` style="max-width: min(100%, ${imageMeta.width}px); margin: 0 auto; display: block;"`
                : '';

            imageHtml = `<span class="image fit"><img src="${imageSrc}" alt="${altText}" loading="lazy" decoding="async"${sizeAttributes}${smallImageStyle} /></span>`;
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
                <span class="date">${displayDate}</span>
                <h2>${item.title || 'Zonder titel'}</h2>
            </header>
            ${imageHtml}
            <p>${processedContent}</p>
            ${linkHtml}
        `;
        
        return article;
    }

    async function renderBlog(append = false) {
        if (isLoading && append) return; // Only block append calls, not resets
        const currentRenderVersion = ++renderVersion;
        isLoading = true;
        blogContainer.setAttribute('aria-busy', 'true');
        
        try {
            if (!append) {
                blogContainer.innerHTML = '';
                displayedCount = 0;
            }

            const start = displayedCount;
            const end = Math.min(displayedCount + itemsPerBatch, currentData.length);
            const itemsToShow = currentData.slice(start, end);

            if (currentData.length === 0) {
                blogContainer.style.height = '';
                blogContainer.innerHTML = '<p style="text-align: center; width: 100%;">Geen resultaten gevonden.</p>';
                loadMoreBtn.style.display = 'none';
                return;
            }

            const preparedItems = await prepareItems(itemsToShow);
            if (currentRenderVersion !== renderVersion) {
                return;
            }

            const fragment = document.createDocumentFragment();
            const newItems = preparedItems.map(item => {
                const post = createPost(item);
                fragment.appendChild(post);
                return post;
            });
            blogContainer.appendChild(fragment);

            await waitForNextFrame();

            if (currentRenderVersion !== renderVersion) {
                return;
            }

            layoutBlogPosts();
            await waitForNextFrame();

            if (currentRenderVersion !== renderVersion) {
                return;
            }

            newItems.forEach(item => item.classList.remove('is-pending-layout'));

            displayedCount = end;

            // Show/hide loading indicator
            if (displayedCount >= currentData.length) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'block';
            }
        } finally {
            if (currentRenderVersion === renderVersion) {
                isLoading = false;
                blogContainer.removeAttribute('aria-busy');
            }
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
        blogContainer.style.height = '';
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

        window.addEventListener('resize', () => {
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }

            resizeTimeout = setTimeout(() => {
                layoutBlogPosts();
            }, 100);
        });

        // Event listeners
        searchInput.addEventListener('input', filterPosts);
        yearSelect.addEventListener('change', filterPosts);

        // Infinite scroll: load more when user scrolls near bottom
        // Use debounced callback to prevent rapid-fire loading when scrolling fast
        let scrollTimeout = null;
        scrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && displayedCount < currentData.length && !isLoading) {
                // Debounce: wait for scroll to settle before loading
                if (scrollTimeout) clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    if (!isLoading) {
                        renderBlog(true); // Append more items
                    }
                }, 75);
            }
        }, { rootMargin: '1800px 0px' });
        
        scrollObserver.observe(loadMoreBtn);
    }

    // Start loading data
    loadBlogData();
});
