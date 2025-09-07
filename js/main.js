let app, boardLayer, pieceLayer, glowLayer, whiteTrayApp, blackTrayApp;
window.addEventListener('load', () => {
    // --- MAIN BOARD PIXI SETUP ---
    const gameContainer = document.getElementById('game-container');
    const containerRect = gameContainer.getBoundingClientRect();
    
    app = new PIXI.Application({
        width: containerRect.width,
        height: containerRect.height,
        backgroundAlpha: 0,
        antialias: true
    });
    document.getElementById('app').appendChild(app.view);

    boardLayer = new PIXI.Container();
    pieceLayer = new PIXI.Container();
    glowLayer = new PIXI.Container(); // Fixed layer for board perimeter glow
    app.stage.addChild(boardLayer, pieceLayer, glowLayer); // Glow on top

    window.app = app;
    window.boardLayer = boardLayer;
    window.pieceLayer = pieceLayer;
    window.glowLayer = glowLayer;

    // --- TRAY PIXI APPS ---
    whiteTrayApp = new PIXI.Application({
        width: 220,
        height: window.innerHeight,
        backgroundAlpha: 0,
        antialias: true
    });
    document.getElementById('white-tray').appendChild(whiteTrayApp.view);

    blackTrayApp = new PIXI.Application({
        width: 220,
        height: window.innerHeight,
        backgroundAlpha: 0,
        antialias: true
    });
    document.getElementById('black-tray').appendChild(blackTrayApp.view);

    window.whiteTrayApp = whiteTrayApp;
    window.blackTrayApp = blackTrayApp;

    const winBanner = new PIXI.Text('', {
        fontSize: 64,
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 7,
        align: 'center'
    });
    winBanner.anchor.set(0.5);
    winBanner.position.set(app.renderer.width / 2, app.renderer.height / 2);
    winBanner.visible = false;
    app.stage.addChild(winBanner);
    
    // Make winBanner globally accessible
    window.winBanner = winBanner;

    function updateTurnIndicator() {
        // Since we don't have a visible border anymore, we can indicate turn in the HUD
        // or we could add a subtle effect later if needed
        // For now, the turn is already shown in the HUD
    }

    const originalUpdateHUD = window.updateHUD;
    window.updateHUD = () => {
        originalUpdateHUD();
        updateTurnIndicator();
    };

    updateTurnIndicator();

    createBoard(boardLayer, app);
    createPieces(pieceLayer, app);
    
    // Setup initial board viewport size and position
    updateBoardViewport();
    
    // Layout trays after a small delay to ensure apps are ready
    setTimeout(() => {
        layoutTrays();
    }, 100);
    
    updateHUD();

    // Initialize zoom system
    setupZoomControls(app);
    
    // Force board visibility by triggering a minimal zoom operation
    setTimeout(() => {
        if (window.zoomAt && app) {
            const centerX = app.renderer.width / 2;
            const centerY = app.renderer.height / 2;
            // Trigger a zoom operation to force proper rendering
            window.zoomAt(centerX, centerY, 1.001); // Minimal zoom to trigger rendering
            // Then zoom back to normal
            setTimeout(() => {
                window.zoomAt(centerX, centerY, 1/1.001);
            }, 50);
        }
    }, 250);

    const music = document.getElementById('background-music');
    const playMusicButton = document.getElementById('play-music-button');
    const autoZoomToggle = document.getElementById('auto-zoom-toggle');

    // Handle window resize
    window.addEventListener('resize', resizeApp);

    // Auto-zoom toggle functionality
    autoZoomToggle.addEventListener('click', (e) => {
        AUTO_ZOOM_ENABLED = !AUTO_ZOOM_ENABLED;
        e.target.textContent = `Auto-Zoom: ${AUTO_ZOOM_ENABLED ? 'ON' : 'OFF'}`;
        if(AUTO_ZOOM_ENABLED) {
            autoZoomToFitPieces();
        }
    });

    // Autoplay music
    music.play().then(() => {
        playMusicButton.textContent = 'Pause Music';
    }).catch(error => {
        console.warn('Autoplay prevented:', error);
        playMusicButton.textContent = 'Play Music'; // Ensure button reflects non-playing state
    });

    playMusicButton.addEventListener('click', (e) => {
        if (music.paused) {
            music.play();
            e.target.textContent = 'Pause Music';
        } else {
            music.pause();
            e.target.textContent = 'Play Music';
        }
    });
});
