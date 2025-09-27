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
// Global mobile/tablet detection function
function isMobileDevice() {
    return window.innerWidth <= 900 && window.innerHeight <= 350;
}

function isTabletDevice() {
    return window.innerWidth <= 1200 && window.innerWidth >= 769;
}

const traySlots = []; // Array to hold the background slot graphics

function createTraySlot(color, key, i, pieceLayer, x, y) {
    const slotContainer = new PIXI.Container();
    
    // Define insect-specific colors
    const insectColors = {
        'Q': 0xFFD700, // Gold for Queen
        'A': 0x4169E1, // Royal Blue for Ants
        'G': 0x32CD32, // Lime Green for Grasshoppers
        'B': 0x8A2BE2, // Blue Violet for Beetles
        'S': 0x8B4513  // Saddle Brown for Spiders
    };
    
    // Create a recessed/inset hex shape for the slot
    const slotGraphics = new PIXI.Graphics();
    
    // Use insect-specific color with transparency
    const slotColor = insectColors[key] || 0x1a1a1a; // Default to dark gray if key not found
    slotGraphics.beginFill(slotColor, 0.4); // Semi-transparent insect color
    drawRoundedTile(slotGraphics, CELL_RADIUS - 2);
    slotGraphics.endFill();
    
    // Inner border to make it look recessed, tinted with insect color
    const innerBorder = new PIXI.Graphics()
        .lineStyle(2, slotColor, 0.8, 0.5); // Use insect color for border
    drawRoundedTile(innerBorder, CELL_RADIUS - 4);
    slotContainer.addChild(slotGraphics);
    slotContainer.addChild(innerBorder);
    
    // Position the slot
    slotContainer.position.set(x, y);
    slotContainer.meta = { color, key, i, type: 'slot' };
    
    pieceLayer.addChild(slotContainer);
    traySlots.push(slotContainer);
    
    return slotContainer;
}

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
}

