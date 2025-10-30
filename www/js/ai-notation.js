// Hive AI Notation & Game State Module
// Supports Hive notation and position tracking for review/learning
// Reference: Hive Tactics.txt

function toHiveNotation(move) {
    // Convert move to Hive notation string
    // Example: 'wQ 0,0' for white Queen to (0,0), 'bA 1,-1' for black Ant to (1,-1)
    if (!move || !move.piece || typeof move.q === 'undefined' || typeof move.r === 'undefined') return '';
    const color = move.piece.meta.color[0];
    const key = move.piece.meta.key;
    return `${color}${key} ${move.q},${move.r}`;
}

function fromHiveNotation(notation) {
    // Parse Hive notation string to move object
    // Example: 'wQ 0,0' → {piece: {meta: {color: 'white', key: 'Q'}}, q:0, r:0}
    if (!notation || typeof notation !== 'string') return null;
    const parts = notation.trim().split(' ');
    if (parts.length !== 2) return null;
    const [pieceStr, coordStr] = parts;
    const color = pieceStr[0] === 'w' ? 'white' : 'black';
    const key = pieceStr[1];
    const [q, r] = coordStr.split(',').map(Number);
    return {piece: {meta: {color, key}}, q, r};
}

function logGame(gameState) {
    // Log game states for review
    // Store moves in an array for later analysis
    if (!window.loggedGames) window.loggedGames = [];
    window.loggedGames.push(gameState);
}

module.exports = {
    toHiveNotation,
    fromHiveNotation,
    logGame
};
