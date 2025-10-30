// Hive AI Counterattack Logic Module
// Implements logic for switching attack/defense, momentum shifts
// Reference: Hive Tactics.txt

// Returns an object: { mode, momentum, attackScore, defenseScore }
function evaluateCounterattack(state) {
    // Attack score: threats to opponent queen, control of key bugs
    const attackScore = countQueenThreats(state, getOpponent(state)) + countKeyBugControl(state, state.current);

    // Defense score: threats to own queen, defensive bugs in place
    const defenseScore = countQueenThreats(state, state.current) + countDefensiveBugs(state, state.current);

    // Momentum: attackScore - defenseScore
    const momentum = attackScore - defenseScore;

    // Mode: 'attack', 'defend', or 'neutral'
    let mode = 'neutral';
    if (momentum > 1) mode = 'attack';
    else if (momentum < -1) mode = 'defend';

    return { mode, momentum, attackScore, defenseScore };
// End of file

// --- Helper functions ---
function getOpponent(state) {
    return state.current === 'white' ? 'black' : 'white';
}
function countQueenThreats(state, color) {
    // Count bugs adjacent to queen of given color
    const queen = state.tray.find(p => p.key === 'Q' && p.color === color && p.placed);
    if (!queen) return 0;
    const cellKey = `${queen.q},${queen.r}`;
    const cell = window.cells && window.cells.get(cellKey);
    if (!cell) return 0;
    let threats = 0;
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${queen.q + dq},${queen.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack && adj.stack.length > 0) {
            const top = adj.stack[adj.stack.length - 1];
            if (top.color && top.color !== color) threats++;
        }
    }
    return threats;
}
function countKeyBugControl(state, color) {
    // Count key bugs (Beetle, Ant, Spider) adjacent to opponent queen
    const oppQueen = state.tray.find(p => p.key === 'Q' && p.color !== color && p.placed);
    if (!oppQueen) return 0;
    let control = 0;
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${oppQueen.q + dq},${oppQueen.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) {
            const top = adj.stack[adj.stack.length - 1];
            if (top.color === color && ['B','A','S'].includes(top.key)) control++;
        }
    }
    return control;
}
function countDefensiveBugs(state, color) {
    // Count bugs adjacent to own queen
    const queen = state.tray.find(p => p.key === 'Q' && p.color === color && p.placed);
    if (!queen) return 0;
    let defense = 0;
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${queen.q + dq},${queen.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) {
            const top = adj.stack[adj.stack.length - 1];
            if (top.color === color) defense++;
        }
    }
    return defense;
}
}

module.exports = {
    evaluateCounterattack
};
