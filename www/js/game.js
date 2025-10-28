// --- HISTORY SNAPSHOTS ---
window.historySnapshots = [];

function snapshotBoardState() {
    // Deep copy of all placed pieces and their positions/stacks
    const pieces = tray.map(p => ({
        key: p.meta.key,
        color: p.meta.color,
        placed: p.meta.placed,
        q: p.meta.q,
        r: p.meta.r,
        stackIndex: (() => {
            if (!p.meta.placed) return null;
            const cell = window.cells.get(`${p.meta.q},${p.meta.r}`);
            if (!cell || !cell.stack) return null;
            return cell.stack.indexOf(p);
        })()
    }));
    // Also store move number and current player
    window.historySnapshots.push({
        pieces,
        moveNumber: state.moveNumber,
        current: state.current
    });
}
// --- CONFIG ---
window.CELL_RADIUS = 38;

window.GRID_RADIUS = 4;
window.MIN_GRID_RADIUS = 4; // Original size
window.AUTO_ZOOM_ENABLED = true; // Toggle for auto-zoom feature

// Zoom variables
let currentZoom = 1.0;
let minZoom = 1.0;
let maxZoom = 3.0;
let panX = 0;
let panY = 0;
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

// Export zoom variables to window for global access
window.currentZoom = currentZoom;
window.minZoom = minZoom;
window.maxZoom = maxZoom;
const DIRS = [
    {dq:1,dr:0},{dq:1,dr:-1},{dq:0,dr:-1},
    {dq:-1,dr:0},{dq:-1,dr:1},{dq:0,dr:1}
];
window.DIRS = DIRS;

function isNearBorder(q, r) {
    return Math.abs(q) > GRID_RADIUS || Math.abs(r) > GRID_RADIUS;
}

// --- DYNAMIC BOARD EXPANSION ---
function isAtPerimeter(q, r) {
    // Check if a piece is at the current outer ring
    return Math.abs(q) === GRID_RADIUS || Math.abs(r) === GRID_RADIUS || Math.abs(q + r) === GRID_RADIUS;
}

// Function to update board positioning to fit in available space
window.updateBoardViewport = function() {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer || !window.app) return;
    
    // Get the container size
    const containerRect = gameContainer.getBoundingClientRect();
    
    // Resize the PIXI app to fill the container
    window.app.renderer.resize(containerRect.width, containerRect.height);
    
    // Calculate the outer bounds including the glow (this defines our viewport)
    const cellRadius = window.CELL_RADIUS;
    const glowExtent = cellRadius + 24; // Glow extends 24px beyond cell edge (3 layers * 8px)
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    // Find perimeter cells to calculate glow bounds
    for(let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
        for(let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
            if(Math.abs(q + r) > GRID_RADIUS) continue;
            
            // Only check perimeter cells
            if(Math.abs(q) === GRID_RADIUS || Math.abs(r) === GRID_RADIUS || Math.abs(q + r) === GRID_RADIUS) {
                const pos = axialToPixel(q, r);
                // Include glow extent in bounds
                minX = Math.min(minX, pos.x - glowExtent);
                maxX = Math.max(maxX, pos.x + glowExtent);
                minY = Math.min(minY, pos.y - glowExtent);
                maxY = Math.max(maxY, pos.y + glowExtent);
            }
        }
    }
    
    const glowWidth = maxX - minX;
    const glowHeight = maxY - minY;
    
    // Calculate scale so glow perimeter exactly fills the container (this is 100% zoom)
    const scaleX = containerRect.width / glowWidth;
    const scaleY = containerRect.height / glowHeight;
    const baseScale = Math.min(scaleX, scaleY);
    
    // Ensure baseScale is never too small (minimum 0.1) and log for debugging
    const safeBaseScale = Math.max(0.8, baseScale);
    console.log(`Board scale calculation: container=${containerRect.width}x${containerRect.height}, glow=${glowWidth}x${glowHeight}, baseScale=${baseScale}, safeBaseScale=${safeBaseScale}`);
    
    // Store the glow bounds and base scale globally
    window.glowBounds = { minX, maxX, minY, maxY, width: glowWidth, height: glowHeight };
    window.baseScale = safeBaseScale;
    
    // Position the board layers so the glow perimeter touches container edges
    if (window.boardLayer && window.pieceLayer) {
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        
        // Calculate offset to center the board within the glow bounds
        const boardCenterX = (minX + maxX) / 2;
        const boardCenterY = (minY + maxY) / 2;
        
        // Ensure board is always visible with minimum scale
        const minVisibleScale = 0.7;
        const finalScale = Math.max(minVisibleScale, safeBaseScale);
        
        // Reset zoom and position to 100%
        window.currentZoom = 1.0;
        panX = 0;
        panY = 0;
        
        // Position glow layer at fixed base scale and position
        if (window.glowLayer) {
            window.glowLayer.scale.set(finalScale);
            window.glowLayer.position.set(centerX - boardCenterX * finalScale, centerY - boardCenterY * finalScale);
        }
        
        // Apply positioning for board and piece layers with forced minimum scale
        window.boardLayer.scale.set(finalScale);
        window.pieceLayer.scale.set(finalScale);
        window.boardLayer.position.set(centerX - boardCenterX * finalScale, centerY - boardCenterY * finalScale);
        window.pieceLayer.position.set(centerX - boardCenterX * finalScale, centerY - boardCenterY * finalScale);
        
        // Update stored base scale to match what we actually applied
        window.baseScale = finalScale;
    }
    
    // Set zoom constraints - can only zoom in from glow boundary
    window.minZoom = .5; // 100% = glow touches container edges
    window.maxZoom = 6.0;
}

// --- ZOOM SYSTEM ---
function updateZoomConstraints() {
    // Minimum zoom is 1.0 (100% - board fits perfectly in container)
    window.minZoom = .5;
    window.maxZoom = 3.0; // Can zoom in up to 300%
    
    // Ensure current zoom is valid
    window.currentZoom = Math.max(window.minZoom, Math.min(window.maxZoom, window.currentZoom));
    
    console.log(`Zoom constraints: min=100%, max=300%, current=${(window.currentZoom * 100).toFixed(0)}%`);
}

function expandBoard() {
    const oldRadius = GRID_RADIUS;
    GRID_RADIUS++;
    console.log(`Expanding board from radius ${oldRadius} to ${GRID_RADIUS}`);
    
    // Add new cells in the expanded ring
    for(let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
        for(let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
            if(Math.abs(q + r) > GRID_RADIUS) continue;
            
            const key = `${q},${r}`;
            if(window.cells.has(key)) continue; // Skip existing cells
            
            // Create new cell
            const c = new PIXI.Graphics()
                .lineStyle(2, THEME.boardLine)
                .beginFill(THEME.boardFill);
            drawHex(c, CELL_RADIUS);
            c.endFill();
            const p = axialToPixel(q, r);
            c.position.set(p.x, p.y);
            c.interactive = true;
            c.buttonMode = true;
            
            // Add click handler
            c.on('pointerdown', () => {
                if(state.gameOver || animating || !selected) return;
                const cellKey = `${q},${r}`;
                if(!legalZones.has(cellKey)) return;
                if(selected.mode === 'place') commitPlacement(q, r);
                else commitMove(q, r);
            });
            
            window.boardLayer.addChild(c);
            window.cells.set(key, { gfx: c, q, r, stack: [] });
        }
    }
    
    // Update board perimeter glow for new size
    if (window.createBoardPerimeterGlow && window.glowLayer) {
        createBoardPerimeterGlow(window.glowLayer);
        
        // Apply current transform to the new mask immediately
        if (window.boardMask && window.baseScale && window.glowBounds) {
            const centerX = app.renderer.width / 2;
            const centerY = app.renderer.height / 2;
            const boardCenterX = (window.glowBounds.minX + window.glowBounds.maxX) / 2;
            const boardCenterY = (window.glowBounds.minY + window.glowBounds.maxY) / 2;
            const baseX = centerX - boardCenterX * window.baseScale;
            const baseY = centerY - boardCenterY * window.baseScale;
            
            window.boardMask.scale.set(window.baseScale);
            window.boardMask.position.set(baseX, baseY);
        }
    }
    
    // Update viewport to match new board size
    updateBoardViewport();
    
    // Auto-zoom to fit all pieces if enabled
    if(AUTO_ZOOM_ENABLED) {
        autoZoomToFitPieces();
    }
}

