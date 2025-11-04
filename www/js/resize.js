function resizeApp() {
    // Update board viewport size and position
    if (window.updateBoardViewport) {
        window.updateBoardViewport();
    }
    
    // Update tray apps size - account for tablet scaling and extra space for Queen pieces
    let trayHeight = window.innerHeight + 160; // Add extra height for top and bottom padding
    
    // Check if we're on tablet (769px-1200px width)
    if (window.innerWidth >= 769 && window.innerWidth <= 1200) {
        // For tablets, increase canvas height to account for 0.6 CSS scaling
        // This prevents clipping of queen pieces that extend above the tray
        trayHeight = (window.innerHeight + 160) / 0.6;
    }
    
    if (window.whiteTrayApp) {
        window.whiteTrayApp.renderer.resize(220, trayHeight);
    }
    if (window.blackTrayApp) {
        window.blackTrayApp.renderer.resize(220, trayHeight);
    }
    
    // Don't re-layout trays on resize to avoid clearing placed pieces
    // Tray layout is fixed and doesn't need to change with window size
}
