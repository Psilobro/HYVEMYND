// --- PIECE TRAY & CREATION ---

// Draws a hexagon with rounded corners for the game pieces.
function drawRoundedTile(g, radius) {
    const cornerRadius = 12; // Increased for a rounder, more worn look
    const points = [];
    const a = Math.PI / 3;

    // Generate the 6 vertices of the hexagon
    for (let i = 0; i < 6; i++) {
        points.push({
            x: radius * Math.cos(a * i),
            y: radius * Math.sin(a * i)
        });
    }

    const first = points[0];
    const last = points[points.length - 1];

    // Start at the midpoint of the last edge to ensure a clean path
    g.moveTo(
        (first.x + last.x) / 2,
        (first.y + last.y) / 2
    );

    // Draw arcs around each vertex to create the rounded corners
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        g.arcTo(p1.x, p1.y, p2.x, p2.y, cornerRadius);
    }

    g.closePath(); // Close the path to complete the shape
}


const PIECE_MAP = {
    'Q': 'queen',
    'A': 'ant',
    'G': 'grasshopper',
    'B': 'beetle',
    'S': 'spider'
};

const tray = [];
function makePiece(color, key, i, pieceLayer, app){
    const pieceContainer = new PIXI.Container();

    // Main tile surface
    const g = new PIXI.Graphics().beginFill(COLORS[color]);
    drawRoundedTile(g, CELL_RADIUS - 2);
    g.endFill();
    pieceContainer.addChild(g);

    // --- Add a uniform inset border to define the edge ---
    const borderColor = (color === 'white') ? 0xCCCCCC : 0x333333; // Lighter grey for black, darker for white
    const border = new PIXI.Graphics()
        .lineStyle(5.5, borderColor, 0.55, 0.5); // Using user's preferred thickness and alpha
    drawRoundedTile(border, CELL_RADIUS - 2);
    pieceContainer.addChild(border);

    // Apply image or text to the main surface
    const imageName = PIECE_MAP[key];
    if (imageName) {
        const imagePath = `assets/images/${imageName}_${color}.png`;
        const sprite = PIXI.Sprite.from(imagePath);
        sprite.anchor.set(0.5);
        sprite.width = CELL_RADIUS * 2;
        sprite.height = CELL_RADIUS * 2;

        const hexMask = new PIXI.Graphics();
        hexMask.beginFill(0xFFFFFF);
        drawRoundedTile(hexMask, CELL_RADIUS - 2);
        hexMask.endFill();
        g.addChild(hexMask);
        sprite.mask = hexMask;

        g.addChild(sprite);
    } else {
        const txt = new PIXI.Text(key, {
            fontSize:26,
            fill: color==='white'?0x000:0xFFF,
            fontWeight:'bold'
        });
        txt.anchor.set(0.5);
        g.addChild(txt);
    }

    pieceContainer.meta = {
        color, key, i,
        placed:false, q:null, r:null
    };
    pieceContainer.interactive=true;
    pieceContainer.buttonMode=true;
    pieceContainer.on('pointerdown', ()=>{
        if(state.gameOver || animating) return;
        if(!pieceContainer.meta.placed && pieceContainer.meta.color===state.current) selectPlacement(pieceContainer);
        else if(pieceContainer.meta.placed && pieceContainer.meta.color===state.current) selectMove(pieceContainer);
    });
    pieceLayer.addChild(pieceContainer);
    tray.push(pieceContainer);
}

function createPieces(pieceLayer, app) {
    SETUP.forEach(d=>{
        for(let i=1;i<=d.count;i++){
            makePiece('white', d.key, i, pieceLayer, app);
            makePiece('black', d.key, i, pieceLayer, app);
        }
    });
    console.log('Tray after creation:', tray);
}

window.layoutTray = function(app){
    const W = app.renderer.width, H = app.renderer.height;
    // Get the container's current position to calculate correct local coordinates
    const containerX = window.pieceLayer ? window.pieceLayer.position.x : 0;
    const containerY = window.pieceLayer ? window.pieceLayer.position.y : 0;

    const totalWhite = tray.filter(p => !p.meta.placed && p.meta.color === 'white').length;
    const totalBlack = tray.filter(p => !p.meta.placed && p.meta.color === 'black').length;
    const whiteSpacing = W / (totalWhite + 1);
    const blackSpacing = W / (totalBlack + 1);

    let w = 0, b = 0;
    tray.forEach(p => {
        if (p.meta.placed) return;

        if (p.meta.color === 'white') {
            w++;
            // The desired GLOBAL position is (whiteSpacing * w, H - 20 - CELL_RADIUS)
            // To get the LOCAL position, we subtract the container's offset
            p.position.set(
                (whiteSpacing * w) - containerX,
                (H - 20 - CELL_RADIUS) - containerY
            );
        } else {
            b++;
            // The desired GLOBAL position is (blackSpacing * b, 20 + CELL_RADIUS)
            // To get the LOCAL position, we subtract the container's offset
            p.position.set(
                (blackSpacing * b) - containerX,
                (20 + CELL_RADIUS) - containerY
            );
        }
    });
}