function checkForBoardExpansion() {
    // Check if any placed piece is at the perimeter
    const placedPieces = tray.filter(p => p.meta.placed);
    for(const piece of placedPieces) {
        if(isAtPerimeter(piece.meta.q, piece.meta.r)) {
            expandBoard();
            break;
        }
    }
}

// --- ZOOM SYSTEM ---
// Zoom variables are declared at the top of the file

function setupZoomControls(app) {
    console.log('Setting up zoom controls...');
    
    // Mouse wheel zoom
    app.view.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = app.view.getBoundingClientRect();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        // Convert screen coordinates to app coordinates
        const appX = e.clientX - rect.left;
        const appY = e.clientY - rect.top;
        zoomAt(appX, appY, zoomFactor);
    });
    
    // Ensure the canvas can receive touch events
    app.view.style.touchAction = 'none'; // Override CSS to allow full gesture control
    
    // Touch pinch zoom - improved approach for mobile/tablet
    let touches = new Map();
    let initialDistance = 0;
    let isZooming = false;
    
    // Test function for desktop - call from console: testPinchZoom()
    window.testPinchZoom = function() {
        console.log('Testing pinch zoom...');
        const rect = app.view.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        console.log('Calling zoomAt with:', centerX, centerY, 1.2);
        zoomAt(centerX, centerY, 1.2);
    };
    
    // Use modern touch events for better mobile support
    console.log('Setting up touch events on canvas element');
    
    // Always use touch events for mobile compatibility
    let lastTouchDistance = 0;
    let touchStartTime = 0;
    
    app.view.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        console.log('Touch start - touches:', e.touches.length);
        
        if (e.touches.length === 2) {
            // Two finger pinch detected
            e.preventDefault();
            isZooming = true;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            console.log('Pinch start - initial distance:', lastTouchDistance);
        } else if (e.touches.length === 1) {
            // Single finger drag
            if (!isZooming) {
                isDragging = true;
                lastPointerX = e.touches[0].clientX;
                lastPointerY = e.touches[0].clientY;
            }
        }
    }, { passive: false });
    
    app.view.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && isZooming) {
            // Two finger pinch zoom
            e.preventDefault();
            console.log('Pinch move detected');
            
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            if (lastTouchDistance > 0 && Math.abs(currentDistance - lastTouchDistance) > 10) {
                const zoomFactor = currentDistance / lastTouchDistance;
                console.log('Applying zoom factor:', zoomFactor, 'distances:', lastTouchDistance, '->', currentDistance);
                
                const rect = app.view.getBoundingClientRect();
                const centerX = ((touch1.clientX + touch2.clientX) / 2) - rect.left;
                const centerY = ((touch1.clientY + touch2.clientY) / 2) - rect.top;
                
                zoomAt(centerX, centerY, zoomFactor);
                lastTouchDistance = currentDistance;
            }
        } else if (e.touches.length === 1 && isDragging && !isZooming) {
            // Single finger pan
            e.preventDefault();
            const deltaX = e.touches[0].clientX - lastPointerX;
            const deltaY = e.touches[0].clientY - lastPointerY;
            pan(deltaX, deltaY);
            lastPointerX = e.touches[0].clientX;
            lastPointerY = e.touches[0].clientY;
        }
    }, { passive: false });
    
    app.view.addEventListener('touchend', (e) => {
        console.log('Touch end - remaining touches:', e.touches.length);
        
        if (e.touches.length < 2) {
            isZooming = false;
            lastTouchDistance = 0;
        }
        if (e.touches.length === 0) {
            isDragging = false;
            
            // Check for quick tap (potential piece selection)
            const touchDuration = Date.now() - touchStartTime;
            if (touchDuration < 200) {
                console.log('Quick tap detected');
            }
        }
    }, { passive: false });
    
    app.view.addEventListener('touchcancel', (e) => {
        console.log('Touch cancelled');
        isZooming = false;
        isDragging = false;
        lastTouchDistance = 0;
        touches.clear();
    }, { passive: false });
    
    console.log('Touch zoom controls setup complete');
    
    // Mouse drag for desktop
    app.view.addEventListener('mousedown', (e) => {
        if (!isZooming) {
            isDragging = true;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
        }
    });
    
    app.view.addEventListener('mousemove', (e) => {
        if (isDragging && !isZooming) {
            const deltaX = e.clientX - lastPointerX;
            const deltaY = e.clientY - lastPointerY;
            pan(deltaX, deltaY);
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
        }
    });
    
    app.view.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

function zoomAt(appX, appY, zoomFactor) {
    const newZoom = Math.max(window.minZoom, Math.min(window.maxZoom, window.currentZoom * zoomFactor));
    
    if(newZoom !== window.currentZoom && window.baseScale) {
        // Calculate zoom point in world coordinates
        const currentTotalScale = window.baseScale * window.currentZoom;
        const centerX = app.renderer.width / 2;
        const centerY = app.renderer.height / 2;
        
        // Get current board position
        const currentBoardX = window.boardLayer.position.x;
        const currentBoardY = window.boardLayer.position.y;
        
        // Convert mouse position to world coordinates
        const worldX = (appX - currentBoardX) / currentTotalScale;
        const worldY = (appY - currentBoardY) / currentTotalScale;
        
        // Update zoom
        window.currentZoom = newZoom;
        
        // Calculate new board position to keep zoom point fixed
        const newTotalScale = window.baseScale * window.currentZoom;
        const newBoardX = appX - worldX * newTotalScale;
        const newBoardY = appY - worldY * newTotalScale;
        
        // Calculate pan from the base position
        const baseX = centerX - ((window.glowBounds.minX + window.glowBounds.maxX) / 2) * window.baseScale;
        const baseY = centerY - ((window.glowBounds.minY + window.glowBounds.maxY) / 2) * window.baseScale;
        
        const zoomOffsetX = (centerX - baseX) * (window.currentZoom - 1);
        const zoomOffsetY = (centerY - baseY) * (window.currentZoom - 1);
        
        panX = newBoardX - baseX + zoomOffsetX;
        panY = newBoardY - baseY + zoomOffsetY;
        
        applyTransform();
    }
}

function pan(deltaX, deltaY) {
    panX += deltaX;
    panY += deltaY;
    applyTransform();
}

function applyTransform() {
    if(window.boardLayer && window.pieceLayer && window.baseScale && window.glowBounds) {
        const centerX = app.renderer.width / 2;
        const centerY = app.renderer.height / 2;
        const boardCenterX = (window.glowBounds.minX + window.glowBounds.maxX) / 2;
        const boardCenterY = (window.glowBounds.minY + window.glowBounds.maxY) / 2;
        
        const baseX = centerX - boardCenterX * window.baseScale;
        const baseY = centerY - boardCenterY * window.baseScale;
        
        // The glow layer stays fixed at base scale and position
        if(window.glowLayer) {
            window.glowLayer.scale.set(window.baseScale);
            window.glowLayer.position.set(baseX, baseY);
        }
        
        // Update mask to match glow layer position and scale
        if(window.boardMask) {
            window.boardMask.scale.set(window.baseScale);
            window.boardMask.position.set(baseX, baseY);
        }
        
        // Board and piece layers scale with zoom
        const totalScale = window.baseScale * window.currentZoom;
        window.boardLayer.scale.set(totalScale);
        window.pieceLayer.scale.set(totalScale);
        
        // Apply zoom scaling to position and add pan offset
        const zoomOffsetX = (centerX - baseX) * (window.currentZoom - 1);
        const zoomOffsetY = (centerY - baseY) * (window.currentZoom - 1);
        
        window.boardLayer.position.set(baseX - zoomOffsetX + panX, baseY - zoomOffsetY + panY);
        window.pieceLayer.position.set(baseX - zoomOffsetX + panX, baseY - zoomOffsetY + panY);
        
        // Limit pan to keep some part of the board visible
        limitPanToKeepBoardVisible();
    }
}

