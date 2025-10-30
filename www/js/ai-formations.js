// Hive AI Formation Detection Module
// Recognizes Gates, Doors, Rings, Elbows, Pockets
// Reference: Hive Tactics.txt

// Returns an object with detected formations and their scores
function detectFormations(state) {
    const formations = {
        gates: detectGates(state),
        doors: detectDoors(state),
        rings: detectRings(state),
        elbows: detectElbows(state),
        pockets: detectPockets(state)
    };
    // Aggregate score (weights can be tuned)
    const score =
        formations.gates * 2.5 +
        formations.doors * 2 +
        formations.rings * 3 +
        formations.elbows * 1.5 +
        formations.pockets * 2;
    return { ...formations, score };
}

// --- Formation detectors ---

function detectGates(state) {
    // TODO: Implement gate detection (two bugs with a gap between, controlling access)
    return 0;
}

function detectDoors(state) {
    // TODO: Implement door detection (single bug controlling access to a region)
    return 0;
}

function detectRings(state) {
    // Use tactical module if available, else stub
    if (window.aiTactics && window.aiTactics.countRings) {
        return window.aiTactics.countRings(state);
    }
    return 0;
}

function detectElbows(state) {
    // Use tactical module if available, else stub
    if (window.aiTactics && window.aiTactics.countElbows) {
        return window.aiTactics.countElbows(state);
    }
    return 0;
}

function detectPockets(state) {
    // Use tactical module if available, else stub
    if (window.aiTactics && window.aiTactics.countPockets) {
        return window.aiTactics.countPockets(state);
    }
    return 0;
}
module.exports = {
    detectFormations
};
