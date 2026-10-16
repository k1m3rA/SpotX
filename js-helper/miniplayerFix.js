// SpotX helper: guard for the PiP miniplayer growing every time it is opened
// (SpotX-Official/SpotX issue #902, Spotify 1.3.4.x / Windows).
//
// Root cause (desktop 1.3.4.x): the miniplayer window is always opened with a
// FIXED size (300x300 audio / 425x300 video), so opening it is not what makes
// it grow. The growth comes from Spotify's own geometry restore: when the
// "enablePiPMiniPlayerPositionRestore" experiment is on, the client restores
// the saved window geometry right after opening with
// pipWindow.resizeTo(savedWidth, savedHeight), but the saved values are the
// window's OUTER size (outerWidth/outerHeight stored on pagehide) while CEF
// applies resizeTo() to a different size basis, so every close/reopen cycle
// re-saves a larger size and the window keeps growing.
//
// The main fix is done by the installer: with -miniplayer_fix, SpotX adds
// enablePiPMiniPlayerPositionRestore to the disabled experiments, so the
// broken restore code never runs (the miniplayer simply opens at its default
// size and position instead of remembering them).
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
