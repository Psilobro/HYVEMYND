// --- HYVSTORY SAVE/LOAD/EXPORT SYSTEM ---

// Save the current game to localStorage
function saveGameToLocalStorage() {
    const data = buildHyvstorySaveObject();
    localStorage.setItem('hyvstory-save', JSON.stringify(data));
    alert('Game saved to browser storage!');
}

// Load the last game from localStorage
function loadGameFromLocalStorage() {
    const raw = localStorage.getItem('hyvstory-save');
    if (!raw) {
        alert('No saved game found.');
        return;
    }
    const data = JSON.parse(raw);
    restoreHyvstorySaveObject(data);
    alert('Game loaded from browser storage!');
}

// Export the current game as a downloadable file
function exportGameToFile() {
    const data = buildHyvstorySaveObject();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = generateHyvstoryFilename(data);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// Import a game from a file (user selects a .json file)
function importGameFromFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            restoreHyvstorySaveObject(data);
            alert('Game loaded from file!');
            if (callback) callback(true);
        } catch (err) {
            alert('Failed to load game: ' + err);
            if (callback) callback(false);
        }
    };
    reader.readAsText(file);
}

// --- Helpers ---

function buildHyvstorySaveObject() {
    // You can add more metadata here if desired
    const winner = window.state.gameOver ? (checkForWinner() || "draw") : "inprogress";
    return {
        date: new Date().toISOString(),
        turns: window.historySnapshots.length,
        winner: winner,
        historySnapshots: window.historySnapshots,
        // Optionally: player names, settings, etc.
    };
}

function generateHyvstoryFilename(data) {
    const dateStr = (data.date || new Date().toISOString()).slice(0, 10);
    const turns = data.turns || (data.historySnapshots ? data.historySnapshots.length : 0);
    const winner = data.winner || "inprogress";
    return `Hyvstory_${dateStr}_${turns}turns_${winner}.json`;
}

// Restore a saved game (replace current history and state)
function restoreHyvstorySaveObject(data) {
    if (!data || !Array.isArray(data.historySnapshots)) {
        alert('Invalid Hyvstory file.');
        return;
    }
    window.historySnapshots = data.historySnapshots;
    // Optionally restore other state (move number, current player, etc.)
    if (data.turns) window.state.moveNumber = data.turns;
    if (data.winner && data.winner !== "inprogress") window.state.gameOver = true;
    // You may want to trigger a full UI/game refresh here
    if (window.refreshGameFromHistory) window.refreshGameFromHistory();
}

// --- UI Hookup Example (add these to your UI as needed) ---
// document.getElementById('save-btn').onclick = saveGameToLocalStorage;
// document.getElementById('load-btn').onclick = loadGameFromLocalStorage;
// document.getElementById('export-btn').onclick = exportGameToFile;
// document.getElementById('import-btn').onchange = function(e) {
//     if (e.target.files.length) importGameFromFile(e.target.files[0]);
// };
