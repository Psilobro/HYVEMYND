// Hive AI Adaptive Play Module
// Tracks opponent tendencies and adapts strategy
// Reference: Hive Tactics.txt

// Returns an object: { aggression, defense, preferredBugs, adaptation }
function adaptToOpponent(state, history) {
    // Track opponent moves
    const oppColor = state.current === 'white' ? 'black' : 'white';
    const oppMoves = history ? history.filter(snap => snap.current === oppColor) : [];
    let aggression = 0;
    let defense = 0;
    const bugUsage = {};
    for (const snap of oppMoves) {
        // Count placements/moves near your queen (aggression)
        const myQueen = snap.tray.find(p => p.key === 'Q' && p.color === state.current && p.placed);
        if (myQueen) {
            for (const piece of snap.tray) {
                if (piece.color === oppColor && piece.placed) {
                    const dist = Math.abs(piece.q - myQueen.q) + Math.abs(piece.r - myQueen.r);
                    if (dist <= 1) aggression++;
                }
            }
        }
        // Count placements/moves near own queen (defense)
        const oppQueen = snap.tray.find(p => p.key === 'Q' && p.color === oppColor && p.placed);
        if (oppQueen) {
            for (const piece of snap.tray) {
                if (piece.color === oppColor && piece.placed) {
                    const dist = Math.abs(piece.q - oppQueen.q) + Math.abs(piece.r - oppQueen.r);
                    if (dist <= 1) defense++;
                }
            }
        }
        // Track bug usage
        for (const piece of snap.tray) {
            if (piece.color === oppColor && piece.placed) {
                bugUsage[piece.key] = (bugUsage[piece.key] || 0) + 1;
            }
        }
    }
    // Preferred bugs: most used bug types
    const preferredBugs = Object.entries(bugUsage).sort((a,b) => b[1]-a[1]).map(([k]) => k);
    // Adaptation: adjust own strategy weights
    const adaptation = {
        aggressionWeight: aggression > defense ? 1.2 : 1.0,
        defenseWeight: defense > aggression ? 1.2 : 1.0,
        bugFocus: preferredBugs.slice(0,2)
    };
    return { aggression, defense, preferredBugs, adaptation };
}
module.exports = {
    adaptToOpponent
};
