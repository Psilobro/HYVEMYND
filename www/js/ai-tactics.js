// Hive AI Tactical Pattern Recognition Module
// Detects Pins, Covers, Blocks, Fills, Double Pins, Shutouts, Squeezes, Rings, Elbows, Pockets
// Reference: Hive Tactics.txt

// Returns an object with detected tactics and their scores
function detectTactics(state) {
    const tactics = {
        pins: detectPins(state),
        covers: detectCovers(state),
        blocks: detectBlocks(state),
        fills: detectFills(state),
        doublePins: detectDoublePins(state),
        shutouts: detectShutouts(state),
        squeezes: detectSqueezes(state),
        rings: detectRings(state),
        elbows: detectElbows(state),
        pockets: detectPockets(state)
    };
    // Aggregate score (weights can be tuned)
    const score =
        tactics.pins * 2 +
        tactics.covers * 2 +
        tactics.blocks * 1.5 +
        tactics.fills * 1.2 +
        tactics.doublePins * 2.5 +
        tactics.shutouts * 3 +
        tactics.squeezes * 2 +
        tactics.rings * 2.5 +
        tactics.elbows * 1.5 +
        tactics.pockets * 1.5;
    return { ...tactics, score };
}

// --- Tactical pattern detectors ---

function detectPins(state) {
    // Count pieces that cannot move due to hive connectivity (pinned)
    let pins = 0;
    for (const piece of state.tray) {
        if (piece.placed && !canMove(piece, state)) pins++;
    }
    return pins;
}

function detectCovers(state) {
    // Count pieces covering (stacked on) opponent bugs
    let covers = 0;
    for (const piece of state.tray) {
        if (piece.placed && isCoveringOpponent(piece, state)) covers++;
    }
    return covers;
}

function detectBlocks(state) {
    // Count pieces blocking opponent moves (adjacent to opponent bugs)
    let blocks = 0;
    for (const piece of state.tray) {
        if (piece.placed && isBlocking(piece, state)) blocks++;
    }
    return blocks;
}

function detectFills(state) {
    // Count cells filled to prevent opponent placement/movement
    let fills = 0;
    for (const cell of window.cells.values()) {
        if (cell.stack.length > 0 && isFill(cell, state)) fills++;
    }
    return fills;
}

function detectDoublePins(state) {
    // Count bugs pinned by two or more pieces
    let doublePins = 0;
    for (const piece of state.tray) {
        if (piece.placed && countPinningPieces(piece, state) >= 2) doublePins++;
    }
    return doublePins;
}

function detectShutouts(state) {
    // Count queens with all adjacent cells occupied
    let shutouts = 0;
    for (const color of ['white', 'black']) {
        const queen = state.tray.find(p => p.key === 'Q' && p.color === color && p.placed);
        if (queen && isShutout(queen, state)) shutouts++;
    }
    return shutouts;
}

function detectSqueezes(state) {
    // Count bugs with only one legal move (squeezed)
    let squeezes = 0;
    for (const piece of state.tray) {
        if (piece.placed && countLegalMoves(piece, state) === 1) squeezes++;
    }
    return squeezes;
}

function detectRings(state) {
    // Count ring formations (closed loops)
    return countRings(state);
}

function detectElbows(state) {
    // Count elbow formations (L-shaped clusters)
    return countElbows(state);
}

function detectPockets(state) {
    // Count pocket formations (enclosed empty cells)
    return countPockets(state);
}

// --- Helper stubs (to be filled with actual logic) ---
function canMove(piece, state) {
    // Use legalMoveZones to check if piece can move
    if (!window.legalMoveZones) return true;
    const moves = window.legalMoveZones(piece);
    return moves && (moves.length > 0 || (moves.size && moves.size > 0));
}
function isCoveringOpponent(piece, state) {
    // True if piece is on top of opponent's bug
    const cell = window.cells && window.cells.get(`${piece.q},${piece.r}`);
    if (!cell || cell.stack.length < 2) return false;
    const below = cell.stack[cell.stack.length - 2];
    return below && below.color !== piece.color;
}
function isBlocking(piece, state) {
    // True if adjacent to opponent bug
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${piece.q + dq},${piece.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) {
            const top = adj.stack[adj.stack.length - 1];
            if (top.color && top.color !== piece.color) return true;
        }
    }
    return false;
}
function isFill(cell, state) {
    // True if cell is surrounded and blocks opponent
    // (simple: all adjacent cells occupied)
    let occupied = 0;
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${cell.q + dq},${cell.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) occupied++;
    }
    return occupied === 6;
}
function countPinningPieces(piece, state) {
    // Count pieces adjacent to this bug that pin it
    let pins = 0;
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${piece.q + dq},${piece.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) pins++;
    }
    return pins;
}
function isShutout(queen, state) {
    // True if all adjacent cells to queen are occupied
    let occupied = 0;
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${queen.q + dq},${queen.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) occupied++;
    }
    return occupied === 6;
}
function countLegalMoves(piece, state) {
    // Use legalMoveZones to count moves
    if (!window.legalMoveZones) return 0;
    const moves = window.legalMoveZones(piece);
    return moves.length || (moves.size ? moves.size : 0);
}
function countRings(state) {
    // TODO: Implement ring detection (closed loops)
    return 0;
}
function countElbows(state) {
    // TODO: Implement elbow detection (L-shaped clusters)
    return 0;
}
function countPockets(state) {
    // TODO: Implement pocket detection (enclosed empty cells)
    return 0;
}
module.exports = {
    detectTactics
};