// Function to limit panning so board doesn't disappear completely
function limitPanToKeepBoardVisible() {
    if (!window.glowBounds || !window.baseScale) return;
    
    const totalScale = window.baseScale * window.currentZoom;
    const scaledWidth = window.glowBounds.width * totalScale;
    const scaledHeight = window.glowBounds.height * totalScale;
    
    const containerWidth = app.renderer.width;
    const containerHeight = app.renderer.height;
    
    // At 100% zoom, glow should touch edges (pan = 0)
    // At higher zoom, allow panning but keep some board visible
    const maxPanX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxPanY = Math.max(0, (scaledHeight - containerHeight) / 2);
    
    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
}

function autoZoomToFitPieces() {
    if(!AUTO_ZOOM_ENABLED) return;
    
    const placedPieces = tray.filter(p => p.meta.placed);
    if(placedPieces.length === 0) return;

    // Collect all axial coordinates of placed pieces
    const pieceCoords = placedPieces.map(p => ({q: p.meta.q, r: p.meta.r}));

    // Set to hold all cells to include in bounds (placed + adjacent empties)
    const boundCells = new Set();

    // Add all placed piece coordinates
    pieceCoords.forEach(({q, r}) => {
        boundCells.add(`${q},${r}`);
        // Add all adjacent cells
        DIRS.forEach(dir => {
            const nq = q + dir.dq;
            const nr = r + dir.dr;
            // Only add if not occupied by a placed piece
            if (!boundCells.has(`${nq},${nr}`) && !tray.some(p => p.meta.placed && p.meta.q === nq && p.meta.r === nr)) {
                boundCells.add(`${nq},${nr}`);
            }
        });
    });

    // Find bounds of all included cells
    let minQ = Infinity, maxQ = -Infinity;
    let minR = Infinity, maxR = -Infinity;
    boundCells.forEach(key => {
        const [q, r] = key.split(",").map(Number);
        minQ = Math.min(minQ, q);
        maxQ = Math.max(maxQ, q);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
    });

    // Convert to pixel bounds
    const topLeft = axialToPixel(minQ, minR);
    const bottomRight = axialToPixel(maxQ, maxR);

    // Add padding
    const padding = CELL_RADIUS * 3;
    const boundsWidth = bottomRight.x - topLeft.x + padding * 2;
    const boundsHeight = bottomRight.y - topLeft.y + padding * 2;

    // Calculate zoom to fit
    const scaleX = (app.renderer.width - 400) / boundsWidth; // Account for inventories
    const scaleY = app.renderer.height / boundsHeight;
    const targetZoom = Math.min(scaleX, scaleY, maxZoom);

    // Center on the bounds
    const centerX = (topLeft.x + bottomRight.x) / 2;
    const centerY = (topLeft.y + bottomRight.y) / 2;

    currentZoom = Math.max(minZoom, targetZoom);
    panX = -centerX * currentZoom;
    panY = -centerY * currentZoom;

    applyTransform();
}

const COLORS = { white:0xFFFFFF, black:0x000000 };
const THEME  = {
    boardFill: 0xC27B15,
    boardLine: 0x4B382A,
    boardShadowColor: 0xB0515,
    boardHighlightColor: 0xFFB3D,
    highlight: 0x8B3E20
};
window.THEME = THEME;

const SETUP = [
    {key:'Q',count:1},
    {key:'A',count:3},
    {key:'G',count:3},
    {key:'B',count:2},
    {key:'S',count:2}
];

// --- STATE ---
let state = {
    current:'white',
    moveNumber:1,
    queenPlaced:{white:false,black:false},
    gameOver: false
};
window.state = state; // Make state globally accessible
let selected = null;
let legalZones = new Set();
let animating = false;
let clickSfx;
try {
    clickSfx = new Audio('https://cdn.jsdelivr.net/gh/irustm/pings/ping1.mp3');
} catch (e) {
    console.warn('Could not load sound file.');
    clickSfx = { play: () => {} };
}

// --- PIECE-SPECIFIC ANIMATIONS ---
function animatePieceMovement(piece, fromQ, fromR, toQ, toR, occBefore, onComplete) {
    const pieceType = piece.meta.key;
    
    // Get the target position
    const cell = window.cells.get(`${toQ},${toR}`);
    const targetPos = axialToPixel(toQ, toR);
    const targetY = targetPos.y - (cell.stack.length - 1) * 6;
    
    // Play sound effect based on piece type
    if (window.playSound) {
        const soundMap = {
            'Q': 'queen-move',
            'S': 'spider-move', 
            'A': 'ant-move',
            'B': 'beetle-move',
            'G': 'grasshopper-move'
        };
        window.playSound(soundMap[pieceType] || 'placement');
    }
    
    switch (pieceType) {
        case 'Q':
            animateQueenWaggle(piece, targetPos.x, targetY, onComplete);
            break;
        case 'S':
            animateSpiderThreeSteps(piece, fromQ, fromR, toQ, toR, occBefore, onComplete);
            break;
        case 'A':
            animateAntDarting(piece, fromQ, fromR, toQ, toR, occBefore, onComplete);
            break;
        case 'B':
            animateBeetleClimbing(piece, fromQ, fromR, toQ, toR, onComplete);
            break;
        case 'G':
            animateGrasshopperJump(piece, fromQ, fromR, toQ, toR, onComplete);
            break;
        default:
            // Fallback to direct movement
            gsap.to(piece, {
                x: targetPos.x,
                y: targetY,
                duration: 0.5,
                onComplete: onComplete
            });
            break;
    }
}

function animateQueenWaggle(piece, targetX, targetY, onComplete) {
    const timeline = gsap.timeline({ onComplete: onComplete });
    
    timeline
        .to(piece, {
            rotation: 0.2,
            duration: 0.1,
            ease: "power2.out"
        })
        .to(piece, {
            rotation: -0.2,
            duration: 0.1,
            ease: "power2.inOut"
        })
        .to(piece, {
            x: targetX,
            y: targetY,
            rotation: 0,
            duration: 0.3,
            ease: "power2.inOut"
        });
}


function animateSpiderThreeSteps(piece, fromQ, fromR, toQ, toR, occBefore, onComplete) {
    console.log(`Spider 3-step animation: ${fromQ},${fromR} -> ${toQ},${toR}`);
    
    // Calculate the 3-step path by working backwards from destination
    const path = calculateSpiderPath(fromQ, fromR, toQ, toR, occBefore);
    
    if (!path || path.length !== 4) { // Should be [start, step1, step2, final]
        console.log('Could not calculate spider path, using direct animation');
        gsap.to(piece, {
            x: axialToPixel(toQ, toR).x,
            y: axialToPixel(toQ, toR).y - (window.cells.get(`${toQ},${toR}`).stack.length - 1) * 6,
            duration: 0.6,
            onComplete: onComplete
        });
        return;
    }
    
    console.log('Spider path:', path);
    const timeline = gsap.timeline({ onComplete: onComplete });
    
    // Animate through each step with pauses
    for (let i = 1; i < path.length; i++) {
        const [q, r] = path[i];
        const pos = axialToPixel(q, r);
        const isLastStep = i === path.length - 1;
        const cell = window.cells.get(`${q},${r}`);
        const yOffset = isLastStep ? -(cell.stack.length - 1) * 6 : 0;
        
        timeline
            .to(piece, {
                x: pos.x,
                y: pos.y + yOffset,
                duration: 0.25,  // Each step takes 0.25 seconds
                ease: "power2.inOut"
            })
            .to({}, { duration: isLastStep ? 0 : 0.15 }); // 0.15 second pause between steps
    }
}

