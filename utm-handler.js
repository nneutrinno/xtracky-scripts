(function () {
    const config = {
        'token': '',
        'clickIdParam': 'click_id',
        'pixelIdParam': 'pixel_id',
        'stepId': 'initial',
        'currentUrl': new URL(window.location.href),
        'campaignIdParam': 'CampaignID',
    };
    console.log({ config });
    function initializeFromScript() {
        const currentScript = getCurrentScript();
        if (currentScript) {
            Object.assign(config, {
                token: getDataToken() || '',
                clickIdParam: currentScript.getAttribute("data-click-id-param") || 'click_id',
                pixelIdParam: currentScript.getAttribute("data-pixel-id-param") || 'pixel_id',
                campaignIdParam: currentScript.getAttribute("data-campaign-id") || 'CampaignID',
                stepId: currentScript.getAttribute("data-step-id") || 'initial',
                currentUrl: new URL(window.location.href),
            });
        }
    }
    function getCurrentScript() {
        const currentScript = document.currentScript;
        return currentScript;
    }
    function getDataToken() {
        const script = getCurrentScript();
        return script?.getAttribute("data-token");
    }
    function getUrlParameters() {
        // Returns the URLSearchParams converted to an object
        return Object.fromEntries(new URLSearchParams(window.location.search));
    }
    function updateAllLinks(utmValue) {
        const links = document.querySelectorAll('a');
        links.forEach(link => {
            if (!link.href || link.href.startsWith('#')) {
                return;
            }
            const currentQuery = config.currentUrl.searchParams;
            currentQuery.set("utm_source", utmValue);
            console.log('link.search', link.search);
            const current = new URLSearchParams(link.search);
            for (const item of currentQuery) {
                current.set(...item);
            }
            const url = new URL(link.href);
            url.search = current.toString();
            link.href = url.href;
        });
    }
    async function dispatch(data) {
        return false;
        // The code below is unreachable due to the return statement above
        /*
        const endpoint = 'https://api.xtracky.com/api/integrations/view';
        
        try {
            console.log('VIEW', { data });
            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(3000),
                keepalive: true
            });
            return true;
        } catch (error) {
            console.warn('Erro ao enviar view:', error);
            return false;
        }
        */
    }
    function createUTMValue({ token, clickId, pixelId, campaignId }) {
        return [token, clickId, pixelId, campaignId].join('::');
    }
    async function handleUtmParameters() {
        const urlParams = getUrlParameters();
        const clickId = urlParams[config.clickIdParam] || null;
        const pixelId = urlParams[config.pixelIdParam] || '';
        const campaignId = urlParams[config.campaignIdParam] || '';
        const utmValue = createUTMValue({
            token: config.token,
            clickId,
            pixelId,
            campaignId,
        });
        console.log({ urlParams, clickId, utmValue });
        if (clickId) {
            config.currentUrl.searchParams.set("utm_source", utmValue);
            localStorage.setItem(`KWAI_UTM_TRACK_${config.token}`, utmValue);
            window.history.pushState({}, '', config.currentUrl.toString());
            await dispatch({
                r: btoa(config.currentUrl.href),
                utmSource: utmValue,
                stepId: config.stepId
            });
            updateAllLinks(utmValue);
        }
        else {
            const hasUtmSaved = localStorage.getItem(`KWAI_UTM_TRACK_${config.token}`);
            if (hasUtmSaved) {
                config.currentUrl.searchParams.set("utm_source", hasUtmSaved);
                window.history.pushState({}, '', config.currentUrl.toString());
                await dispatch({
                    r: btoa(config.currentUrl.href),
                    utmSource: hasUtmSaved,
                    stepId: config.stepId
                });
                updateAllLinks(hasUtmSaved);
            }
        }
    }
    onMount();
    async function onMount() {
        initializeFromScript();
        await onLoad(handleUtmParameters);
        initWatch();
    }
    function isDocumentLoaded() {
        return document.readyState === 'complete';
    }
    function onLoad(fn) {
        if (isDocumentLoaded())
            return fn();
        window.addEventListener("load", fn);
    }
    function initWatch() {
        watchNavigation();
        watchIframes();
    }
    function watchNavigation() {
        polyfill();
        if (window.navigation)
            return run();
        window.addEventListener('navigationReady', run);
        function run() {
            let lastURL;
            window.navigation?.addEventListener("navigate", (event) => {
                const navigation = window.navigation;
                if (!event?.destination?.url)
                    return;
                event.destination.url = event?.destination?.url?.href ?? event?.destination?.url;
                if (!shouldIntercept(event))
                    return;
                event.preventDefault();
                redirect(event, getURL());
                function redirect(event, url) {
                    const shouldRefresh = !event.destination.sameDocument;
                    lastURL = url;
                    if (shouldRefresh)
                        return navigation.navigate(url, { history: event.navigationType === 'push' ? 'push' : event.navigationType === 'replace' ? 'replace' : 'auto' });
                    history.pushState({}, '', url);
                }
                function shouldIntercept(event) {
                    return lastURL !== event.destination.url;
                }
                function getURL() {
                    return mergeURLSearchs(location.href, event.destination.url);
                }
                function mergeURLSearchs(...urls) {
                    const instances = urls.map(url => new URL(url));
                    const [main] = instances;
                    main.search = new URLSearchParams(Object.assign({}, ...instances.map(url => Object.fromEntries(url.searchParams)))).toString();
                    return main.href;
                }
            });
        }
        function polyfill() {
            if (!window.navigation) {
                // Dynamically load the polyfill only if needed
                const polyfillScript = document.createElement('script');
                polyfillScript.type = 'module';
                polyfillScript.textContent = `
                    // Import the polyfill from Skypack
                    import * as navigationPolyfill from 'https://cdn.skypack.dev/navigation-api-polyfill';
                    window.dispatchEvent(new Event('navigationReady'));
                `;
                document.head.appendChild(polyfillScript);
            }
            else {
                // Navigation API is natively supported, dispatch ready event immediately
                window.dispatchEvent(new Event('navigationReady'));
            }
        }
    }
    function watchIframes() {
        function $watch(query, process) {
            onLoad(() => {
                // Process existing iframes when page loads
                process(document.querySelectorAll(query));
                // Set up observer for dynamically added iframes
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        // Check for added nodes
                        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                            mutation.addedNodes.forEach((node) => {
                                // Check if the added node is an iframe
                                if (node instanceof Element) {
                                    if (node.matches(query)) {
                                        process([node]);
                                    }
                                    // Check if the added node contains iframes
                                    process(node.querySelectorAll(query));
                                }
                            });
                        }
                    });
                });
                // Start observing the entire document for changes
                observer.observe(document, {
                    childList: true, // Watch for changes to the direct children
                    subtree: true // Watch for changes in the entire subtree
                });
                // Function to process iframes and add parent URL parameters
            });
        }
        function processIframes(iframes) {
            iframes.forEach(iframe => {
                if (iframe.src) {
                    const url = new URL(iframe.src);
                    url.search = new URLSearchParams({
                        ...Object.fromEntries(new URLSearchParams(window.location.search)),
                        ...Object.fromEntries(url.searchParams),
                    }).toString();
                    iframe.src = url.href;
                }
            });
        }
        $watch('iframe', processIframes);
    }
})();
