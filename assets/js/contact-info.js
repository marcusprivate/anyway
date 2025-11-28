document.addEventListener('DOMContentLoaded', function() {
    const footer = document.getElementById('footer');
    if (footer) {
        footer.innerHTML = `
            <section class="contact">
                <h3>Contact</h3>
                <p>
                    <strong>Telefoon:</strong> <a href="tel:+31653245253">06 53 24 52 53</a><br />
                    <strong>E-mail:</strong> <a href="mailto:anywaytexel@xs4all.nl">anywaytexel@xs4all.nl</a>
                </p>
                <h3>Social</h3>
                <ul class="icons alt">
                    <li><a href="#" class="icon brands alt fa-facebook-f"><span class="label">Facebook</span></a></li>
                    <li><a href="#" class="icon brands alt fa-instagram"><span class="label">Instagram</span></a></li>
                </ul>
            </section>
        `;
    }
});