function calculateSpiderPath(fromQ, fromR, toQ, toR, occBefore) {
    // Reconstruct the 3-step perimeter path the spider took to reach destination
    const occRem = new Set(occBefore);
    occRem.delete(`${fromQ},${fromR}`); // Remove spider from starting position
    
    // Find perimeter contact points from starting position
    const perimeterStartPoints = [];
    DIRS.forEach((d, dirIndex) => {
        const adjQ = fromQ + d.dq;
        const adjR = fromR + d.dr;
        const adjKey = `${adjQ},${adjR}`;
        if (occRem.has(adjKey)) {
            perimeterStartPoints.push(dirIndex);
        }
    });
    
    // Try following perimeter in both directions from each contact point
    for (const startDir of perimeterStartPoints) {
        for (const clockwise of [true, false]) {
            let currentQ = fromQ;
            let currentR = fromR;
            let lastContactDir = startDir;
            const path = [[currentQ, currentR]];
            let validPath = true;
            
            for (let step = 0; step < 3; step++) {
                let nextPos = null;
                
                // Find next position along perimeter
                for (let offset = 0; offset < 6; offset++) {
                    const searchDir = clockwise ? 
                        (lastContactDir + offset) % 6 : 
                        (lastContactDir - offset + 6) % 6;
                    
                    const testQ = currentQ + DIRS[searchDir].dq;
                    const testR = currentR + DIRS[searchDir].dr;
                    const testKey = `${testQ},${testR}`;
                    
                    if (!canSlide(currentQ, currentR, testQ, testR, occRem)) continue;
                    if (occRem.has(testKey)) continue;
                    
                    // Check if position maintains hive contact
                    let hasHiveContact = false;
                    let newContactDir = -1;
                    DIRS.forEach((checkDir, checkDirIndex) => {
                        const contactQ = testQ + checkDir.dq;
                        const contactR = testR + checkDir.dr;
                        const contactKey = `${contactQ},${contactR}`;
                        if (occRem.has(contactKey)) {
                            hasHiveContact = true;
                            newContactDir = checkDirIndex;
                        }
                    });
                    
                    if (hasHiveContact) {
                        nextPos = {q: testQ, r: testR};
                        lastContactDir = newContactDir;
                        break;
                    }
                }
                
                if (!nextPos) {
                    validPath = false;
                    break;
                }
                
                path.push([nextPos.q, nextPos.r]);
                currentQ = nextPos.q;
                currentR = nextPos.r;
            }
            
            // Check if this path reaches the target destination
            if (validPath && currentQ === toQ && currentR === toR) {
                return path;
            }
        }
    }
    
    return null; // No valid path found
}

function animateAntDarting(piece, fromQ, fromR, toQ, toR, occBefore, onComplete) {
    console.log(`Ant animation: ${fromQ},${fromR} -> ${toQ},${toR}`);
    
    // Calculate the distance to determine timing
    const distance = Math.abs(toQ - fromQ) + Math.abs(toR - fromR);
    const baseTime = 0.05;
    const totalTime = Math.max(0.4, baseTime * distance);
    
    console.log(`Ant distance: ${distance}, total time: ${totalTime}`);
    
    // Find path along perimeter using BFS with original board state
    const queue = [[fromQ, fromR, []]];
    const visited = new Set([`${fromQ},${fromR}`]);
    let path = null;
    
    // Use the original board state instead of building a new one
    const occupied = new Set(occBefore);
    // Remove the moving piece from the original state
    occupied.delete(`${fromQ},${fromR}`);
    
    while (queue.length && !path) {
        const [q, r, currentPath] = queue.shift();
        
        if (q === toQ && r === toR) {
            path = currentPath.concat([[q, r]]);
            break;
        }
        
        DIRS.forEach(d => {
            const nq = q + d.dq, nr = r + d.dr;
            const key = `${nq},${nr}`;
            
            if (!window.cells.has(key) || occupied.has(key) || visited.has(key)) return;
            if (!canSlide(q, r, nq, nr, occupied)) return;
            
            // Must touch the hive (be adjacent to an occupied cell)
            const touchesHive = DIRS.some(d2 => occupied.has(`${nq + d2.dq},${nr + d2.dr}`));
            if (!touchesHive) return;
            
            visited.add(key);
            queue.push([nq, nr, currentPath.concat([[q, r]])]);
        });
    }
    
    console.log('Ant path found:', path);
    
    if (!path || path.length <= 1) {
        // Fallback to direct movement
        console.log('No ant path found, using fallback animation');
        gsap.to(piece, {
            x: axialToPixel(toQ, toR).x,
            y: axialToPixel(toQ, toR).y - (window.cells.get(`${toQ},${toR}`).stack.length - 1) * 6,
            duration: totalTime,
            onComplete: onComplete
        });
        return;
    }
    
    console.log('Using ant darting animation');
    const timeline = gsap.timeline({ onComplete: onComplete });
    const timePerStep = totalTime / path.length;
    
    // Create twitchy movement along the path
    for (let i = 1; i < path.length; i++) {
        const [q, r] = path[i];
        const pos = axialToPixel(q, r);
        const isLastStep = i === path.length - 1;
        const cell = window.cells.get(`${q},${r}`);
        const yOffset = isLastStep ? -(cell.stack.length - 1) * 6 : 0;
        
        // Add slight random offset for twitchy effect (except final position)
        const offsetX = isLastStep ? 0 : (Math.random() - 0.5) * 3;
        const offsetY = isLastStep ? 0 : (Math.random() - 0.5) * 3;
        
        timeline.to(piece, {
            x: pos.x + offsetX,
            y: pos.y + yOffset + offsetY,
            duration: timePerStep,
            ease: "power1.inOut"
        });
        
        // Quick correction to exact position if not last step
        if (!isLastStep) {
            timeline.to(piece, {
                x: pos.x,
                y: pos.y + yOffset,
                duration: timePerStep * 0.3,
                ease: "power2.out"
            });
        }
    }
}

function animateBeetleClimbing(piece, fromQ, fromR, toQ, toR, onComplete) {
    const startPos = axialToPixel(fromQ, fromR);
    const endPos = axialToPixel(toQ, toR);
    const cell = window.cells.get(`${toQ},${toR}`);
    const finalY = endPos.y - (cell.stack.length - 1) * 6;
    
    const timeline = gsap.timeline({ onComplete: onComplete });
    
    // Rise up
    timeline.to(piece, {
        y: startPos.y - 20,
        duration: 0.2,
        ease: "power2.out"
    });
    
    // Move horizontally while elevated
    timeline.to(piece, {
        x: endPos.x,
        duration: 0.3,
        ease: "power1.inOut"
    }, "-=0.1");
    
    // Settle down onto target (possibly stacking)
    timeline.to(piece, {
        y: finalY,
        duration: 0.2,
        ease: "bounce.out"
    });
}

function animateGrasshopperJump(piece, fromQ, fromR, toQ, toR, onComplete) {
    const startPos = axialToPixel(fromQ, fromR);
    const endPos = axialToPixel(toQ, toR);
    const cell = window.cells.get(`${toQ},${toR}`);
    const finalY = endPos.y - (cell.stack.length - 1) * 6;
    
    // Simple parabolic hop
    const timeline = gsap.timeline({ onComplete: onComplete });
    const arcHeight = 40; // Fixed arc height for natural hop
    
    timeline
        .to(piece, {
            x: endPos.x,
            y: startPos.y - arcHeight,  // Go up first
            duration: 0.3,
            ease: "power2.out"
        })
        .to(piece, {
            y: finalY,  // Then down to target
            duration: 0.4,
            ease: "power2.in"
        });
}

// --- HUD ---
const hud = document.getElementById('hud');
function updateHUD(){
    // Check if current player has any legal moves
    if (hasLegalMoves(state.current)) {
        hud.textContent = state.current.charAt(0).toUpperCase()
                       + state.current.slice(1)
                       + ' to move (turn '+state.moveNumber+')';
        hud.style.fontFamily = 'Milonga, serif';
    } else {
        // Current player has no legal moves - pass turn
        passTurn();
    }
}

