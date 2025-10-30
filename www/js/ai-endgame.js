// Hive AI Endgame Solver Module
// Implements bug counting, fill tactics, optimal closing strategies
// Reference: Hive Tactics.txt

// Returns an object: { closingMoves, fillTactics, winChance }
function solveEndgame(state) {
    // Bug counting: count bugs in play and reserves
    const bugCounts = window.aiBugCount ? window.aiBugCount.countBugs(state) : {};

    // Fill tactics: find cells that can be filled to block opponent
    const fillMoves = getFillMoves(state);

    // Optimal closing: moves that increase chance to surround opponent queen
    const closingMoves = getClosingMoves(state);

    // Estimate win chance (simple: more bugs adjacent to opponent queen)
    let winChance = 0.5;
    if (bugCounts.attackForce && bugCounts.defenseForce) {
        const myColor = state.current;
        const oppColor = myColor === 'white' ? 'black' : 'white';
        const myAttack = bugCounts.attackForce[myColor] || 0;
        const oppDefense = bugCounts.defenseForce[oppColor] || 0;
        winChance = 0.5 + 0.1 * (myAttack - oppDefense);
        winChance = Math.max(0, Math.min(1, winChance));
    }

    return { closingMoves, fillTactics: fillMoves, winChance };
}

function getFillMoves(state) {
    // Find legal moves that fill cells adjacent to opponent queen
    const moves = [];
    const oppColor = state.current === 'white' ? 'black' : 'white';
    const queen = state.tray.find(p => p.key === 'Q' && p.color === oppColor && p.placed);
    if (!queen) return moves;
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${queen.q + dq},${queen.r + dr}`;
        const cell = window.cells && window.cells.get(k);
        if (cell && cell.stack.length === 0 && window.legalPlacementZones) {
            if (window.legalPlacementZones(state.current).has(k)) {
                moves.push({ type: 'fill', pos: k });
            }
        }
    }
    return moves;
}

function getClosingMoves(state) {
    // Find moves that increase bugs adjacent to opponent queen
    const moves = [];
    // For each bug, check if it can move adjacent to opponent queen
    const oppColor = state.current === 'white' ? 'black' : 'white';
    const queen = state.tray.find(p => p.key === 'Q' && p.color === oppColor && p.placed);
    if (!queen) return moves;
    for (const piece of state.tray) {
        if (piece.color === state.current && piece.placed && window.legalMoveZones) {
            const legal = window.legalMoveZones(piece);
            for (const k of legal) {
                for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
                    const adjKey = `${queen.q + dq},${queen.r + dr}`;
                    if (k === adjKey) {
                        moves.push({ type: 'close', piece: piece.key, from: `${piece.q},${piece.r}`, to: k });
                    }
                }
            }
        }
    }
    return moves;
}
module.exports = {
    solveEndgame
};
