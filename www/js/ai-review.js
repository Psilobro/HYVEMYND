// Hive AI Game Logging & Review Module
// Logs games in Hive notation for replay and analysis
// Reference: Hive Tactics.txt

// Logs a move in Hive notation and appends to game log
function logMove(move, gameLog) {
    // Convert move to Hive notation (assume move object: { piece, from, to, type })
    let notation = '';
    if (move.type === 'placement') {
        notation = `${move.piece}${move.to}`;
    } else if (move.type === 'move') {
        notation = `${move.piece}${move.from}-${move.to}`;
    } else {
        notation = `${move.piece}${move.from || ''}-${move.to || ''}`;
    }
    gameLog.push(notation);
    return gameLog;
}

// Reviews a logged game, returns summary and stats
function reviewGame(gameLog) {
    // Parse Hive notation log and return stats
    const stats = {
        totalMoves: gameLog.length,
        placements: 0,
        moves: 0,
        bugsUsed: {}
    };
    for (const entry of gameLog) {
        // Placement: e.g. Q0,0
        if (/^[A-Z][\-0-9,]+$/.test(entry)) {
            stats.placements++;
            const bug = entry[0];
            stats.bugsUsed[bug] = (stats.bugsUsed[bug] || 0) + 1;
        } else if (/^[A-Z][\-0-9,]+-[\-0-9,]+$/.test(entry)) {
            stats.moves++;
            const bug = entry[0];
            stats.bugsUsed[bug] = (stats.bugsUsed[bug] || 0) + 1;
        }
    }
    return stats;
}
module.exports = {
    logMove,
    reviewGame
};