function hasLegalMoves(color) {
    // First check: Can this player place any pieces?
    const myPieces = tray.filter(p => p.meta.color === color && !p.meta.placed);
    if (myPieces.length > 0) {
        // Check placement zones ONCE, not per piece
        const zones = legalPlacementZones(color);
        console.log(`🎯 hasLegalMoves: ${color} has ${myPieces.length} unplaced pieces, ${zones.size} legal zones`);
        if (zones.size > 0) {
            return true; // Can place at least one piece
        }
    }
    
    // Second check: Can this player move any existing pieces?
    const placedPieces = tray.filter(p => p.meta.color === color && p.meta.placed);
    for (const piece of placedPieces) {
        const moves = legalMoveZones(piece);
        if (moves.length > 0) {
            console.log(`🎯 hasLegalMoves: ${color} can move ${piece.meta.key} to ${moves.length} positions`);
            return true; // Can move at least one piece
        }
    }
    
    console.log(`🎯 hasLegalMoves: ${color} has NO legal moves - this should only happen in true stalemate!`);
    return false; // No legal moves available
}

function passTurn() {
    console.log(`${state.current} has no legal moves - passing turn`);
    
    // Add pass entry to history
    try {
        const list = document.getElementById('moves-list');
        if (list) {
            const li = document.createElement('li');
            li.className = 'history-entry';
            const moveNum = state.moveNumber;
            const txt = document.createElement('div');
            txt.className = 'move-text';
            txt.style.fontStyle = 'italic';
            txt.style.color = '#888';
            txt.textContent = `${moveNum}. ${state.current} pass (no legal moves)`;
            li.appendChild(txt);
            list.appendChild(li);
            
            // Auto-scroll to bottom
            const historyPanel = document.getElementById('move-history');
            if (historyPanel) {
                historyPanel.scrollTop = historyPanel.scrollHeight;
            }
        }
    } catch (e) {
        console.warn('pass turn history update failed', e);
    }
    
    // Switch turns
    state.moveNumber++;
    state.current = state.current === 'white' ? 'black' : 'white';
    
    // Check if the new current player also has no moves (potential game end)
    setTimeout(() => {
        updateHUD(); // This will recursively check the new player
    }, 100);
}

function clearHighlights(){
    legalZones.forEach(k=>{
        const c=window.cells.get(k);
        if(c) c.gfx.tint = 0xFFFFFF;
    });
    legalZones.clear();
}

// --- PLACEMENT LOGIC ---
function selectPlacement(piece){
    clearHighlights();
    selected = {piece, mode:'place'};
    legalPlacementZones(piece.meta.color).forEach(k=>{
        const c = window.cells.get(k);
        if(c){ c.gfx.tint = THEME.highlight; legalZones.add(k); }
    });
    clickSfx.play().catch(()=>{});
}

function legalPlacementZones(color){
    const placed=tray.filter(p=>p.meta.placed);
    const my=placed.filter(p=>p.meta.color===color);
    const occ=new Set(placed.map(p=>`${p.meta.q},${p.meta.r}`));
    const zones=new Set();

    console.log(`🎯 legalPlacementZones called for ${color}, placed: ${placed.length}, my: ${my.length}`);

    // Queen by turn 4 - TEMPORARILY DISABLED FOR AI DEBUG
    const turn = Math.ceil(state.moveNumber / 2);
    console.log(`🎯 Turn ${turn}, Queen placed: ${state.queenPlaced[color]}`);
    
    if(!state.queenPlaced[color] && turn === 4){
        console.log(`🎯 Queen restriction check: AI enabled: ${typeof window.AIEngine !== 'undefined' && window.AIEngine.enabled}, AI color: ${window.AIEngine?.color}`);
        // TEMPORARILY BYPASS ALL Queen restrictions for AI debugging
        if(typeof window.AIEngine !== 'undefined' && window.AIEngine.enabled && window.AIEngine.color === color) {
            console.log(`🎯 AI DEBUG: Bypassing all Queen restrictions`);
            // Skip all Queen restrictions for AI
        } else if(selected && selected.piece && selected.piece.meta.key!=='Q') {
            console.log(`🎯 Human mode - Queen required but ${selected.piece.meta.key} selected, returning empty zones`);
            return zones;
        }
    }

    if(placed.length===0){
        zones.add('0,0');
        return zones;
    }

    // first piece of this color must touch an opponent
    if(my.length===0){
        placed.forEach(p=>{
            if(p.meta.color!==color) DIRS.forEach(d=>{
                const k=`${p.meta.q+d.dq},${p.meta.r+d.dr}`;
                if(window.cells.has(k)&&!occ.has(k)) zones.add(k);
            });
        });
        return zones;
    }

    // general rule: neighbor to own, no neighbor to opp
    my.forEach(p=>{
        DIRS.forEach(d=>{
            const x=p.meta.q+d.dq, y=p.meta.r+d.dr, k=`${x},${y}`;
            if(!window.cells.has(k)||occ.has(k)) return;
            const bad=DIRS.some(d2=>{
                const nkey=`${x+d2.dq},${y+d2.dr}`;
                const nc=window.cells.get(nkey);
                if(!nc||nc.stack.length===0) return false;
                return nc.stack[nc.stack.length-1].meta.color!==color;
            });
            if(!bad) zones.add(k);
        });
    });
    
    console.log(`🎯 legalPlacementZones returning ${zones.size} zones for ${color}:`, Array.from(zones));
    return zones;
}

function commitPlacement(q,r){
    const p = selected.piece;
    
    if (!isNearBorder(q,r)) {
        animating=true;
        p.meta.placed = true;
        p.meta.q = q; p.meta.r = r;
        if(p.meta.key==='Q') state.queenPlaced[p.meta.color] = true;

        // Move piece from tray app to main board app if it's currently in a tray
        if (p.parent && (p.parent === window.whiteTrayApp.stage || p.parent === window.blackTrayApp.stage)) {
            p.parent.removeChild(p);
            // Reset scale to normal size when moving to board
            p.scale.set(1.0);
            window.pieceLayer.addChild(p);
        }

        const cell = window.cells.get(`${q},${r}`);
        cell.stack.push(p);
        const base=axialToPixel(q,r);
        cell.stack.forEach((c,i)=>{
            c.x = base.x;
            c.y = base.y - i*6;
            pieceLayer.setChildIndex(c,
                pieceLayer.children.length - cell.stack.length + i
            );
        });

        animating=false;
        state.moveNumber++;
        state.current = state.current==='white'?'black':'white';
        updateHUD();
    }
    // Take a snapshot of the board state after placement
    snapshotBoardState();
    // win check: check both players for surrounded queens
    const winner = checkForWinner();
    if (winner) {
        state.gameOver = true;
        setTimeout(() => {
            const banner = window.winBanner;
            if (banner) {
                if (winner === 'DRAW') {
                    banner.text = `GAME OVER - DRAW!`;
                } else {
                    banner.text = `GAME OVER - ${winner.toUpperCase()} WINS!`;
                }
                banner.visible = true;
            } else {
                console.log(`GAME OVER - ${winner === 'DRAW' ? 'DRAW' : winner.toUpperCase() + ' WINS'}!`);
                alert(`GAME OVER - ${winner === 'DRAW' ? 'DRAW' : winner.toUpperCase() + ' WINS'}!`);
            }
            
            // Trigger personality victory/defeat response
            if (window.Personalities && window.Personalities.currentOpponent) {
                setTimeout(() => {
                    if (winner === 'black') {
                        // AI won
                        window.Personalities.showVoiceLine('victory', 10000); // Show longer for victory
                    } else if (winner === 'white') {
                        // Player won, AI lost
                        window.Personalities.showVoiceLine('defeat', 10000);
                    }
                    // No personality response for draws
                }, 2000);
            }
        }, 100);
    }
    // update move history UI (use p which is the placed piece)
    try{
        const list = document.getElementById('moves-list');
        if(list){
            const li = document.createElement('li');
            li.className = `history-entry ${p.meta.color.toLowerCase()}-move`;
            const label = labelFromCenter(q,r);
            const idx = window.historySnapshots.length - 1;
            const { fullName, pieceColor } = getEnhancedPieceInfo(p);

            // Gold hex button for move number
            const hexBtn = document.createElement('button');
            hexBtn.className = 'move-hex-btn gold-hex';
            hexBtn.title = `Preview board at move ${idx + 1}`;
            hexBtn.innerHTML = `<span class=\"move-num\">${idx + 1}</span>`;
            hexBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.showHistoryOverlay) window.showHistoryOverlay(idx);
            };

            const txt = document.createElement('div');
            txt.className = 'move-text';
            txt.innerHTML = `<span class=\"piece-name\" style=\"color: ${pieceColor}\">${fullName}</span> placed at (${q},${r}) ${label}`;

            li.appendChild(hexBtn);
            li.appendChild(txt);
            list.appendChild(li);
        }
    }catch(e){console.warn('move history update failed', e);} 

    clearHighlights();
    selected = null;
    clickSfx.play().catch(()=>{});
    
    // Check if board needs expansion after placement
    checkForBoardExpansion();
    // Always auto-zoom after placement
    if(AUTO_ZOOM_ENABLED) {
        autoZoomToFitPieces();
    }
}

