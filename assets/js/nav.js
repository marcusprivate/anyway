/**
 * Centralized Navigation Menu
 */
(function() {
    const navElement = document.getElementById('nav');
    if (!navElement) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    
    const links = [
        { text: 'Anyway', href: 'index.html' },
        { text: 'Agenda', href: 'agenda.html' },
        { text: 'Repertoire', href: 'repertoire.html' },
        { text: 'Blog', href: 'blog.html' }
    ];

    const socialIcons = [
        { label: 'YouTube', href: 'https://www.youtube.com/@anywaytexel', iconClass: 'icon brands fa-youtube' }
    ];

    // Build Links List
    let linksHtml = '<ul class="links">';
    links.forEach(link => {
        const isActive = currentPath === link.href || (currentPath === '' && link.href === 'index.html');
        const activeClass = isActive ? ' class="active"' : '';
        linksHtml += `<li${activeClass}><a href="${link.href}">${link.text}</a></li>`;
    });
    linksHtml += '</ul>';

    // Build Icons List
    let iconsHtml = '<ul class="icons">';
    socialIcons.forEach(icon => {
        iconsHtml += `<li><a href="${icon.href}" class="${icon.iconClass}"><span class="label">${icon.label}</span></a></li>`;
    });
    iconsHtml += '</ul>';

    navElement.innerHTML = linksHtml + iconsHtml;
})();
