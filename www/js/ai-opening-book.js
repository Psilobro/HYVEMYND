// Hive AI Opening Book Module
// Opening move databases and heuristics for White/Black
// Reference: Hive Tactics.txt

// Returns an array of recommended opening moves for the current player
function getOpeningMoves(state) {
    // Example opening book (can be expanded)
    const openingBook = {
        white: [
            { piece: 'Q', pos: '0,0' },
            { piece: 'A', pos: '1,0' },
            { piece: 'B', pos: '0,1' },
            { piece: 'S', pos: '-1,1' }
        ],
        black: [
            { piece: 'Q', pos: '0,1' },
            { piece: 'A', pos: '-1,1' },
            { piece: 'B', pos: '1,0' },
            { piece: 'S', pos: '1,-1' }
        ]
    };
    // Heuristic: prefer Queen placement by turn 4, Ant/Beetle/Spider early
    const turn = state.tray.filter(p => p.placed).length + 1;
    const color = state.current;
    let moves = [];
    if (turn <= 4) {
        moves = openingBook[color].slice(0, turn);
    } else {
        // After turn 4, prefer Ants/Beetles/Spiders near hive
        moves = getHeuristicOpenings(state, color);
    }
    return moves;
// End of file

function getHeuristicOpenings(state, color) {
    // Suggest placements for Ants/Beetles/Spiders adjacent to hive
    const candidates = [];
    for (const piece of state.tray) {
        if (piece.color === color && !piece.placed && ['A','B','S'].includes(piece.key)) {
            // Find legal placement zones
            if (window.legalPlacementZones) {
                for (const k of window.legalPlacementZones(color)) {
                    candidates.push({ piece: piece.key, pos: k });
                }
            }
        }
    }
    return candidates;
}
}

module.exports = {
    getOpeningMoves
};