function checkSurrounded(color) {
    console.log(`Checking if ${color} queen is surrounded...`);
    const queen = tray.find(p =>
        p.meta.key === 'Q' &&
        p.meta.color === color &&
        p.meta.placed
    );
    if (!queen) {
        console.log('Queen not found on board.');
        return false;
    }

    const { q, r } = queen.meta;
    console.log(`Queen found at ${q},${r}`);
    return DIRS.every(d => {
        const key = `${q + d.dq},${r + d.dr}`;
        const cell = window.cells.get(key);
        const isOccupied = cell && cell.stack.length > 0;
        console.log(`  Checking neighbor ${key}: ${isOccupied ? 'Occupied' : 'Empty'}`);
        return isOccupied;
    });
}

function checkForWinner() {
    const whiteSurrounded = checkSurrounded('white');
    const blackSurrounded = checkSurrounded('black');
    
    // Both queens surrounded = draw (rules say game is drawn in this case)
    if (whiteSurrounded && blackSurrounded) {
        return 'DRAW';
    }
    
    // One queen surrounded = opposite color wins
    if (whiteSurrounded) return 'black';
    if (blackSurrounded) return 'white';
    
    // No one surrounded = game continues
    return null;
}

// --- MOVE LOGIC ---
function selectMove(piece) {
    console.log('--- SELECT MOVE ---');
    if (!state.queenPlaced[piece.meta.color]) return;

    if (selected && selected.piece === piece) {
        clearHighlights();
        selected = null;
        tray.forEach(p => p.interactive = true);
        clickSfx.play().catch(() => {});
        return;
    }

    clearHighlights();
    selected = { piece, mode: 'move' };

    const moves = legalMoveZones(piece);
    if (moves.length === 0) {
        selected = null;
        tray.forEach(p => p.interactive = true);
        clickSfx.play().catch(() => {});
        return;
    }

    tray.forEach(p => { if (p !== piece) p.interactive = false; });
    moves.forEach(k => {
        const c = window.cells.get(k);
        if (c) {
            c.gfx.tint = THEME.highlight;
            legalZones.add(k);
        }
    });
    clickSfx.play().catch(() => {});
}

function isHiveConnected(set){
    if(set.size<2) return true;
    const arr=Array.from(set),
            seen=new Set([arr[0]]),
            q=[arr[0]];
    while(q.length){
        const cur=q.shift(),
              [x,y]=cur.split(',').map(Number);
        DIRS.forEach(d=>{
            const nb=`${x+d.dq},${y+d.dr}`;
            if(set.has(nb)&&!seen.has(nb)){
                seen.add(nb);
                q.push(nb);
            }
        });
    }
    return seen.size===set.size;
}

// simulate removing a piece at (fx,fr) and placing it at (tx,tr)
// return true if the resulting occupied tile set remains connected
function wouldHiveRemainConnectedAfterMove(fx,fr,tx,tr){
    const fromKey = `${fx},${fr}`;
    const toKey = `${tx},${tr}`;
    const occ = new Set();
    // build occupancy from actual cell stacks
    window.cells.forEach((c, key) => { if (c && c.stack && c.stack.length > 0) occ.add(key); });
    const fromCell = window.cells.get(fromKey);
    // simulate removal: if the origin cell becomes empty, delete it
    if (!fromCell || !fromCell.stack || fromCell.stack.length <= 1) {
        occ.delete(fromKey);
    }
    // simulate placement: if destination was empty, add it
    const toCell = window.cells.get(toKey);
    if (!toCell || !toCell.stack || toCell.stack.length === 0) {
        occ.add(toKey);
    }
    return isHiveConnected(occ);
}

function canSlide(fx,fr,tx,tr,occ){
    const dq=tx-fx, dr=tr-fr;
    const idx=DIRS.findIndex(d=>d.dq===dq&&d.dr===dr);
    const i1=(idx+5)%6, i2=(idx+1)%6;
    const s1=`${fx+DIRS[i1].dq},${fr+DIRS[i1].dr}`,
            s2=`${fx+DIRS[i2].dq},${fr+DIRS[i2].dr}`;
    return !(occ.has(s1)&&occ.has(s2));
}

function hiveIntactAfterRemoval(q, r) {
    const k = `${q},${r}`;
    const cell = window.cells.get(k);
    // if origin cell is empty, nothing to remove
    if (!cell || !cell.stack || cell.stack.length === 0) return true;
    // build occupancy from actual cell stacks so stacking is respected
    const occ = new Set();
    window.cells.forEach((c, key) => {
        if (c && c.stack && c.stack.length > 0) occ.add(key);
    });
    // simulate removal: if the origin cell only had one piece, it becomes empty
    if (cell.stack.length === 1) occ.delete(k);
    return isHiveConnected(occ);
}

