function resizeApp() {
    const hud = document.getElementById('hud');
    if (!hud) return; // Can't do anything without the HUD

    if (!window.cells) {
        hud.textContent = 'ERROR: cells map not found';
        return;
    }

    const centerCell = cells.get('0,0');

    if (centerCell && centerCell.gfx) {
        hud.textContent = 'SUCCESS: Center cell GFX found.';
        // I'll try to tint it again, just in case.
        centerCell.gfx.tint = 0x00FF00;
    } else if (centerCell) {
        hud.textContent = 'ERROR: Center cell found, but GFX is missing.';
    } else {
        hud.textContent = 'ERROR: Center cell not found in map.';
    }

    // Also resize the renderer
    if (window.app) {
        app.renderer.resize(window.innerWidth, window.innerHeight);
    }
}
