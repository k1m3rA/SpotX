// SpotX helper: guard for the PiP miniplayer growing every time it is opened
// (SpotX-Official/SpotX issue #902, Spotify 1.3.4.x / Windows).
//
// Observed on 1.3.4.258/Windows: the miniplayer window opens at a FIXED size
// (300x300 audio / 425x300 video) and then grows on every close/reopen cycle
// when the "enablePiPMiniPlayerPositionRestore" experiment is DISABLED (the
// stock default). With the experiment ENABLED, the client restores the saved
// window geometry right after opening via pipWindow.resizeTo() and the window
// keeps its size. The installer part of the fix (-miniplayer_fix) therefore
// keeps that experiment force-enabled through EnableExp; moving it to the
// disabled experiments is what makes the miniplayer grow.
//
// This helper is only the safety net: it wraps the PiP window's resizeTo()
// and clamps any requested size to 90% of the screen, so even if the
// experiment cannot be disabled on some future version, the window can never
// take over the screen. Normal miniplayer sizes (300-500px) never hit the
// cap, and manual resizing with the mouse is not affected at all.
(function () {
    'use strict';

    if (!('documentPictureInPicture' in window)) return;

    var pip = window.documentPictureInPicture;
    if (!pip || typeof pip.addEventListener !== 'function') return;
    if (pip.__spotxMiniplayerGrowthGuard) return; // already installed
    pip.__spotxMiniplayerGrowthGuard = true;

    var SCREEN_MARGIN = 0.9; // never let a scripted resize exceed 90% of the screen

    function cap(value, avail) {
        if (typeof value !== 'number' || !isFinite(value) || value <= 0) return value;
        var max = Math.floor(avail * SCREEN_MARGIN);
        return Math.min(value, max);
    }

    pip.addEventListener('enter', function (event) {
        var win = event.window;
        if (!win || win.__spotxResizeGuard) return;
        try {
            var originalResizeTo = win.resizeTo.bind(win);
            win.resizeTo = function (width, height) {
                return originalResizeTo(
                    cap(width, window.screen.availWidth || width),
                    cap(height, window.screen.availHeight || height)
                );
            };
            win.__spotxResizeGuard = true;
        } catch (e) {
            // window object not extensible: the experiment fix still applies
        }
    });
})();
