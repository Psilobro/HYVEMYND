// --- HISTORY REPLAY LOGIC ---
function renderHistoryControls() {
    const movesList = document.getElementById('moves-list');
    const slider = document.getElementById('history-slider');
    const returnBtn = document.getElementById('return-to-live');
    if (!movesList || !slider || !window.historySnapshots) return;

    // Set slider range
    slider.max = Math.max(0, window.historySnapshots.length - 1);
    slider.value = window.historySnapshots.length - 1;

    // --- DYNAMIC TICK MARKS ---
    let ticks = document.getElementById('history-slider-ticks');
    if (!ticks) {
        ticks = document.createElement('div');
        ticks.id = 'history-slider-ticks';
        ticks.style.position = 'relative';
        ticks.style.width = '100%';
        ticks.style.height = '10px';
        ticks.style.marginTop = '-10px';
        slider.parentNode.insertBefore(ticks, slider.nextSibling);
    }
    ticks.innerHTML = '';
    const numTicks = window.historySnapshots.length;
    if (numTicks > 1) {
        for (let i = 0; i < numTicks; i++) {
            const tick = document.createElement('div');
            tick.className = 'slider-tick';
            tick.style.position = 'absolute';
            tick.style.left = ((i / (numTicks - 1)) * 100) + '%';
            tick.style.top = '0';
            tick.style.width = '2px';
            tick.style.height = '10px';
            tick.style.background = '#E6B84D';
            tick.style.transform = 'translateX(-1px)';
            ticks.appendChild(tick);
        }
    }


    // Slider handler
    slider.oninput = function() {
        showHistoryOverlay(Number(slider.value));
    };

    // Always scroll move history to bottom (most recent move)
    const historyPanel = document.getElementById('move-history');
    if (historyPanel) {
        historyPanel.scrollTop = historyPanel.scrollHeight;
    }

    // Return to live button
    returnBtn.onclick = function() {
        hideHistoryOverlay();
    };
}