function legalMoveZones(piece){
    const type=piece.meta.key,
            q0=piece.meta.q,
            r0=piece.meta.r;
            
    // BEETLE BUG FIX: Check if piece has something stacked on top
    const currentKey = `${q0},${r0}`;
    const cell = window.cells.get(currentKey);
    if (cell && cell.stack && cell.stack.length > 1) {
        // Find this piece's position in the stack
        const pieceIndex = cell.stack.findIndex(p => p === piece);
        // If there are pieces above this one, it cannot move
        if (pieceIndex !== -1 && pieceIndex < cell.stack.length - 1) {
            return []; // Piece is trapped under another piece
        }
    }
    
    // build occupancy from actual cell stacks so stacking is respected
    const occAll = new Set();
    window.cells.forEach((c, key) => { if (c && c.stack && c.stack.length > 0) occAll.add(key); });
    const occRem = new Set(occAll);
    // simulate removal: only delete the origin key if it will become empty
    const originKey = `${q0},${r0}`;
    const originCell = window.cells.get(originKey);
    if (!originCell || !originCell.stack || originCell.stack.length <= 1) {
        occRem.delete(originKey);
    }

    console.log(`🕷️ Checking hive connectivity after removing ${type} from (${q0},${r0})`);
    const hiveIntact = hiveIntactAfterRemoval(q0, r0);
    console.log(`🕷️ Hive intact after removal: ${hiveIntact}`);
    
    if(!hiveIntact) {
        console.log(`🕷️ Early return: hive would break if ${type} moved`);
        return [];
    }

    const zones=new Set();
    console.log(`🕷️ Proceeding to check movement for piece type: ${type}`);

    if(type==='B'){ // If the piece is a Beetle
        DIRS.forEach(d=>{ // Iterate through all 6 hexagonal directions
            const x=q0+d.dq, y=r0+d.dr, k=`${x},${y}`; // Calculate adjacent cell coordinates and create key string
            if(window.cells.has(k) && wouldHiveRemainConnectedAfterMove(q0,r0,x,y)) zones.add(k); // Add to legal zones if cell exists on board and hive stays connected after move
        });
    }
    else if(type==='Q'){ // If the piece is a Queen
        DIRS.forEach(d=>{ // Iterate through all 6 hexagonal directions
            const x=q0+d.dq, y=r0+d.dr, k=`${x},${y}`; // Calculate adjacent cell coordinates and create key string
            if(window.cells.has(k) // Check if destination cell exists on the board
               && !occAll.has(k) // Check if destination cell is not occupied by any piece
               && canSlide(q0,r0,x,y,occRem) // Check if piece can slide to destination (no tight gaps blocking movement)
               && wouldHiveRemainConnectedAfterMove(q0,r0,x,y) // Check if moving would keep the hive connected
            ) zones.add(k); // Add destination to legal movement zones if all conditions are met
        });
    }
    else if(type==='G'){ // If the piece is a Grasshopper
        DIRS.forEach(d=>{ // Iterate through all 6 hexagonal directions
            let x=q0+d.dq, y=r0+d.dr, jumped=0; // Start at first adjacent cell and initialize jump counter
            while(occAll.has(`${x},${y}`)){ // Continue jumping while there are pieces to jump over
                jumped++; // Increment the number of pieces jumped over
                x+=d.dq; y+=d.dr; // Move to the next cell in the same direction
            }
            const k=`${x},${y}`; // Create key for the landing cell (first empty cell after jumping)
            if(jumped>0 && window.cells.has(k) && !occAll.has(k) && wouldHiveRemainConnectedAfterMove(q0,r0,x,y)) zones.add(k); // Add to legal zones if at least one piece was jumped, landing cell exists and is empty, and hive stays connected
        });
    }
    else if(type==='A'){ // If the piece is an Ant
        const queue=[[q0,r0]], vis=new Set(); // Initialize BFS queue with starting position and visited set
        while(queue.length){ // Continue BFS until all reachable cells are explored
            const [cx,cy]=queue.shift(); // Dequeue the next cell to explore from
            DIRS.forEach(d=>{ // Check all 6 adjacent directions from current cell
                const nx=cx+d.dq, ny=cy+d.dr, k=`${nx},${ny}`; // Calculate neighbor coordinates and key
                if(!window.cells.has(k) // Skip if cell doesn't exist on board
                   || occRem.has(k) // Skip if cell is occupied (after simulating piece removal)
                   || vis.has(k) // Skip if cell has already been visited in this search
                   || !canSlide(cx,cy,nx,ny,occRem) // Skip if piece cannot slide to this neighbor (blocked by tight gaps)
                ) return; // Exit early if any blocking condition is met
                // ensure making this move would not break the hive
                if(!wouldHiveRemainConnectedAfterMove(q0,r0,nx,ny)) return; // Skip if moving to this cell would disconnect the hive
                vis.add(k); // Mark this cell as visited to prevent revisiting
                queue.push([nx,ny]); // Add this cell to the queue for further exploration
                zones.add(k); // Add this cell to the set of legal destination zones
            });
        }
    }
    else if(type==='S'){ // Spider - 3 steps around hive perimeter (clockwise/counterclockwise)
        // Spider follows the edge of the hive for exactly 3 steps
        // Like following a rally car track - can have twists and turns but clear direction
        
        // Find perimeter directions - positions where we touch the hive
        const perimeterStartPoints = [];
        DIRS.forEach((d, dirIndex) => {
            const adjQ = q0 + d.dq;
            const adjR = r0 + d.dr;
            const adjKey = `${adjQ},${adjR}`;
            if (occRem.has(adjKey)) {
                perimeterStartPoints.push(dirIndex);
            }
        });
        
        // For each perimeter contact point, try following the edge in both directions
        perimeterStartPoints.forEach(startDir => {
            // Try clockwise and counterclockwise around the hive
            [true, false].forEach(clockwise => {
                let currentQ = q0;
                let currentR = r0;
                let lastContactDir = startDir;
                let validPath = true;
                
                for (let step = 0; step < 3; step++) {
                    let nextPos = null;
                    
                    // Find next position that maintains contact with hive perimeter
                    for (let offset = 0; offset < 6; offset++) {
                        const searchDir = clockwise ? 
                            (lastContactDir + offset) % 6 : 
                            (lastContactDir - offset + 6) % 6;
                        
                        const testQ = currentQ + DIRS[searchDir].dq;
                        const testR = currentR + DIRS[searchDir].dr;
                        const testKey = `${testQ},${testR}`;
                        
                        // Must be able to slide to this position
                        if (!canSlide(currentQ, currentR, testQ, testR, occRem)) continue;
                        
                        // Must not be occupied
                        if (occRem.has(testKey)) continue;
                        
                        // Must maintain contact with hive (be adjacent to occupied cell)
                        let hasHiveContact = false;
                        let newContactDir = -1;
                        DIRS.forEach((checkDir, checkDirIndex) => {
                            const contactQ = testQ + checkDir.dq;
                            const contactR = testR + checkDir.dr;
                            const contactKey = `${contactQ},${contactR}`;
                            if (occRem.has(contactKey)) {
                                hasHiveContact = true;
                                newContactDir = checkDirIndex;
                            }
                        });
                        
                        if (hasHiveContact) {
                            nextPos = {q: testQ, r: testR};
                            lastContactDir = newContactDir;
                            break;
                        }
                    }
                    
                    if (!nextPos) {
                        validPath = false;
                        break;
                    }
                    
                    currentQ = nextPos.q;
                    currentR = nextPos.r;
                }
                
                // Check if we successfully completed 3 steps and final position is valid
                if (validPath && wouldHiveRemainConnectedAfterMove(q0, r0, currentQ, currentR)) {
                    zones.add(`${currentQ},${currentR}`);
                }
            });
        });
    }

    return Array.from(zones);
}








