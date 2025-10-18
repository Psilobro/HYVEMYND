
// --- UTILS ---
function axialToPixel(q,r){
    return {
        x: CELL_RADIUS * 1.5 * q,
        y: CELL_RADIUS * Math.sqrt(3) * (r + q/2)
    };
}
function drawHex(g, radius){
    const a = Math.PI/3;
    g.moveTo(radius,0);
    for(let i=1;i<=6;i++){
        g.lineTo(radius*Math.cos(a*i), radius*Math.sin(a*i));
    }
}

// --- BOARD GRID ---
const cells = new Map(); // "q,r" → { gfx,q,r,stack:[] }
window.cells = cells; // Make cells globally accessible
window.createBoard = function(boardLayer, app) {
    for(let q=-GRID_RADIUS; q<=GRID_RADIUS; q++){
        for(let r=-GRID_RADIUS; r<=GRID_RADIUS; r++){
            if(Math.abs(q+r)>GRID_RADIUS) continue;
            const c = new PIXI.Graphics()
                .lineStyle(2, THEME.boardLine)
                .beginFill(THEME.boardFill);
            drawHex(c, CELL_RADIUS);
            c.endFill();
            const p = axialToPixel(q,r);
            c.position.set(p.x,p.y);
            c.interactive = true;
            c.buttonMode  = true;
            boardLayer.addChild(c);
            cells.set(`${q},${r}`, { gfx:c, q, r, stack:[] }); // Store the main graphic for tinting
            c.on('pointerdown', ()=>{
                if(state.gameOver || animating || !selected) return;
                const key = `${q},${r}`;
                if(!legalZones.has(key)) return;
                if(selected.mode==='place') commitPlacement(q,r);
                else                     commitMove(q,r);
            });
        }
    }
    
    // Store reference for expansion
    window.boardLayer = boardLayer;
    
    // Create board perimeter glow on the fixed glow layer
    if(window.glowLayer) {
        createBoardPerimeterGlow(window.glowLayer);
    }
}

// Function to create a glowing outline around the board perimeter
window.createBoardPerimeterGlow = function(boardLayer) {
    // Remove existing glow if it exists
    if (window.boardGlow) {
        boardLayer.removeChild(window.boardGlow);
    }
    
    // Find all perimeter cells (cells at the outer edge)
    const perimeterCells = [];
    for(let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
        for(let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
            if(Math.abs(q + r) > GRID_RADIUS) continue;
            
            // Check if this cell is on the perimeter
            if(Math.abs(q) === GRID_RADIUS || Math.abs(r) === GRID_RADIUS || Math.abs(q + r) === GRID_RADIUS) {
                perimeterCells.push({q, r});
            }
        }
    }
    
    // Don't create visible glow graphics anymore - just use for mask calculation
    // Create empty container to maintain compatibility
    const glowContainer = new PIXI.Container();
    boardLayer.addChildAt(glowContainer, 0);
    window.boardGlow = glowContainer;
    
    // Create mask for board clipping using the glow boundary
    createBoardMask(perimeterCells);
}

// Function to create a mask that clips board content to the glow boundary
window.createBoardMask = function(perimeterCells) {
    // Remove existing mask if it exists
    if (window.boardMask) {
        if (window.boardMask.parent) {
            window.boardMask.parent.removeChild(window.boardMask);
        }
        window.boardMask.destroy();
    }
    
    // Create a mask that covers all board cells plus the glow area
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff); // Color doesn't matter for masks
    
    // Create a mask by drawing all board cells (not just perimeter) with glow padding
    for(let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
        for(let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
            if(Math.abs(q + r) > GRID_RADIUS) continue;
            
            const pos = axialToPixel(q, r);
            
            // For perimeter cells, use larger radius to include glow
            // For inner cells, use normal radius
            const isPerimeter = Math.abs(q) === GRID_RADIUS || Math.abs(r) === GRID_RADIUS || Math.abs(q + r) === GRID_RADIUS;
            const maskRadius = isPerimeter ? CELL_RADIUS + 24 : CELL_RADIUS + 12; // Extra padding for smooth edge
            
            // Draw hexagon for this cell
            mask.moveTo(pos.x + maskRadius, pos.y);
            for(let i = 1; i <= 6; i++) {
                const angle = Math.PI/3 * i;
                mask.lineTo(pos.x + maskRadius * Math.cos(angle), pos.y + maskRadius * Math.sin(angle));
            }
        }
    }
    
    mask.endFill();
    
    // Store the mask globally
    window.boardMask = mask;
    
    // Add mask to the main app stage (no transformations)
    if (window.app) {
        window.app.stage.addChild(mask);
    }
    
    // Apply mask to the layers that should be clipped
    if (window.boardLayer) {
        window.boardLayer.mask = mask;
    }
    if (window.pieceLayer) {
        window.pieceLayer.mask = mask;
    }
}
