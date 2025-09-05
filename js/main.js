let app, boardLayer, pieceLayer;
window.addEventListener('load', () => {
    // --- PIXI SETUP ---
    app = new PIXI.Application({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0, // Make canvas transparent
        antialias: true
    });
    document.getElementById('app').appendChild(app.view);

    boardLayer = new PIXI.Container();
    pieceLayer = new PIXI.Container();
    app.stage.addChild(boardLayer, pieceLayer);

    window.app = app;
    window.boardLayer = boardLayer;
    window.pieceLayer = pieceLayer;

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
    const gameBorder = document.getElementById('game-border');
    if (state.current === 'white') {
        gameBorder.classList.add('white-turn');
        gameBorder.classList.remove('black-turn');
    } else {
        gameBorder.classList.add('black-turn');
        gameBorder.classList.remove('white-turn');
    }
}

    const originalUpdateHUD = window.updateHUD;
    window.updateHUD = () => {
        originalUpdateHUD();
        updateTurnIndicator();
    };

    updateTurnIndicator();

    createBoard(boardLayer, app); // Reverted to original call
    createPieces(pieceLayer, app);
    layoutTray(app);
    updateHUD();

    // Center the game board and pieces for browser view
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    boardLayer.position.set(screenWidth / 2, screenHeight / 2);
    pieceLayer.position.set(screenWidth / 2, screenHeight / 2);
    // Re-layout the trays to account for the new centered position
    layoutTray(app);
    resizeApp();

    const music = document.getElementById('background-music');
    const playMusicButton = document.getElementById('play-music-button');

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