function commitMove(q,r){
    animating=true;
    const p=selected.piece;
    // capture occupancy prior to move (includes the moving piece at its old position)
    const occBefore = new Set(tray.filter(p2=>p2.meta.placed).map(p2=>`${p2.meta.q},${p2.meta.r}`));
    const oldKey=`${p.meta.q},${p.meta.r}`,
            oldCell=window.cells.get(oldKey);
    const ix=oldCell.stack.indexOf(p);
    if(ix>=0) oldCell.stack.splice(ix,1);

    oldCell.stack.forEach((c,i)=>{
        const rel=axialToPixel(oldCell.q,oldCell.r);
        c.x = rel.x;
        c.y = rel.y - i*6;
    });

    const cell=window.cells.get(`${q},${r}`);
    cell.stack.push(p);
    
    // Store original position for animation
    const fromQ = p.meta.q;
    const fromR = p.meta.r;

    // Use piece-specific animation with original board state
    animatePieceMovement(p, fromQ, fromR, q, r, occBefore, () => {
        const rel=axialToPixel(q,r);
        cell.stack.forEach((c,i)=>{
            c.x = rel.x;
            c.y = rel.y - i*6;
            pieceLayer.setChildIndex(c,
                pieceLayer.children.length-cell.stack.length+i
            );
        });

        p.meta.q=q; p.meta.r=r;

        animating=false;
        state.moveNumber++;
        state.current = state.current==='white'?'black':'white';
        updateHUD();

        const winner = checkForWinner();
        if (winner) {
            state.gameOver = true;
            setTimeout(() => {
                const banner = window.winBanner;
                if (banner) {
                    if (winner === 'DRAW') {
                        banner.text = `GAME OVER - DRAW!`;
                    } else {
                        banner.text = `GAME OVER - ${winner.toUpperCase()} WINS!`;
                    }
                    banner.visible = true;
                } else { 
                    console.log(`GAME OVER - ${winner === 'DRAW' ? 'DRAW' : winner.toUpperCase() + ' WINS'}!`);
                    alert(`GAME OVER - ${winner === 'DRAW' ? 'DRAW' : winner.toUpperCase() + ' WINS'}!`);
                }
            }, 100);
        }

        clearHighlights();
        selected = null;
        tray.forEach(p2=>p2.interactive = true);
        clickSfx.play().catch(()=>{});


// Always auto-zoom after move
if(AUTO_ZOOM_ENABLED) {
    autoZoomToFitPieces();
}

// Take a snapshot of the board state after move
snapshotBoardState();

// add to move history
try{
    const list = document.getElementById('moves-list');
    if(list){
        const li = document.createElement('li');
        li.className = `history-entry ${p.meta.color.toLowerCase()}-move`;
        const idx = window.historySnapshots.length - 1;
        // Gold hex button for move number
        const hexBtn = document.createElement('button');
        hexBtn.className = 'move-hex-btn gold-hex';
        hexBtn.title = `Preview board at move ${idx + 1}`;
        hexBtn.innerHTML = `<span class=\"move-num\">${idx + 1}</span>`;
        hexBtn.onclick = (e) => {
            e.stopPropagation();
            if (window.showHistoryOverlay) window.showHistoryOverlay(idx);
        };
        let txt;
        if(p.meta.key === 'S'){
            const { fullName, pieceColor } = getEnhancedPieceInfo(p);
            const newLabel = labelFromCenter(q,r);
            const oldCoords = oldKey.split(',').map(Number);
            txt = document.createElement('div'); txt.className='move-text';
            txt.innerHTML = `<span class=\"piece-name\" style=\"color: ${pieceColor}\">${fullName}</span> moves from (${oldCoords[0]},${oldCoords[1]}) → (${q},${r})`;
        } else {
            const { fullName, pieceColor } = getEnhancedPieceInfo(p);
            const newLabel = labelFromCenter(q,r);
            const oldCoords = oldKey.split(',').map(Number);
            txt = document.createElement('div'); txt.className='move-text';
            txt.innerHTML = `<span class=\"piece-name\" style=\"color: ${pieceColor}\">${fullName}</span> moves from (${oldCoords[0]},${oldCoords[1]}) → (${q},${r})`;
        }
        li.appendChild(hexBtn);
        li.appendChild(txt);
        list.appendChild(li);
    }
} catch(e) {
    console.warn('move history update failed', e);
} 
            
// Check if board needs expansion after move
checkForBoardExpansion();
            
    });
}

// Get full piece name and color for enhanced history display
function getEnhancedPieceInfo(piece) {
    const pieceNames = {
        'Q': 'Queen',
        'B': 'Beetle',
        'A': 'Ant',
        'G': 'Grasshopper',
        'S': 'Spider'
    };
    
    const pieceColors = {
        'Q': '#FFD700', // Gold for Queen
        'B': '#9000f0ff', // Purple for Beetle
        'A': '#1b4ad7ff', // Blue for Ant
        'G': '#01a501ff', // Green for Grasshopper
        'S': '#8B4513'  // Brown for Spider
    };

    
    const fullName = pieceNames[piece.meta.key] || piece.meta.key;
    const pieceColor = pieceColors[piece.meta.key] || '#FFFFFF';
    
    return { fullName, pieceColor };
}

// Build a tiny SVG visual showing a path (array of [q,r]) scaled to mini box
function buildMiniPathSVG(path){
    const ns = 'http://www.w3.org/2000/svg';
    const w=72,h=32;
    const svg = document.createElementNS(ns,'svg');
    svg.setAttribute('width',w); svg.setAttribute('height',h);
    svg.className = 'mini-path';
    // map axial to local x,y in the mini box
    const pts = path.map(([q,r])=>{
        const p = axialToPixel(q,r);
        return {x:p.x, y:p.y};
    });
    // normalize
    const minx = Math.min(...pts.map(p=>p.x)), maxx = Math.max(...pts.map(p=>p.x));
    const miny = Math.min(...pts.map(p=>p.y)), maxy = Math.max(...pts.map(p=>p.y));
    const pad = 6;
    const spanx = Math.max(1, maxx-minx), spany = Math.max(1, maxy-miny);
    pts.forEach((p,i)=>{
        const nx = pad + ((p.x-minx)/spanx)*(w-2*pad);
        const ny = pad + ((p.y-miny)/spany)*(h-2*pad);
        if(i>0){
            const prev = pts[i-1];
            const px = pad + ((prev.x-minx)/spanx)*(w-2*pad);
            const py = pad + ((prev.y-miny)/spany)*(h-2*pad);
            const line = document.createElementNS(ns,'line');
            line.setAttribute('x1',px); line.setAttribute('y1',py);
            line.setAttribute('x2',nx); line.setAttribute('y2',ny);
            line.setAttribute('stroke','rgba(255,255,255,0.6)'); line.setAttribute('stroke-width','2');
            svg.appendChild(line);
        }
        const circ = document.createElementNS(ns,'circle');
        circ.setAttribute('cx',nx); circ.setAttribute('cy',ny); circ.setAttribute('r',3);
        circ.setAttribute('fill','rgba(255,255,255,0.9)'); svg.appendChild(circ);
    });
    return svg;
}

// Simple straight-line splitter for path fallback: returns start, mid, end as q,r arrays
function computeStraightPath(startKey, endKey){
    const [sq,sr]=startKey.split(',').map(Number);
    const [eq,er]=endKey.split(',').map(Number);
    // try to divide into 3 steps by linear interpolation on cube coords
    const a = axialToCube(sq,sr), b = axialToCube(eq,er);
    const res = [];
    for(let t=0;t<=3;t++){
        const x = Math.round(lerp(a.x,b.x,t/3));
        const y = Math.round(lerp(a.y,b.y,t/3));
        const z = -x-y;
        const axial = cubeToAxial(x,y,z);
        res.push(axial);
    }
    return res;
}
function lerp(a,b,t){ return a + (b-a)*t; }
function axialToCube(q,r){ const x=q, z=r, y=-x-z; return {x,y,z}; }
function cubeToAxial(x,y,z){ return [x,z]; }

// Orientation overlay functions removed

// Direction label helpers
const LABEL_DIRS = [
    {label:'N', dq:0, dr:-1},
    {label:'NE', dq:1, dr:-1},
    {label:'SE', dq:1, dr:0},
    {label:'S', dq:0, dr:1},
    {label:'SW', dq:-1, dr:1},
    {label:'NW', dq:-1, dr:0}
];

function directionLabelFromDelta(dq, dr){
    for(const d of LABEL_DIRS) if(d.dq===dq && d.dr===dr) return d.label;
    return '?';
}

function labelFromCenter(q, r){
    // map angle to nearest of 6 labels used above
    const p = axialToPixel(q,r);
    const cx = 0, cy = 0; // center at pixel(0,0) for angle calculation
    const ang = Math.atan2(p.y - cy, p.x - cx);
    // convert angle so that -PI/2 (up) is N and then rotate by 60deg sectors
    let base = ang + Math.PI/2;
    while(base < 0) base += Math.PI*2;
    const sector = Math.floor((base) / (Math.PI/3)) % 6;
    return LABEL_DIRS[sector].label;
}

function pathStepsBetween(sq, sr, eq, er){
    const result = [];
    let curQ = sq, curR = sr;
    const targetCube = axialToCube(eq, er);
    const maxIter = 12;
    for(let i=0;i<maxIter;i++){
        if(curQ===eq && curR===er) break;
        // choose neighbor that minimizes cube distance to target
        let best = null, bestDist = Infinity, bestStep = null;
        for(const d of DIRS){
            const nq = curQ + d.dq, nr = curR + d.dr;
            const dist = hexDistanceAxial(nq,nr, eq,er);
            if(dist < bestDist){ bestDist = dist; best = [nq,nr]; bestStep = d; }
        }
        if(!best) break;
        result.push(best);
        curQ = best[0]; curR = best[1];
    }
    return result;
}

function hexDistanceAxial(aq, ar, bq, br){
    const a = axialToCube(aq, ar), b = axialToCube(bq, br);
    return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y), Math.abs(a.z-b.z));
}