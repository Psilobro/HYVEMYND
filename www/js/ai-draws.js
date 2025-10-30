// Hive AI Draw Detection & Play-for-Draw Module
// Recognizes and plays for draws (stretched hive, compact queens, repetition)
// Reference: Hive Tactics.txt

// Returns an object: { isDraw, reason, details }
function detectDraw(state) {
    // Stretched hive: no player can win, both queens are not surrounded, hive is elongated
    if (isStretchedHive(state)) {
        return { isDraw: true, reason: 'stretched hive', details: {} };
    }
    // Compact queens: both queens surrounded, but not by opponent bugs
    if (isCompactQueens(state)) {
        return { isDraw: true, reason: 'compact queens', details: {} };
    }
    // Forced repetition: position repeated 3 times
    if (isForcedRepetition(state)) {
        return { isDraw: true, reason: 'forced repetition', details: {} };
    }
    return { isDraw: false, reason: '', details: {} };
// End of file

// --- Draw condition detectors ---
function isStretchedHive(state) {
    // Simple: if hive has more than 2 separate clusters, or is elongated (max distance > 6)
    const clusters = countHiveClusters(state);
    if (clusters > 1) return true;
    const maxDist = getMaxHiveDistance(state);
    return maxDist > 6;
}
function isCompactQueens(state) {
    // Both queens surrounded, but not by opponent bugs
    let compact = 0;
    for (const color of ['white','black']) {
        const queen = state.tray.find(p => p.key === 'Q' && p.color === color && p.placed);
        if (!queen) continue;
        let surrounded = 0;
        let oppAdj = 0;
        for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
            const k = `${queen.q + dq},${queen.r + dr}`;
            const adj = window.cells && window.cells.get(k);
            if (adj && adj.stack.length > 0) {
                surrounded++;
                const top = adj.stack[adj.stack.length - 1];
                if (top.color !== color) oppAdj++;
            }
        }
        if (surrounded === 6 && oppAdj < 2) compact++;
    }
    return compact === 2;
}
function isForcedRepetition(state) {
    // If position has occurred 3 times in game history
    if (!state.history) return false;
    const posKey = getPositionKey(state);
    let count = 0;
    for (const snap of state.history) {
        if (getPositionKey(snap) === posKey) count++;
    }
    return count >= 3;
}
function countHiveClusters(state) {
    // TODO: Implement cluster counting (connected groups)
    return 1;
}
function getMaxHiveDistance(state) {
    // TODO: Implement max distance between any two bugs in hive
    return 0;
}
function getPositionKey(state) {
    // Simple: serialize all placed pieces
    return state.tray.filter(p => p.placed).map(p => `${p.key}${p.color}${p.q},${p.r}`).sort().join('|');
}
}

module.exports = {
    detectDraw
};
