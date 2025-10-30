// Hive AI Game Phase Logic Module
// Adjusts priorities for bug placement, attack, defense, tactics
// Reference: Hive Tactics.txt

// Returns an object: { phase, priorities }
function getGamePhase(state) {
    // Determine phase by number of placed pieces
    const placed = state.tray.filter(p => p.placed).length;
    let phase = 'opening';
    if (placed < 6) phase = 'opening';
    else if (placed < 16) phase = 'midgame';
    else phase = 'endgame';

    // Adjust priorities for each phase
    let priorities = {};
    switch (phase) {
        case 'opening':
            priorities = {
                placement: 1.5,
                attack: 1.0,
                defense: 1.0,
                tactics: 0.8
            };
            break;
        case 'midgame':
            priorities = {
                placement: 1.0,
                attack: 1.3,
                defense: 1.2,
                tactics: 1.2
            };
            break;
        case 'endgame':
            priorities = {
                placement: 0.7,
                attack: 1.5,
                defense: 1.5,
                tactics: 1.5
            };
            break;
    }
    return { phase, priorities };
}
module.exports = {
    getGamePhase
};
