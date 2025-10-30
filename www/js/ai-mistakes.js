// Hive AI Mistake Database Module
// Encodes common mistakes (misusing ants, poor bug placement, failing to defend queen, wasting tempo)
// Reference: Hive Tactics.txt

// Returns an object: { misusedAnts, poorPlacement, queenUndefended, wastedTempo, totalPenalty }
function detectMistakes(state) {
    const misusedAnts = detectMisusedAnts(state);
    const poorPlacement = detectPoorPlacement(state);
    const queenUndefended = detectQueenUndefended(state);
    const wastedTempo = detectWastedTempo(state);
    // Aggregate penalty (weights can be tuned)
    const totalPenalty = misusedAnts * 2 + poorPlacement * 2 + queenUndefended * 3 + wastedTempo * 1.5;
    return { misusedAnts, poorPlacement, queenUndefended, wastedTempo, totalPenalty };
}

// --- Mistake detectors ---
function detectMisusedAnts(state) {
    // Count ants not adjacent to hive or not contributing to attack/defense
    let misused = 0;
    for (const piece of state.tray) {
        if (piece.key === 'A' && piece.placed) {
            if (!isAdjacentToHive(piece, state) || !isContributing(piece, state)) misused++;
        }
    }
    return misused;
}
function detectPoorPlacement(state) {
    // Count bugs placed far from hive (distance > 2 from any hive cell)
    let poor = 0;
    for (const piece of state.tray) {
        if (piece.placed && !isNearHive(piece, state)) poor++;
    }
    return poor;
}
function detectQueenUndefended(state) {
    // Count queens with <2 friendly bugs adjacent
    let undefended = 0;
    for (const color of ['white','black']) {
        const queen = state.tray.find(p => p.key === 'Q' && p.color === color && p.placed);
        if (!queen) continue;
        let friendly = 0;
        for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
            const k = `${queen.q + dq},${queen.r + dr}`;
            const adj = window.cells && window.cells.get(k);
            if (adj && adj.stack.length > 0) {
                const top = adj.stack[adj.stack.length - 1];
                if (top.color === color) friendly++;
            }
        }
        if (friendly < 2) undefended++;
    }
    return undefended;
}
function detectWastedTempo(state) {
    // Count moves that do not change position or improve attack/defense
    if (!state.history || state.history.length < 2) return 0;
    let wasted = 0;
    const last = state.history[state.history.length - 1];
    const prev = state.history[state.history.length - 2];
    // Compare positions
    if (getPositionKey(last) === getPositionKey(prev)) wasted++;
    return wasted;
}

// --- Helper functions ---
function isAdjacentToHive(piece, state) {
    // True if adjacent to any occupied cell
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${piece.q + dq},${piece.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) return true;
    }
    return false;
}
function isContributing(piece, state) {
    // True if adjacent to opponent queen or friendly queen
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${piece.q + dq},${piece.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) {
            const top = adj.stack[adj.stack.length - 1];
            if (top.key === 'Q') return true;
        }
    }
    return false;
}
function isNearHive(piece, state) {
    // True if within distance 2 of any occupied cell
    for (const cell of window.cells.values()) {
        if (cell.stack.length > 0) {
            const dist = Math.abs(cell.q - piece.q) + Math.abs(cell.r - piece.r);
            if (dist <= 2) return true;
        }
    }
    return false;
}
function getPositionKey(state) {
    // Simple: serialize all placed pieces
    return state.tray.filter(p => p.placed).map(p => `${p.key}${p.color}${p.q},${p.r}`).sort().join('|');
}
module.exports = {
    detectMistakes
};
