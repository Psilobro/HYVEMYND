// Hive AI Bug Counting & Resource Management Module
// Tracks bug counts, reserves, attack/defense force
// Reference: Hive Tactics.txt

// Returns an object: { white, black, reserves, attackForce, defenseForce }
function countBugs(state) {
    const bugTypes = ['Q','B','A','S','G','M','L','P'];
    const white = {};
    const black = {};
    const reserves = { white: {}, black: {} };
    for (const key of bugTypes) {
        white[key] = state.tray.filter(p => p.key === key && p.color === 'white' && p.placed).length;
        black[key] = state.tray.filter(p => p.key === key && p.color === 'black' && p.placed).length;
        reserves.white[key] = state.tray.filter(p => p.key === key && p.color === 'white' && !p.placed).length;
        reserves.black[key] = state.tray.filter(p => p.key === key && p.color === 'black' && !p.placed).length;
    }
    // Attack force: bugs adjacent to opponent queen
    const attackForce = {
        white: countAttackForce(state, 'white'),
        black: countAttackForce(state, 'black')
    };
    // Defense force: bugs adjacent to own queen
    const defenseForce = {
        white: countDefenseForce(state, 'white'),
        black: countDefenseForce(state, 'black')
    };
    return { white, black, reserves, attackForce, defenseForce };
}

function countAttackForce(state, color) {
    // Count bugs adjacent to opponent queen
    const oppColor = color === 'white' ? 'black' : 'white';
    const queen = state.tray.find(p => p.key === 'Q' && p.color === oppColor && p.placed);
    if (!queen) return 0;
    let force = 0;
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${queen.q + dq},${queen.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) {
            const top = adj.stack[adj.stack.length - 1];
            if (top.color === color) force++;
        }
    }
    return force;
}

function countDefenseForce(state, color) {
    // Count bugs adjacent to own queen
    const queen = state.tray.find(p => p.key === 'Q' && p.color === color && p.placed);
    if (!queen) return 0;
    let force = 0;
    for (const [dq, dr] of [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]]) {
        const k = `${queen.q + dq},${queen.r + dr}`;
        const adj = window.cells && window.cells.get(k);
        if (adj && adj.stack.length > 0) {
            const top = adj.stack[adj.stack.length - 1];
            if (top.color === color) force++;
        }
    }
    return force;
}
module.exports = {
    countBugs
};