function showHistoryOverlay(moveIdx) {
    // Create overlay if not present
    let overlay = document.getElementById('history-board-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'history-board-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.zIndex = '250';
        overlay.style.pointerEvents = 'none';
        overlay.style.background = 'rgba(0,0,0,0.15)';
        document.getElementById('game-container').appendChild(overlay);
    }
    overlay.innerHTML = '';
    overlay.style.opacity = '0';
    overlay.style.display = 'block';
    // Fade in overlay
    setTimeout(() => {
        overlay.style.transition = 'opacity 350ms';
        overlay.style.opacity = '1';
    }, 10);

    // Render board snapshot
    const snap = window.historySnapshots[moveIdx];
    if (!snap) return;

    // Get current board transform state to sync overlay with it
    const cellRadius = window.CELL_RADIUS || 48;
    const app = window.app;
    const pieceLayer = window.pieceLayer;
    
    if (!app || !pieceLayer) return;
    
    // Use the actual current scale and position from the live board
    const currentScale = pieceLayer.scale.x; // pieceLayer scale
    const currentPosX = pieceLayer.position.x; // pieceLayer position
    const currentPosY = pieceLayer.position.y;
    
    const containerRect = { width: app.renderer.width, height: app.renderer.height };

    // Create SVG overlay that will transform exactly like the board
    const overlaySVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlaySVG.setAttribute('width', containerRect.width);
    overlaySVG.setAttribute('height', containerRect.height);
    overlaySVG.style.position = 'absolute';
    overlaySVG.style.left = '0';
    overlaySVG.style.top = '0';
    overlaySVG.style.pointerEvents = 'none';

    // Create a group that will be transformed to match the board
    const transformGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    transformGroup.setAttribute('transform', `translate(${currentPosX}, ${currentPosY}) scale(${currentScale})`);

    // Build position map for all placed pieces
    const positionMap = new Map();
    snap.pieces.forEach(piece => {
        if (piece.placed) {
            const key = `${piece.q},${piece.r}`;
            if (!positionMap.has(key)) {
                positionMap.set(key, []);
            }
            positionMap.get(key).push(piece);
        }
    });
    
    // Get stack king (top piece) for each position
    const stackKings = new Map();
    positionMap.forEach((stack, key) => {
        const topPiece = stack.reduce((top, p) => (p.stackIndex || 0) > (top.stackIndex || 0) ? p : top, stack[0]);
        stackKings.set(key, topPiece);
    });
    
    // UHP direction mapping to HYVEMYND flat-top hex edges
    // HYVEMYND North = wG1/ (suffix after), South = /wG1 (prefix before)
    // NorthEast = bB- (UHP East, suffix after), SouthWest = -bB (UHP West, prefix before)
    // NorthWest = wG1\ (suffix after), SouthEast = \wG1 (prefix before)
    // 
    // Flat-top hex edge indices (vertex i to vertex i+1):
    // Edge 0: Top (North) - between vertices 5 and 0
    // Edge 1: Top-right (NorthEast) - between vertices 0 and 1
    // Edge 2: Bottom-right (SouthEast) - between vertices 1 and 2
    // Edge 3: Bottom (South) - between vertices 2 and 3
    // Edge 4: Bottom-left (SouthWest) - between vertices 3 and 4
    // Edge 5: Top-left (NorthWest) - between vertices 4 and 5
    const uhpToEdge = {
        'suffix/': 0,   // piece/ = North in HYVEMYND = top edge (between NW and NE)
        'prefix/': 3,   // /piece = South in HYVEMYND = bottom edge (between SE and SW)
        'suffix-': 1,   // piece- = NorthEast in HYVEMYND (UHP East)
        'prefix-': 4,   // -piece = SouthWest in HYVEMYND (UHP West)
        'suffix\\': 5,  // piece\ = NorthWest in HYVEMYND
        'prefix\\': 2   // \piece = SouthEast in HYVEMYND
    };
    
    // Parse ALL UHP moves from history to build comprehensive neighbor map
    // Map structure: pieceId -> Set of {neighborId, edgeIndex}
    const pieceNeighbors = new Map();
    
    // Helper to add bidirectional neighbor relationship
    const addNeighborRelation = (pieceId, neighborId, pieceEdge, neighborEdge) => {
        if (!pieceNeighbors.has(pieceId)) {
            pieceNeighbors.set(pieceId, new Set());
        }
        if (!pieceNeighbors.has(neighborId)) {
            pieceNeighbors.set(neighborId, new Set());
        }
        pieceNeighbors.get(pieceId).add(JSON.stringify({id: neighborId, edge: pieceEdge}));
        pieceNeighbors.get(neighborId).add(JSON.stringify({id: pieceId, edge: neighborEdge}));
    };
    
    // Parse all UHP moves up to current snapshot
    for (let i = 0; i <= moveIdx; i++) {
        const histSnap = window.historySnapshots[i];
        if (!histSnap || !histSnap.uhpMove) continue;
        
        const uhpMove = histSnap.uhpMove.trim();
        if (!uhpMove) continue;
        
        // Parse UHP move: "wA1 bQ/" or "bG1 -wS2" or "wG1" (move 1)
        const parts = uhpMove.split(/\s+/);
        if (parts.length === 0) continue;
        
        const movingPiece = parts[0];
        
        if (parts.length === 1) {
            // Move 1 - no neighbors
            continue;
        }
        
        if (parts.length === 2) {
            const reference = parts[1];
            
            // Check for directional prefix (/wG1, \wG1, -wG1)
            const prefixMatch = reference.match(/^([\/\\-])(.+)$/);
            if (prefixMatch) {
                const separator = prefixMatch[1];
                const refPiece = prefixMatch[2];
                const key = `prefix${separator}`;
                const movingEdge = uhpToEdge[key];
                const refEdge = uhpToEdge[`suffix${separator}`]; // Opposite edge
                addNeighborRelation(movingPiece, refPiece, movingEdge, refEdge);
                continue;
            }
            
            // Check for directional suffix (wG1/, wG1\, wG1-)
            const suffixMatch = reference.match(/^(.+)([\/\\-])$/);
            if (suffixMatch) {
                const refPiece = suffixMatch[1];
                const separator = suffixMatch[2];
                const key = `suffix${separator}`;
                const movingEdge = uhpToEdge[key];
                const refEdge = uhpToEdge[`prefix${separator}`]; // Opposite edge
                addNeighborRelation(movingPiece, refPiece, movingEdge, refEdge);
                continue;
            }
            
            // No separator - simple adjacency (Move 2 format: bA1 wG1)
            // Determine edge by finding actual positions
            const movingPieceObj = histSnap.pieces.find(p => {
                const id = `${p.color.charAt(0)}${p.key}${p.key === 'Q' ? '' : (p.placementOrder || '')}`;
                return id === movingPiece && p.placed;
            });
            const refPieceObj = histSnap.pieces.find(p => {
                const id = `${p.color.charAt(0)}${p.key}${p.key === 'Q' ? '' : (p.placementOrder || '')}`;
                return id === reference && p.placed;
            });
            
            if (movingPieceObj && refPieceObj) {
                const dq = movingPieceObj.q - refPieceObj.q;
                const dr = movingPieceObj.r - refPieceObj.r;
                
                // Map coordinate delta to edges
                let movingEdge, refEdge;
                if (dq === 0 && dr === -1) { movingEdge = 0; refEdge = 3; }       // North/South
                else if (dq === 1 && dr === -1) { movingEdge = 1; refEdge = 4; }  // NE/SW
                else if (dq === 1 && dr === 0) { movingEdge = 2; refEdge = 5; }   // SE/NW
                else if (dq === 0 && dr === 1) { movingEdge = 3; refEdge = 0; }   // South/North
                else if (dq === -1 && dr === 1) { movingEdge = 4; refEdge = 1; }  // SW/NE
                else if (dq === -1 && dr === 0) { movingEdge = 5; refEdge = 2; }  // NW/SE
                
                if (movingEdge !== undefined) {
                    addNeighborRelation(movingPiece, reference, movingEdge, refEdge);
                }
            }
        }
    }
    
    // Debug: Log neighbor map for current snapshot
    console.log('🎯 UHP Border Detection - Move', snap.moveNumber);
    console.log('📊 Piece Neighbors Map:', Array.from(pieceNeighbors.entries()).map(([id, neighbors]) => ({
        piece: id,
        neighbors: Array.from(neighbors).map(n => JSON.parse(n))
    })));
    console.log('👑 Stack Kings:', Array.from(stackKings.entries()).map(([pos, piece]) => ({
        position: pos,
        piece: `${piece.color.charAt(0)}${piece.key}${piece.key === 'Q' ? '' : (piece.placementOrder || '')}`,
        color: piece.color
    })));

    // Render last move FROM position (dashed border hex) - find the piece at FROM position
    if (snap.lastMove) {
        const fromPiece = snap.pieces.find(p => p.placed && p.q === snap.lastMove.from.q && p.r === snap.lastMove.from.r);
        const fromBorderColor = fromPiece ? (fromPiece.color === 'white' ? '#fff' : '#222') : '#E6B84D';
        
        const fromP = axialToPixel(snap.lastMove.from.q, snap.lastMove.from.r);
        const fromHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        fromHex.setAttribute('points', getHexPoints(fromP.x, fromP.y, cellRadius));
        fromHex.setAttribute('fill', 'none');
        fromHex.setAttribute('stroke', fromBorderColor);
        fromHex.setAttribute('stroke-width', '4');
        fromHex.setAttribute('stroke-dasharray', '8,4');
        fromHex.setAttribute('class', 'last-move-from');
        transformGroup.appendChild(fromHex);
    }

    // FIRST PASS: Draw all piece fills (background layer)
    snap.pieces.forEach(piece => {
        if (!piece.placed) return;
        
        const p = axialToPixel(piece.q, piece.r);
        const px = p.x;
        const py = p.y - (piece.stackIndex || 0) * 6;
        
        const color = getReplayPieceColor(piece.key, piece.color);
        
        // Draw hexagon fill
        const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const hexPoints = getHexPoints(px, py, cellRadius);
        hex.setAttribute('points', hexPoints);
        hex.setAttribute('fill', color);
        hex.setAttribute('stroke', 'none');
        transformGroup.appendChild(hex);
    });
    
    // SECOND PASS: Draw borders and labels (foreground layer) - ONLY for stack kings
    stackKings.forEach((piece, posKey) => {
        const p = axialToPixel(piece.q, piece.r);
        const px = p.x;
        const py = p.y - (piece.stackIndex || 0) * 6;
        
        const borderColor = piece.color === 'white' ? '#fff' : '#222';
        const hexPoints = getHexPoints(px, py, cellRadius);
        
        // Build piece UHP ID
        const pieceId = `${piece.color.charAt(0)}${piece.key}${piece.key === 'Q' ? '' : (piece.placementOrder || '')}`;
        
        // Get neighbors for this piece from UHP-derived map
        const neighbors = pieceNeighbors.get(pieceId) || new Set();
        
        // Filter to opposite-color neighbors and extract edge indices
        const oppositeNeighbors = new Set();
        neighbors.forEach(neighborJson => {
            const neighbor = JSON.parse(neighborJson);
            // Find the neighbor piece to check its color
            const neighborPiece = snap.pieces.find(p => {
                const nid = `${p.color.charAt(0)}${p.key}${p.key === 'Q' ? '' : (p.placementOrder || '')}`;
                return nid === neighbor.id && p.placed;
            });
            
            if (neighborPiece && neighborPiece.color !== piece.color) {
                oppositeNeighbors.add(neighbor.edge);
            }
        });
        
        // Draw border - split for placements, two-layer for smart edges, normal for isolated
        if (piece.wasPlacement) {
            // Split border seesaw effect for placed pieces
            const points = [];
            for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 3 * i;
                const x = px + cellRadius * Math.cos(angle);
                const y = py + cellRadius * Math.sin(angle);
                points.push({x, y});
            }
            
            // Left half path (vertices 0 -> 1 -> 2 -> 3)
            const leftPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const leftD = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y}`;
            leftPath.setAttribute('d', leftD);
            leftPath.setAttribute('fill', 'none');
            leftPath.setAttribute('stroke', borderColor);
            leftPath.setAttribute('stroke-width', '6');
            leftPath.setAttribute('class', 'placement-left');
            transformGroup.appendChild(leftPath);
            
            // Right half path (vertices 3 -> 4 -> 5 -> 0)
            const rightPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const rightD = `M ${points[3].x} ${points[3].y} L ${points[4].x} ${points[4].y} L ${points[5].x} ${points[5].y} L ${points[0].x} ${points[0].y}`;
            rightPath.setAttribute('d', rightD);
            rightPath.setAttribute('fill', 'none');
            rightPath.setAttribute('stroke', borderColor);
            rightPath.setAttribute('stroke-width', '6');
            rightPath.setAttribute('class', 'placement-right');
            transformGroup.appendChild(rightPath);
        } else if (oppositeNeighbors.size > 0) {
            // Two-layer border system: inner 3px always visible, outer 3px hidden on shared edges
            // Layer 1: Inner 3px - always drawn (full hexagon)
            const innerBorder = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            innerBorder.setAttribute('points', hexPoints);
            innerBorder.setAttribute('fill', 'none');
            innerBorder.setAttribute('stroke', borderColor);
            innerBorder.setAttribute('stroke-width', '3');
            transformGroup.appendChild(innerBorder);
            
            // Layer 2: Outer 3px - drawn per edge, hidden on shared edges
            for (let i = 0; i < 6; i++) {
                const nextI = (i + 1) % 6;
                const isSharedEdge = oppositeNeighbors.has(i);
                
                // Skip drawing outer layer on shared edges
                if (isSharedEdge) continue;
                
                const angle1 = Math.PI / 3 * i;
                const angle2 = Math.PI / 3 * nextI;
                
                const x1 = px + cellRadius * Math.cos(angle1);
                const y1 = py + cellRadius * Math.sin(angle1);
                const x2 = px + cellRadius * Math.cos(angle2);
                const y2 = py + cellRadius * Math.sin(angle2);
                
                const outerEdge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                outerEdge.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
                outerEdge.setAttribute('fill', 'none');
                outerEdge.setAttribute('stroke', borderColor);
                outerEdge.setAttribute('stroke-width', '3');
                transformGroup.appendChild(outerEdge);
            }
        } else {
            // Normal border for pieces with no opposite neighbors
            const border = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            border.setAttribute('points', hexPoints);
            border.setAttribute('fill', 'none');
            border.setAttribute('stroke', borderColor);
            border.setAttribute('stroke-width', '6');
            transformGroup.appendChild(border);
        }
        
        // Add glow for last move TO piece
        if (snap.lastMove && piece.q === snap.lastMove.to.q && piece.r === snap.lastMove.to.r) {
            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            glow.setAttribute('points', hexPoints);
            glow.setAttribute('fill', 'none');
            glow.setAttribute('stroke', borderColor);
            glow.setAttribute('stroke-width', '8');
            glow.setAttribute('class', 'last-move-to');
            transformGroup.appendChild(glow);
        }
        
        // Piece label with UHP notation (centered)
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', px);
        text.setAttribute('y', py + 7);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', 24);
        text.setAttribute('fill', piece.color === 'white' ? '#222' : '#fff');
        text.setAttribute('font-family', 'Milonga, serif');
        
        // Build UHP label: wA1, bG2, wQ (queens have no number)
        const colorPrefix = piece.color.charAt(0);
        const orderSuffix = piece.key === 'Q' ? '' : (piece.placementOrder || '');
        text.textContent = `${colorPrefix}${piece.key}${orderSuffix}`;
        transformGroup.appendChild(text);
    });
    
    overlaySVG.appendChild(transformGroup);
    overlay.appendChild(overlaySVG);
    
    // Add UHP notation display if available
    if (snap.uhpMove && snap.uhpMove.trim()) {
        const uhpDisplay = document.createElement('div');
        uhpDisplay.style.position = 'absolute';
        uhpDisplay.style.top = '20px';
        uhpDisplay.style.left = '20px';
        uhpDisplay.style.padding = '10px 15px';
        uhpDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        uhpDisplay.style.color = 'white';
        uhpDisplay.style.fontFamily = 'monospace';
        uhpDisplay.style.fontSize = '16px';
        uhpDisplay.style.borderRadius = '5px';
        uhpDisplay.style.zIndex = '101';
        uhpDisplay.style.pointerEvents = 'none';
        uhpDisplay.textContent = `Move ${snap.moveNumber}: ${snap.uhpMove}`;
        overlay.appendChild(uhpDisplay);
    }

    // Show return button
    document.getElementById('return-to-live').style.display = 'block';
}

// Helper to get hexagon points for SVG
function getHexPoints(cx, cy, radius) {
    // Flat-top hex orientation: rotate by 30deg so flat edge is at top
    let points = [];
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 3 * i;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        points.push(`${x},${y}`);
    }
    return points.join(' ');
}

function hideHistoryOverlay() {
    const overlay = document.getElementById('history-board-overlay');
    if (overlay) {
        overlay.style.transition = 'opacity 350ms';
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 350);
    }
    document.getElementById('return-to-live').style.display = 'none';
}

function getReplayPieceColor(key, color) {
    // Use same color logic as getEnhancedPieceInfo
    if (key === 'Q') return '#FFD700';
    if (key === 'B') return '#9000f0ff';
    if (key === 'A') return '#1b4ad7ff';
    if (key === 'G') return '#01a501ff';
    if (key === 'S') return '#8B4513';
    return color === 'white' ? '#fff' : '#333';
}

// Hook up rendering after each move history update
const movesList = document.getElementById('moves-list');
const observer = new MutationObserver(() => {
    renderHistoryControls();
});
if (movesList) {
    observer.observe(movesList, { childList: true });
}
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
    // Calculate tray height - account for tablet scaling and extra space for Queen pieces
    let trayHeight = window.innerHeight + 160; // Add extra height for top and bottom padding
    if (window.innerWidth >= 769 && window.innerWidth <= 1200) {
        // For tablets, increase canvas height to account for 0.6 CSS scaling
        trayHeight = (window.innerHeight + 160) / 0.6;
    }
    
    whiteTrayApp = new PIXI.Application({
        width: 220,
        height: trayHeight,
        backgroundAlpha: 0,
        antialias: true
    });
    document.getElementById('white-tray').appendChild(whiteTrayApp.view);
    whiteTrayApp.view.style.position = 'absolute';
whiteTrayApp.view.style.left = '0px';
whiteTrayApp.view.style.top = '0px';
// Let CSS handle scaling - don't override with JavaScript
whiteTrayApp.view.style.transformOrigin = 'left top';
whiteTrayApp.view.style.zIndex = '5';

    blackTrayApp = new PIXI.Application({
        width: 220,
        height: trayHeight,
        backgroundAlpha: 0,
        antialias: true
    });
    document.getElementById('black-tray').appendChild(blackTrayApp.view);
    blackTrayApp.view.style.position = 'absolute';
blackTrayApp.view.style.right = '0px';
blackTrayApp.view.style.top = '0px';
// Let CSS handle scaling - don't override with JavaScript
blackTrayApp.view.style.transformOrigin = 'right top';
blackTrayApp.view.style.zIndex = '6';

    window.whiteTrayApp = whiteTrayApp;
    window.blackTrayApp = blackTrayApp;

    const winBanner = new PIXI.Text('', {
        fontFamily: 'Milonga',
        fontSize: Math.min(app.renderer.width, app.renderer.height) * 0.09,
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: app.renderer.width * 0.8
    });
    winBanner.anchor.set(0.5);
    winBanner.position.set(app.renderer.width / 2, app.renderer.height / 2);
    winBanner.visible = false;
    winBanner.resolution = 2;
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
    
    // Setup HUD controls
    setupHUD();
    
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
    const moveHistoryToggle = document.getElementById('move-history-toggle');
    const moveHistory = document.getElementById('move-history');

    // Handle window resize
    window.addEventListener('resize', resizeApp);

    // Auto-zoom toggle functionality
    autoZoomToggle.addEventListener('click', (e) => {
        AUTO_ZOOM_ENABLED = !AUTO_ZOOM_ENABLED;
    e.target.textContent = `Auto-Center: ${AUTO_ZOOM_ENABLED ? 'ON' : 'OFF'}`;
        if(AUTO_ZOOM_ENABLED) {
            autoZoomToFitPieces();
        }
    });

    // Move history toggle for all modes - always opens, never changes text
    moveHistoryToggle.addEventListener('click', (e) => {
        if (window.innerWidth >= 769 && window.innerWidth <= 850) {
            moveHistory.classList.add('tablet-expanded');
        } else {
            moveHistory.classList.add('expanded');
        }
        // Hide button when panel opens
        moveHistoryToggle.classList.add('hidden-by-panel');
    });
    
    // History close button handler
    const historyCloseBtn = document.getElementById('history-close-btn');
    if (historyCloseBtn) {
        historyCloseBtn.addEventListener('click', (e) => {
            // Add closing animation class
            moveHistory.classList.add('closing');
            
            // Show button again when panel closes
            moveHistoryToggle.classList.remove('hidden-by-panel');
            
            // After animation completes, actually hide the panel
            setTimeout(() => {
                moveHistory.classList.remove('tablet-expanded', 'expanded', 'closing');
            }, 400); // Match CSS transition duration
        });
        
        // Hover effect for close button - curtain pull effect
        historyCloseBtn.addEventListener('mouseenter', (e) => {
            e.target.style.background = '#f4c965';
            e.target.style.transform = 'scale(1.1)';
            e.target.style.boxShadow = '0 3px 6px rgba(0,0,0,0.4)';
        });
        historyCloseBtn.addEventListener('mouseleave', (e) => {
            e.target.style.background = '#E6B84D';
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        });
    }

    // Ensure tablet history panel starts minimized
    function initializeTabletMode() {
        if (window.innerWidth >= 769 && window.innerWidth <= 850) {
            moveHistory.classList.remove('tablet-expanded');
        }
        // Always ensure toggle button shows 'History'
        moveHistoryToggle.textContent = 'History';
    }
    initializeTabletMode();
    window.addEventListener('resize', initializeTabletMode);

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

    // Small global toast helper for transient messages
    function showToast(message, duration = 3000) {
        let toast = document.getElementById('global-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'global-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 28px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(34,34,34,0.95);
                color: #fff;
                padding: 10px 16px;
                border-radius: 10px;
                z-index: 2000;
                font-family: 'Milonga', serif;
                font-size: 14px;
                box-shadow: 0 6px 24px rgba(0,0,0,0.35);
                opacity: 0;
                transition: opacity 250ms ease;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.display = 'block';
        // Force reflow for transition
        // eslint-disable-next-line no-unused-expressions
        toast.offsetWidth;
        toast.style.opacity = '1';

        if (toast._hideTimeout) clearTimeout(toast._hideTimeout);
        toast._hideTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { toast.style.display = 'none'; }, 300);
        }, duration);
    }

    // Expose for other modules
    window.showToast = showToast;

    // Setup HUD controls
    function setupHUD() {
        const historyButton = document.getElementById('history-button');
        const resetButton = document.getElementById('reset-button');
        
        if (historyButton) {
            historyButton.addEventListener('click', () => {
                const moveHistory = document.getElementById('move-history');
                if (moveHistory) {
                    if (window.innerWidth >= 769 && window.innerWidth <= 850) {
                        moveHistory.classList.add('tablet-expanded');
                    } else {
                        moveHistory.classList.add('expanded');
                    }
                }
            });
        }
        
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset the game? This will clear the board and start over.')) {
                    if (window.resetGame) {
                        window.resetGame();
                    }
                }
            });
        }
        
        // Setup pause/resume button
        const pauseButton = document.getElementById('pause-game-button');
        if (pauseButton) {
            pauseButton.addEventListener('click', () => {
                if (window.state.gamePaused) {
                    // Resume game
                    window.state.gamePaused = false;
                    pauseButton.textContent = '⏸️ Pause';
                    console.log('▶️ Game resumed');
                    // Update HUD to continue game flow
                    if (window.updateHUD) {
                        window.updateHUD();
                    }
                } else {
                    // Pause game
                    window.state.gamePaused = true;
                    pauseButton.textContent = '▶️ Resume';
                    console.log('⏸️ Game paused');
                }
            });
        }
    }
    
    // Setup settings dropdown menu
    function setupSettingsDropdown() {
        const settingsButton = document.getElementById('settings-button');
        const settingsMenu = document.getElementById('settings-menu');
        
        if (!settingsButton || !settingsMenu) return;
        
        // Ensure menu starts hidden
        settingsMenu.classList.add('settings-menu-hidden');
        settingsMenu.classList.remove('settings-menu-visible');
        
        // Toggle menu on button click
        settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = settingsMenu.classList.contains('settings-menu-hidden');
            if (isHidden) {
                settingsMenu.classList.remove('settings-menu-hidden');
                settingsMenu.classList.add('settings-menu-visible');
            } else {
                settingsMenu.classList.add('settings-menu-hidden');
                settingsMenu.classList.remove('settings-menu-visible');
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#settings-menu-container')) {
                settingsMenu.classList.add('settings-menu-hidden');
                settingsMenu.classList.remove('settings-menu-visible');
            }
        });
        
        // Handle menu item clicks
        const menuItems = settingsMenu.querySelectorAll('.settings-menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                
                // Close menu after selection
                settingsMenu.classList.add('settings-menu-hidden');
                settingsMenu.classList.remove('settings-menu-visible');
                
                // Execute the corresponding action
                switch (action) {
                    case 'single-mode':
                        if (window.showAIDifficultyModal) {
                            window.showAIDifficultyModal();
                        }
                        break;
                    case 'multiplayer':
                        if (window.showMultiplayerModal) {
                            window.showMultiplayerModal();
                        }
                        break;
                    case 'dev-ops':
                        if (window.devOpsSystem && window.devOpsSystem.showModal) {
                            window.devOpsSystem.showModal();
                        }
                        break;
                    case 'tray-ops':
                        if (window.showTrayOpsModal) {
                            window.showTrayOpsModal();
                        }
                        break;
                }
            });
        });
    }
    
    setupSettingsDropdown();

    // --- Export Learning Data Button ---
    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-learning-data';
    exportBtn.textContent = 'Export Learning Data';
    exportBtn.style.display = 'none';
    exportBtn.style.margin = '12px auto';
    exportBtn.style.padding = '8px 18px';
    exportBtn.style.fontSize = '1.1em';
    exportBtn.style.background = '#E6B84D';
    exportBtn.style.color = '#222';
    exportBtn.style.border = '2px solid #FFD700';
    exportBtn.style.borderRadius = '8px';
    exportBtn.style.cursor = 'pointer';
    exportBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
    exportBtn.onclick = function() {
        const data = localStorage.getItem('devOpsStatistics');
        if (!data) return alert('No learning data found!');
        const blob = new Blob([data], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'devOpsStatistics.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    document.body.appendChild(exportBtn);
});
