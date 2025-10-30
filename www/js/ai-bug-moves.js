// Hive AI Bug Movement Module
// Implements move generators for all bugs, including edge cases
// Reference: Hive Tactics.txt

// Queen Bee movement
function getQueenMoves(state, piece) {
    // Queen moves one space, must not break hive
    // Strategic hook: prefer moves that increase queen mobility or block opponent
    // TODO: Integrate with strategic evaluation
}

// Beetle movement (can climb)
function getBeetleMoves(state, piece) {
    // Beetle can move one space, including on top of other bugs
    // Strategic hook: climbing can be used to block or pin opponent pieces
    // TODO: Integrate with strategic evaluation
}

// Ant movement (unlimited perimeter)
function getAntMoves(state, piece) {
    // Ant can move any number of spaces around hive perimeter
    // Strategic hook: prefer moves that maximize future mobility and control
    // TODO: Integrate with strategic evaluation
}

// Spider movement (exactly 3 steps, no backtracking)
function getSpiderMoves(state, piece) {
    // Spider must move exactly 3 spaces, cannot backtrack
    // Strategic hook: prefer moves that build rings or block key spaces
    // TODO: Integrate with strategic evaluation
}

// Grasshopper movement (jump in straight line)
function getGrasshopperMoves(state, piece) {
    // Grasshopper jumps over any number of bugs in a straight line
    // Strategic hook: use jumps to break blocks or attack weak points
    // TODO: Integrate with strategic evaluation
}

// Mosquito movement (copies adjacent bug)
function getMosquitoMoves(state, piece) {
    // Mosquito mimics movement of adjacent bugs
    // Strategic hook: adapt to strongest adjacent bug for tactical advantage
    // TODO: Integrate with strategic evaluation
}

// Ladybug movement (3 steps: 2 over, 1 down)
function getLadybugMoves(state, piece) {
    // Ladybug moves 2 spaces over bugs, then 1 down to ground
    // Strategic hook: use to bypass blocks and reach critical spaces
    // TODO: Integrate with strategic evaluation
}

// Pillbug movement (special ability: move adjacent bug)
function getPillbugMoves(state, piece) {
    // Pillbug can move itself or use special ability
    // Strategic hook: use special ability to reposition own or opponent bugs
    // TODO: Integrate with strategic evaluation
}

module.exports = {
    getQueenMoves,
    getBeetleMoves,
    getAntMoves,
    getSpiderMoves,
    getGrasshopperMoves,
    getMosquitoMoves,
    getLadybugMoves,
    getPillbugMoves
};
