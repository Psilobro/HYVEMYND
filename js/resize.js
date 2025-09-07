function resizeApp() {
    // Update board viewport size and position
    if (window.updateBoardViewport) {
        window.updateBoardViewport();
    }
    
    // Update tray apps size
    if (window.whiteTrayApp) {
        window.whiteTrayApp.renderer.resize(220, window.innerHeight);
    }
    if (window.blackTrayApp) {
        window.blackTrayApp.renderer.resize(220, window.innerHeight);
    }
    
    // Don't re-layout trays on resize to avoid clearing placed pieces
    // Tray layout is fixed and doesn't need to change with window size
}