// New function to layout trays in separate containers
window.layoutTrays = function() {
    console.log('layoutTrays called, mobile detection:', isMobileDevice());
    if (!window.whiteTrayApp || !window.blackTrayApp) {
        console.warn('Tray apps not initialized yet');
        return;
    }

    // Device detection for responsive scaling
    const isMobile = isMobileDevice();
    const isTablet = isTabletDevice();
    
    const pieceSize = CELL_RADIUS * 2;
    let trayPieceScale;
    if (isMobile) {
        trayPieceScale = 0.6; // Smallest for mobile
    } else if (isTablet) {
        trayPieceScale = 1.1; // Slightly larger for tablet but will be CSS scaled to 0.6
    } else {
        trayPieceScale = 1.3; // Desktop size
    }
    const scaledPieceSize = pieceSize * trayPieceScale;
    let pieceSpacing, typeGap, colGap, queenOffset;
    if (isMobile) {
        pieceSpacing = scaledPieceSize * 0.9;
        typeGap = scaledPieceSize * 0.5;
        colGap = scaledPieceSize * 0.2;
        queenOffset = scaledPieceSize * 0.8;
    } else if (isTablet) {
        pieceSpacing = scaledPieceSize * 0.8;
        typeGap = scaledPieceSize * 0.5;
        colGap = scaledPieceSize * 0.4;
        queenOffset = scaledPieceSize * 1.0; // Even spacing with other pieces
    } else {
        pieceSpacing = scaledPieceSize * 0.8;
        typeGap = scaledPieceSize * 0.5;
        colGap = scaledPieceSize * 0.4;
        queenOffset = scaledPieceSize * 1.4;
    }

    // Clear existing graphics before redrawing

    // Clear existing pieces from tray apps (but preserve slots)
    // Remove all children to start fresh for now
    window.whiteTrayApp.stage.removeChildren();
    window.blackTrayApp.stage.removeChildren();

    // Tray dimensions - updated for larger tray size
    const trayHeight = window.whiteTrayApp.renderer.height;
    const trayWidth = 220; // Updated to match CSS and main.js
    
    // Start position (adjusted for mobile - move pieces down by one piece length, then up by half)
    const startY = isMobile ? 60 + scaledPieceSize - (scaledPieceSize * 0.5) : (trayHeight - (pieceSpacing * 4 + typeGap)) / 2;

    // Column positions for each tray - balanced spacing for larger pieces
    const leftColumnX = 50; // Increased margin to prevent clipping of scaled pieces
    const rightColumnX = 150; // Adjusted to maintain good spacing
    let queenCenterX;
    if (isMobile) {
        queenCenterX = (trayWidth / 2) - 10; // Slightly left for mobile
    } else if (isTablet) {
        queenCenterX = (trayWidth / 2) - 5; // Slightly adjust for tablet to look centered
    } else {
        queenCenterX = trayWidth / 2; // Centered for desktop
    }
    
    const whitePositions = {
        // Column 1: Ants and Spiders (left side)
        'A1': { x: leftColumnX, y: startY },
        'A2': { x: leftColumnX, y: startY + pieceSpacing },
        'A3': { x: leftColumnX, y: startY + pieceSpacing * 2 },
        'S1': { x: leftColumnX, y: startY + pieceSpacing * 3 + typeGap },
        'S2': { x: leftColumnX, y: startY + pieceSpacing * 4 + typeGap },
        
        // Queen perfectly centered above both columns
        'Q1': { x: queenCenterX, y: startY - queenOffset },
        
        // Column 2: Grasshoppers and Beetles (right side)
        'G1': { x: rightColumnX, y: startY },
        'G2': { x: rightColumnX, y: startY + pieceSpacing },
        'G3': { x: rightColumnX, y: startY + pieceSpacing * 2 },
        'B1': { x: rightColumnX, y: startY + pieceSpacing * 3 + typeGap },
        'B2': { x: rightColumnX, y: startY + pieceSpacing * 4 + typeGap }
    };

    const blackPositions = { ...whitePositions }; // Same layout for black

    // Create slots and position pieces for white tray
    Object.keys(whitePositions).forEach(pieceKey => {
        const [key, i] = [pieceKey[0], pieceKey[1]];
        const position = whitePositions[pieceKey];
        
        // Create slot
        createTraySlotInApp(window.whiteTrayApp, 'white', key, i, position.x, position.y);
        
        // Find and position piece
        const piece = tray.find(p => p.meta.color === 'white' && p.meta.key === key && p.meta.i == i);
        if (piece && !piece.meta.placed) {
            // Remove from main app and add to tray app
            if (piece.parent) {
                piece.parent.removeChild(piece);
            }
            
            // Clear any mask that might have been applied from the main app
            piece.mask = null;
            
            // Scale the piece to be larger in the tray
            piece.scale.set(trayPieceScale);
            
            window.whiteTrayApp.stage.addChild(piece);
            piece.position.set(position.x, position.y);
        }
    });

    // Create slots and position pieces for black tray
    Object.keys(blackPositions).forEach(pieceKey => {
        const [key, i] = [pieceKey[0], pieceKey[1]];
        const position = blackPositions[pieceKey];
        
        // Create slot
        createTraySlotInApp(window.blackTrayApp, 'black', key, i, position.x, position.y);
        
        // Find and position piece
        const piece = tray.find(p => p.meta.color === 'black' && p.meta.key === key && p.meta.i == i);
        if (piece && !piece.meta.placed) {
            // Remove from main app and add to tray app
            if (piece.parent) {
                piece.parent.removeChild(piece);
            }
            
            // Clear any mask that might have been applied from the main app
            piece.mask = null;
            
            // Scale the piece to be larger in the tray
            piece.scale.set(trayPieceScale);
            
            window.blackTrayApp.stage.addChild(piece);
            piece.position.set(position.x, position.y);
        }
    });
}

// Helper function to create slots in tray apps
function createTraySlotInApp(app, color, key, i, x, y) {
    const slotContainer = new PIXI.Container();
    
    // Define insect-specific colors
    const slotColors = {
        'Q': 0xFFD700, // Gold for queen
        'A': 0x4169E1, // Blue for ants  
        'G': 0x32CD32, // Green for grasshoppers
        'B': 0x9932CC, // Purple for beetles
        'S': 0x8B4513  // Brown for spiders
    };
    
    const bg = new PIXI.Graphics();
    bg.beginFill(slotColors[key], 0.3);
    // Scale the slot to be just slightly larger than the pieces (responsive sizing)
    const isMobile = isMobileDevice();
    const mobilePieceScale = 0.6; // Match the mobile piece scale from layoutTrays
    const slotScale = isMobile ? mobilePieceScale + 0.1 : 1.3; // Just slightly larger than pieces
    drawRoundedTile(bg, CELL_RADIUS * slotScale);
    bg.endFill();
    
    slotContainer.addChild(bg);
    slotContainer.position.set(x, y);
    
    app.stage.addChild(slotContainer);
}