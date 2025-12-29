document.addEventListener('DOMContentLoaded', function() {
    const blogContainer = document.getElementById('blog-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');
    const searchInput = document.getElementById('blog-search');
    const yearSelect = document.getElementById('blog-year');
    
    const itemsPerPage = 6; // 6 items per page for grid layout
    let currentPage = 1;
    let currentData = []; // Will hold filtered data

    function createPost(item) {
        const article = document.createElement('article');
        const linkAttributes = getLinkAttributes(item.link);
        
        let imageHtml = '';
        if (item.image) {
            // Prevent upscaling low-res images (only apply if image is smaller than 600px)
            imageHtml = `<span class="image fit"><img src="${item.image}" alt="" onload="if(this.naturalWidth < 600) { this.style.maxWidth = this.naturalWidth + 'px'; this.style.margin = '0 auto'; this.style.display = 'block'; }" /></span>`;
        }

        let linkHtml = '';
        if (item.link) {
            linkHtml = `
                <ul class="actions special">
                    <li><a href="${item.link}" class="button"${linkAttributes}>Meer info</a></li>
                </ul>`;
        }

        // Process content to make external links open in new tab
        let processedContent = item.content;
        if (item.content && item.content.includes('<a')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item.content;
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
                <span class="date">${item.date}</span>
                <h2>${item.title}</h2>
            </header>
            ${imageHtml}
            <p>${processedContent}</p>
            ${linkHtml}
        `;
        
        return article;
    }

    function renderBlog(page) {
        blogContainer.innerHTML = '';
        
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedItems = currentData.slice(start, end);
        
        if (paginatedItems.length === 0) {
            blogContainer.innerHTML = '<p style="text-align: center; width: 100%;">Geen resultaten gevonden.</p>';
        } else {
            paginatedItems.forEach(item => {
                blogContainer.appendChild(createPost(item));
            });
        }

        // Update controls
        const totalPages = Math.ceil(currentData.length / itemsPerPage);
        pageInfo.textContent = `Pagina ${currentPage} van ${totalPages || 1}`;
        
        if (currentPage === 1) {
            prevBtn.classList.add('disabled');
        } else {
            prevBtn.classList.remove('disabled');
        }
        
        if (end >= currentData.length) {
            nextBtn.classList.add('disabled');
        } else {
            nextBtn.classList.remove('disabled');
        }
    }

    function filterPosts() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedYear = yearSelect.value;

        currentData = blogData.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchTerm) || 
                                  item.content.toLowerCase().includes(searchTerm);
            
            // Parse year robustly
            const itemDate = parseDate(item.date);
            const itemYear = itemDate.getFullYear().toString();
            const matchesYear = selectedYear === '' || itemYear === selectedYear;

            return matchesSearch && matchesYear;
        });

        currentPage = 1;
        renderBlog(currentPage);
    }

    let blogData = []; // Will hold all data loaded from YAML

    // Function to load and parse YAML data
    async function loadBlogData() {
        try {
            const response = await fetch('content/blog.yaml');
            const yamlText = await response.text();
            blogData = jsyaml.load(yamlText);
            
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
        pageInfo.style.display = 'none';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
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
        renderBlog(currentPage);

        // Event listeners
        searchInput.addEventListener('input', filterPosts);
        yearSelect.addEventListener('change', filterPosts);

        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                renderBlog(currentPage);
                document.getElementById('main').scrollIntoView({ behavior: 'smooth' });
            }
        });

        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if ((currentPage * itemsPerPage) < currentData.length) {
                currentPage++;
                renderBlog(currentPage);
                document.getElementById('main').scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // Start loading data
    loadBlogData();
});
