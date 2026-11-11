(function() {
    const footer = document.getElementById('footer');
    if (footer) {
        footer.innerHTML = `
            <section class="contact">
                <p class="footer-name">Anyway</p>
                <p class="footer-details">
                    <a href="tel:+31653245253">06 53 24 52 53</a>
                    <a href="mailto:anywaytexel@xs4all.nl">anywaytexel@xs4all.nl</a>
                </p>
                <ul class="icons">
                    <li><a href="https://www.youtube.com/@anywaytexel" class="icon brands fa-youtube" target="_blank" rel="noopener noreferrer"><span class="label">YouTube</span></a></li>
                </ul>
            </section>
        `;
    }
})();
