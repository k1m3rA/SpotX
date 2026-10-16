// SpotX helper: fix for the PiP miniplayer growing every time it is opened
// (SpotX-Official/SpotX issue #902, seen on Spotify 1.3.4.x / Windows).
//
// Root cause: when the client restores the saved miniplayer window size, it
// feeds the previously saved *outer* window size (on scaled displays possibly
// physical pixels) back into documentPictureInPicture.requestWindow(), which
// expects a *content* size in CSS pixels. Every reopen therefore adds the
// window chrome / DPI scale again, so the miniplayer keeps growing until it
// fills the screen.
//
// This helper wraps documentPictureInPicture.requestWindow() and always
// reopens the miniplayer with the last real content size reported by the PiP
// window itself (tracked via its resize events), capped to the visible
// screen. Sizes are kept per aspect mode (square = audio, wide = video) and
// persisted in localStorage so they survive restarts. No minified xpui code
// is touched, and if Spotify sizes the window correctly the stored values
// simply match what Spotify would have requested.
(function () {
    'use strict';

    if (!('documentPictureInPicture' in window)) return;

    var pip = window.documentPictureInPicture;
    if (!pip || typeof pip.requestWindow !== 'function') return;
    if (pip.__spotxMiniplayerSizeFix) return; // already installed
    pip.__spotxMiniplayerSizeFix = true;

    var STORE_KEY = 'spotx:miniplayerFix:size:v1';
    var SCREEN_MARGIN = 0.9; // never open bigger than 90% of the available screen

    function loadSizes() {
        try {
            var raw = localStorage.getItem(STORE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveSizes(sizes) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(sizes));
        } catch (e) {
            // storage full or blocked: the fix still works for this session
        }
    }

    // audio miniplayer is ~300x300, video is ~425x300; keep one size per mode
    function bucketOf(width, height) {
        if (!width || !height) return 'default';
        return width / height > 1.25 ? 'wide' : 'square';
    }

    function clampToScreen(value, avail) {
        var max = Math.floor(avail * SCREEN_MARGIN);
        return Math.max(1, Math.min(value, max));
    }

    function rememberWindow(win, bucket) {
        if (!win) return;
        var save = function () {
            if (win.closed) return;
            var w = win.innerWidth;
            var h = win.innerHeight;
            if (!w || !h) return;
            var sizes = loadSizes();
            sizes[bucket || bucketOf(w, h)] = { width: w, height: h };
            saveSizes(sizes);
        };
        // baseline right after open, then follow user resizes (debounced)
        save();
        var timer = null;
        win.addEventListener('resize', function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(save, 250);
        });
    }

    var originalRequestWindow = pip.requestWindow.bind(pip);

    pip.requestWindow = function (options) {
        options = options || {};

        var bucket = bucketOf(options.width, options.height);
        var sizes = loadSizes();
        var saved = sizes[bucket] || sizes.default;

        if (saved && saved.width && saved.height) {
            options.width = saved.width;
            options.height = saved.height;
        }
        if (options.width && options.height) {
            options.width = clampToScreen(options.width, screen.availWidth || options.width);
            options.height = clampToScreen(options.height, screen.availHeight || options.height);
        }

        return Promise.resolve(originalRequestWindow(options)).then(function (win) {
            rememberWindow(win, bucket);
            return win;
        });
    };
})();
