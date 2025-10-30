// Hive AI Heuristic Evaluation Engine
// Scores positions for Mobility, Tempo, Strength, phase-aware heuristics
// Reference: Hive Tactics.txt

// Evaluate the current board position for strategic value
// Returns a score object: { mobility, tempo, strength, phase, total }
function evaluatePosition(state) {
    // Mobility: count total legal moves for current player
    const mobility = countMobility(state);

    // Tempo: measure initiative (who is threatening, who is reacting)
    const tempo = evaluateTempo(state);

    // Strength: sum of attack/defense potential (pieces near queens, control of key bugs)
    const strength = evaluateStrength(state);

    // Phase: opening, midgame, endgame (affects weighting)
    const phase = detectPhase(state);

    // Weighted total score (weights can be tuned per personality)
    const weights = getPhaseWeights(phase);
    const total = mobility * weights.mobility + tempo * weights.tempo + strength * weights.strength;

    return { mobility, tempo, strength, phase, total };
// End of file

// --- Heuristic helpers ---

function countMobility(state) {
    // Count all legal moves for current player
    let moves = 0;
    for (const piece of state.tray) {
        if (piece.color === state.current && piece.placed) {
            const legal = window.legalMoveZones ? window.legalMoveZones(piece) : [];
            moves += legal.length || (legal.size ? legal.size : 0);
        }
    }
    // Placements
    if (window.legalPlacementZones) {
        moves += window.legalPlacementZones(state.current).size;
    }
    return moves;
}

function evaluateTempo(state) {
    // Simple: count threats to opponent queen minus threats to own queen
    const oppColor = state.current === 'white' ? 'black' : 'white';
    const myThreats = countQueenThreats(state, oppColor);
    const oppThreats = countQueenThreats(state, state.current);
    return myThreats - oppThreats;
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
            threats++;
        }
    }
    return threats;
}

function evaluateStrength(state) {
    // Count key bugs in play, control of attack/defense
    let score = 0;
    for (const piece of state.tray) {
        if (!piece.placed) continue;
        // Queen, Beetle, Ant, Spider, Grasshopper, Mosquito, Ladybug, Pillbug
        switch (piece.key) {
            case 'Q': score += 5; break;
            case 'B': score += 3; break;
            case 'A': score += 2; break;
            case 'S': score += 2; break;
            case 'G': score += 1; break;
            case 'M': score += 2; break;
            case 'L': score += 2; break;
            case 'P': score += 2; break;
        }
        // Bonus for adjacency to opponent queen
        const oppColor = piece.color === 'white' ? 'black' : 'white';
        score += countQueenThreats(state, oppColor);
    }
    return score;
}

function detectPhase(state) {
    // Opening: <6 pieces placed, Midgame: 6-16, Endgame: >16
    const placed = state.tray.filter(p => p.placed).length;
    if (placed < 6) return 'opening';
    if (placed < 16) return 'midgame';
    return 'endgame';
}

function getPhaseWeights(phase) {
    // Example weights, can be tuned per personality
    switch (phase) {
        case 'opening': return { mobility: 1.5, tempo: 1.0, strength: 0.8 };
        case 'midgame': return { mobility: 1.0, tempo: 1.2, strength: 1.2 };
        case 'endgame': return { mobility: 0.7, tempo: 1.5, strength: 1.5 };
        default: return { mobility: 1, tempo: 1, strength: 1 };
    }
}
}

module.exports = {
    evaluatePosition
};
