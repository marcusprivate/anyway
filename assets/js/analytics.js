(function() {
	var goatCounterEndpoint = 'https://anyway.goatcounter.com/count';
	var existingScript = document.querySelector('script[data-goatcounter="' + goatCounterEndpoint + '"]');

	if (existingScript) {
		return;
	}

	// Load the visitor counter once for the active-site pages.
	var script = document.createElement('script');
	
	script.async = true;
	script.src = 'https://gc.zgo.at/count.js';
	script.setAttribute('data-goatcounter', goatCounterEndpoint);

	document.head.appendChild(script);
})();