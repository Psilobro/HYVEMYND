/* global io, state, tray, selected, selectPlacement, selectMove, commitPlacement, commitMove, updateHUD, axialToPixel */

(() => {
  // Multiplayer configuration
  window.MULTIPLAYER = {
    enabled: false,
    socket: null,
    roomId: null,
    playerColor: null,
    isMyTurn: false,
    connected: false
  };

  let actionQueue = [];
  let processingAction = false;

  // Initialize Socket.IO connection
  function initMultiplayer() {
    // Try to connect to the backend server
    let socketUrl;
    
    // Check for deployed server URL first (you'll set this after deployment)
    const deployedServerUrl = 'https://hyvemynd-backend.onrender.com'; // Replace this after Render deployment
    
    if (deployedServerUrl && deployedServerUrl !== 'YOUR_RENDER_SERVER_URL') {
      // Use deployed server for internet play
      socketUrl = deployedServerUrl;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Local development
      socketUrl = 'http://localhost:3000';
    } else {
      // Fallback to same origin
      socketUrl = window.location.origin;
    }
    
    console.log('Attempting to connect to:', socketUrl);
    const socket = io(socketUrl);
    window.MULTIPLAYER.socket = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      window.MULTIPLAYER.connected = true;
      updateMultiplayerHUD();
      updateModalStatus();
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      window.MULTIPLAYER.connected = false;
      updateMultiplayerHUD();
      updateModalStatus();
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection failed:', error);
      window.MULTIPLAYER.connected = false;
      updateModalStatus();
      
      // Show helpful error message
      const statusText = document.getElementById('status-text');
      if (statusText) {
        statusText.textContent = 'Server not running - Start backend server first!';
        statusText.style.color = '#ff6b6b';
      }
    });

    socket.on('room-joined', (data) => {
      window.MULTIPLAYER.roomId = data.roomId;
      window.MULTIPLAYER.playerColor = data.playerColor;
      window.MULTIPLAYER.enabled = true;
      
      console.log(`Joined room ${data.roomId} as ${data.playerColor}`);
      
      // Restore game state if rejoining
      if (data.gameState) {
        restoreGameState(data.gameState);
      }
      
      updateMultiplayerHUD();
      updateModalStatus();
      checkIfMyTurn();
      
      // Show chat and add welcome message
      window.ChatUI.showChatButton();
      window.ChatUI.addMessage({
        message: `Welcome to room ${data.roomId}! You are playing as ${data.playerColor}.`,
        isSystem: true
      });
      
      // Add visual player indicator
      addPlayerIndicator(data.playerColor);
      
      // Show room info in modal
      showRoomInfo(data);
    });

    socket.on('player-joined', (data) => {
      console.log('Another player joined:', data.player.name);
      showNotification(`${data.player.name} joined the game!`, 'success');
      updateMultiplayerHUD();
      updateModalStatus();
      
      // Add system message to chat
      window.ChatUI.addMessage({
        message: `${data.player.name} joined as ${data.player.color}`,
        isSystem: true
      });
    });

    socket.on('game-action', (data) => {
      console.log('Received action from opponent:', data.action);
      queueAction(data);
      showNotification(`${data.playerName || 'Opponent'} made a move`, 'info');
    });

    socket.on('player-disconnected', (data) => {
      console.log('Player disconnected');
      showNotification('Opponent disconnected', 'warning');
      addSystemMessage('Opponent disconnected');
      updateMultiplayerHUD();
      updateModalStatus();
    });

    socket.on('chat-message', (data) => {
      window.ChatUI.addMessage(data);
      if (data.playerColor !== window.MULTIPLAYER.playerColor) {
        showNotification(`💬 ${data.playerName}: ${data.message}`, 'chat');
      }
    });

    socket.on('player-typing', (data) => {
      window.ChatUI.showTyping(data);
    });

    socket.on('game-reset', (data) => {
      console.log('Game reset by:', data.resetBy);
      
      // Reset the game to initial state
      if (typeof resetGameToInitialState === 'function') {
        resetGameToInitialState();
      } else {
        // Fallback: reload the page
        window.location.reload();
      }
      
      showNotification(`Game reset by ${data.resetBy}`, 'info');
      window.ChatUI.addMessage({
        message: `Game reset by ${data.resetBy}`,
        isSystem: true
      });
    });

    socket.on('player-left', (data) => {
      console.log('Player left:', data.player.name);
      showNotification(`${data.player.name} left the game`, 'warning');
      window.ChatUI.addMessage({
        message: `${data.player.name} left the game`,
        isSystem: true
      });
      
      // Update room info
      const statusText = document.getElementById('status-text');
      if (statusText) {
        statusText.innerHTML = `
          <strong>Room ${window.MULTIPLAYER.roomId}</strong><br>
          You are: ${window.MULTIPLAYER.playerColor === 'white' ? '⚪ White' : '⚫ Black'}<br>
          Players: ${data.players.length}/2 - Waiting for opponent...
        `;
      }
    });

    return socket;
  }

  // Queue actions to process sequentially
  function queueAction(actionData) {
    actionQueue.push(actionData);
    processActionQueue();
  }

  async function processActionQueue() {
    if (processingAction || actionQueue.length === 0) return;
    
    processingAction = true;
    
    while (actionQueue.length > 0) {
      const actionData = actionQueue.shift();
      await applyOpponentAction(actionData);
    }
    
    processingAction = false;
  }

  // Apply opponent's action to local game
  function applyOpponentAction(actionData) {
    return new Promise((resolve) => {
      const { action } = actionData;
      
      // Find the piece by its metadata - use the unique id
      const piece = tray.find(p => 
        p.meta.id === action.pieceId ||
        (p.meta.key === action.pieceKey && 
         p.meta.color === action.color &&
         p.meta.i === action.pieceIndex)
      );
      
      if (!piece) {
        console.warn('Could not find piece for opponent action:', action);
        console.log('Available pieces:', tray.map(p => ({ id: p.meta.id, key: p.meta.key, color: p.meta.color, i: p.meta.i })));
        resolve();
        return;
      }

      console.log('Applying opponent action:', action.type, 'for piece', piece.meta.id);

      // Set bypass flag to allow opponent moves
      bypassTurnCheck = true;

      if (action.type === 'place') {
        selectPlacement(piece);
        commitPlacement(action.q, action.r);
      } else if (action.type === 'move') {
        selectMove(piece);
        commitMove(action.q, action.r);
      }
      
      // Reset bypass flag
      bypassTurnCheck = false;
      
      // Wait for animations to complete
      setTimeout(resolve, 600);
    });
  }

  // Send action to other players
  function broadcastAction(actionType, piece, q, r) {
    if (!window.MULTIPLAYER.enabled || !window.MULTIPLAYER.socket) return;
    
    const action = {
      type: actionType,
      pieceKey: piece.meta.key,
      pieceId: piece.meta.id,
      pieceIndex: piece.meta.i, // Fallback for piece identification
      color: piece.meta.color,
      q, r,
      timestamp: Date.now()
    };
    
    const gameState = exportGameState();
    
    console.log('Broadcasting action:', action);
    
    window.MULTIPLAYER.socket.emit('game-action', {
      roomId: window.MULTIPLAYER.roomId,
      action,
      gameState
    });
  }

  // Export current game state for sync
  function exportGameState() {
    return {
      current: state.current,
      moveNumber: state.moveNumber,
      queenPlaced: { ...state.queenPlaced },
      gameOver: state.gameOver,
      pieces: tray.map(p => ({
        id: p.meta.id,
        key: p.meta.key,
        color: p.meta.color,
        placed: p.meta.placed,
        q: p.meta.q,
        r: p.meta.r
      }))
    };
  }

  // Restore game state from server
  function restoreGameState(gameState) {
    console.log('Restoring game state:', gameState);
    
    // Clear existing cell stacks first
    window.cells.forEach(cell => {
      cell.stack = [];
    });
    
    // Update global state
    state.current = gameState.current;
    state.moveNumber = gameState.moveNumber;
    state.queenPlaced = gameState.queenPlaced;
    state.gameOver = gameState.gameOver;
    
    console.log('Game state updated, processing pieces:', gameState.pieces);
    
    // First pass: Update piece metadata only
    gameState.pieces.forEach(savedPiece => {
      const piece = tray.find(p => p.meta.id === savedPiece.id);
      if (piece) {
        piece.meta.placed = savedPiece.placed;
        piece.meta.q = savedPiece.q;
        piece.meta.r = savedPiece.r;
        console.log(`Updated piece ${savedPiece.id} (${savedPiece.key}): placed=${savedPiece.placed}, q=${savedPiece.q}, r=${savedPiece.r}`);
      } else {
        console.warn(`Piece not found in tray:`, savedPiece);
      }
    });
    
    // Second pass: Position pieces on board and rebuild stacks
    const placedPieces = gameState.pieces.filter(p => p.placed);
    console.log(`Placing ${placedPieces.length} pieces on board`);
    
    placedPieces.forEach(savedPiece => {
      const piece = tray.find(p => p.meta.id === savedPiece.id);
      if (piece) {
        // Ensure the cell exists
        const cellKey = `${savedPiece.q},${savedPiece.r}`;
        if (!window.cells.has(cellKey)) {
          window.cells.set(cellKey, { 
            gfx: null, 
            q: savedPiece.q, 
            r: savedPiece.r, 
            stack: [] 
          });
          console.log(`Created new cell at ${cellKey}`);
        }
        
        const cell = window.cells.get(cellKey);
        cell.stack.push(piece);
        
        // Position piece on board with correct stack height
        const pos = axialToPixel(savedPiece.q, savedPiece.r);
        piece.x = pos.x;
        piece.y = pos.y - (cell.stack.length - 1) * 6; // Stack height offset
        
        // Ensure piece is added to the board's piece layer
        if (piece.parent === window.whiteApp.stage || piece.parent === window.blackApp.stage) {
          piece.parent.removeChild(piece);
        }
        window.pieceLayer.addChild(piece);
        
        console.log(`Placed piece ${savedPiece.id} at (${pos.x}, ${piece.y}) in cell ${cellKey}, stack size: ${cell.stack.length}`);
      }
    });
    
    console.log('Game state restoration complete');
    updateHUD();
  }

  // Check if it's the local player's turn
  function checkIfMyTurn() {
    // Always allow moves in single player mode
    if (!window.MULTIPLAYER.enabled || !window.MULTIPLAYER.connected || !window.MULTIPLAYER.roomId) {
      window.MULTIPLAYER.isMyTurn = true;
      return;
    }
    
    window.MULTIPLAYER.isMyTurn = (state.current === window.MULTIPLAYER.playerColor);
    console.log('Turn check:', {
      current: state.current,
      playerColor: window.MULTIPLAYER.playerColor,
      isMyTurn: window.MULTIPLAYER.isMyTurn
    });
  }

  // Update HUD with multiplayer info
  function updateMultiplayerHUD() {
    const hud = document.getElementById('hud');
    if (!hud) return;
    
    // Only show multiplayer HUD if in an active multiplayer game
    if (window.MULTIPLAYER.enabled && window.MULTIPLAYER.connected && window.MULTIPLAYER.roomId) {
      const status = window.MULTIPLAYER.connected ? 'Connected' : 'Disconnected';
      const colorEmoji = window.MULTIPLAYER.playerColor === 'white' ? '⚪' : '⚫';
      const role = `${colorEmoji} You are ${window.MULTIPLAYER.playerColor}`;
      const turn = window.MULTIPLAYER.isMyTurn ? '🎯 Your turn' : '⏳ Opponent\'s turn';
      
      hud.innerHTML = `${role} • ${status} • ${turn}`;
    }
    // In single player mode, let the original HUD function handle display
  }

  // Add visual player indicator
  function addPlayerIndicator(playerColor) {
    // Remove existing indicator
    const existingIndicator = document.getElementById('player-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'player-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      background: ${playerColor === 'white' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)'};
      color: ${playerColor === 'white' ? '#000' : '#E6B84D'};
      padding: 10px 15px;
      border-radius: 20px;
      font-family: 'Beetype-Outline', monospace;
      font-weight: bold;
      border: 2px solid #E6B84D;
      z-index: 1001;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;
    indicator.innerHTML = `${playerColor === 'white' ? '⚪' : '⚫'} You are ${playerColor.toUpperCase()}`;
    document.body.appendChild(indicator);
  }

  // Show room information
  function showRoomInfo(data) {
    const roomInfoSection = document.getElementById('game-link-section');
    const statusText = document.getElementById('status-text');
    
    if (roomInfoSection) {
      roomInfoSection.style.display = 'block';
    }
    
    if (statusText) {
      const playerCount = data.players ? data.players.length : 1;
      statusText.innerHTML = `
        <strong>Room ${data.roomId}</strong><br>
        You are: ${data.playerColor === 'white' ? '⚪ White' : '⚫ Black'}<br>
        Players: ${playerCount}/2
      `;
      statusText.style.color = '#E6B84D';
    }
  }

  // Wrap existing commit functions to broadcast actions
  let bypassTurnCheck = false; // Flag to allow opponent moves

  const originalCommitPlacement = window.commitPlacement;
  window.commitPlacement = function(q, r) {
    // Only enforce turn restrictions if in an active multiplayer game with another player
    const inActiveMultiplayerGame = window.MULTIPLAYER.enabled && 
                                   window.MULTIPLAYER.connected && 
                                   window.MULTIPLAYER.roomId;
    
    console.log('commitPlacement called:', {
      enabled: window.MULTIPLAYER.enabled,
      connected: window.MULTIPLAYER.connected,
      roomId: window.MULTIPLAYER.roomId,
      inActiveGame: inActiveMultiplayerGame,
      isMyTurn: window.MULTIPLAYER.isMyTurn,
      bypass: bypassTurnCheck,
      playerColor: window.MULTIPLAYER.playerColor,
      currentTurn: state.current,
      selectedPiece: selected?.piece?.meta
    });
    
    // Only block if in active multiplayer and not your turn (unless bypassing for opponent)
    if (inActiveMultiplayerGame && !window.MULTIPLAYER.isMyTurn && !bypassTurnCheck) {
      console.log('Multiplayer: Not your turn! Current turn:', state.current, 'Your color:', window.MULTIPLAYER.playerColor);
      return;
    }
    
    const piece = selected?.piece;
    console.log('Calling original commitPlacement for piece:', piece?.meta);
    originalCommitPlacement(q, r);
    
    // Only broadcast if in active multiplayer and this is the local player's action
    if (piece && inActiveMultiplayerGame && !bypassTurnCheck) {
      console.log('Broadcasting placement action for piece:', piece.meta);
      broadcastAction('place', piece, q, r);
    }
  };

  const originalCommitMove = window.commitMove;
  window.commitMove = function(q, r) {
    // Only enforce turn restrictions if in an active multiplayer game with another player
    const inActiveMultiplayerGame = window.MULTIPLAYER.enabled && 
                                   window.MULTIPLAYER.connected && 
                                   window.MULTIPLAYER.roomId;
    
    // Only block if in active multiplayer and not your turn (unless bypassing for opponent)
    if (inActiveMultiplayerGame && !window.MULTIPLAYER.isMyTurn && !bypassTurnCheck) {
      console.log('Multiplayer: Not your turn!');
      return;
    }
    
    const piece = selected?.piece;
    originalCommitMove(q, r);
    
    // Only broadcast if in active multiplayer and this is the local player's action
    if (piece && inActiveMultiplayerGame && !bypassTurnCheck) {
      broadcastAction('move', piece, q, r);
    }
  };

  // Wrap updateHUD to check turn status
  const originalUpdateHUD = window.updateHUD;
  window.updateHUD = function() {
    originalUpdateHUD();
    
    // Only update multiplayer HUD if in an active multiplayer game
    if (window.MULTIPLAYER.enabled && window.MULTIPLAYER.connected && window.MULTIPLAYER.roomId) {
      checkIfMyTurn();
      updateMultiplayerHUD();
    }
  };

  // Room management UI
  function createMultiplayerModal() {
    const modal = document.createElement('div');
    modal.id = 'multiplayer-modal';
    modal.style.cssText = `
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); z-index: 10000; align-items: center; justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: #2a2a2a; border-radius: 10px; padding: 30px; max-width: 500px; width: 90%;
      color: white; font-family: 'Milonga', serif; text-align: center; position: relative;
    `;
    
    content.innerHTML = `
      <button id="close-modal" style="position: absolute; top: 10px; right: 15px; background: none; border: none; color: #fff; font-size: 24px; cursor: pointer;">&times;</button>
      <h2 style="margin-top: 0; color: #E6B84D;">🌐 Multiplayer Game</h2>
      
      <div id="multiplayer-content">
        <div id="create-game-section">
          <p>Start a new multiplayer game and share the link with your friend!</p>
          <div id="server-status" style="margin: 10px 0; padding: 8px; border-radius: 4px; font-size: 14px;">
            <span id="server-status-text">Checking server...</span>
          </div>
          <button id="create-game-btn" style="background: #E6B84D; color: #000; border: none; padding: 12px 24px; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 10px;">
            🎮 Create New Game
          </button>
        </div>
        
        <div id="join-game-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #555;">
          <p>Or join an existing game:</p>
          <input type="text" id="room-code-input" placeholder="Enter room code" style="padding: 10px; border-radius: 5px; border: 1px solid #555; background: #333; color: white; margin-right: 10px; font-size: 16px;">
          <button id="join-game-btn" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px;">
            Join Game
          </button>
        </div>
        
        <div id="game-link-section" style="display: none; margin-top: 20px; padding: 20px; background: #333; border-radius: 5px;">
          <h3 style="color: #E6B84D; margin-top: 0;">Share This Link</h3>
          <div style="display: flex; align-items: center; margin: 15px 0;">
            <input type="text" id="share-link" readonly style="flex: 1; padding: 10px; border-radius: 5px; border: 1px solid #555; background: #222; color: white; font-family: monospace; font-size: 12px;">
            <button id="copy-link-btn" style="background: #2196F3; color: white; border: none; padding: 10px 15px; border-radius: 5px; margin-left: 10px; cursor: pointer;">
              📋 Copy
            </button>
          </div>
          <p style="font-size: 14px; color: #ccc; margin: 0;">Send this link to your friend to start playing together!</p>
          <div style="margin-top: 10px; padding: 8px; background: #444; border-radius: 3px; font-size: 12px; color: #aaa;">
            Room Code: <span id="room-code-display" style="font-family: monospace; color: #E6B84D; font-weight: bold;"></span>
          </div>
          <div id="connection-status" style="margin-top: 15px; padding: 10px; border-radius: 5px; background: #444;">
            <strong>Status:</strong> <span id="status-text">Waiting for opponent...</span>
            <div style="margin-top: 10px;">
              <button id="reset-game-btn" style="background: #FF6B6B; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 12px; margin-right: 10px;">🔄 Reset Game</button>
              <button id="leave-room-btn" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 12px;">🚪 Leave Room</button>
            </div>
          </div>
          
          <!-- Chat Section -->
          <div id="chat-section" style="margin-top: 20px; padding: 15px; background: #2a2a2a; border-radius: 5px; display: none;">
            <h4 style="color: #E6B84D; margin: 0 0 10px 0; font-size: 16px;">💬 Chat</h4>
            <div id="chat-messages" style="height: 150px; overflow-y: auto; background: #1a1a1a; border: 1px solid #555; border-radius: 3px; padding: 8px; margin-bottom: 10px; font-size: 12px; line-height: 1.4;"></div>
            <div style="display: flex; align-items: center;">
              <input type="text" id="chat-input" placeholder="Type a message..." maxlength="200" style="flex: 1; padding: 8px; border-radius: 3px; border: 1px solid #555; background: #333; color: white; font-size: 12px;">
              <button id="send-chat-btn" style="background: #4CAF50; color: white; border: none; padding: 8px 12px; border-radius: 3px; margin-left: 5px; cursor: pointer; font-size: 12px;">Send</button>
            </div>
            <div id="typing-indicator" style="height: 16px; font-size: 11px; color: #888; margin-top: 5px; font-style: italic;"></div>
          </div>
        </div>
      </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('close-modal').addEventListener('click', closeMultiplayerModal);
    document.getElementById('create-game-btn').addEventListener('click', createNewGame);
    document.getElementById('join-game-btn').addEventListener('click', joinExistingGame);
    document.getElementById('copy-link-btn').addEventListener('click', copyShareLink);
    document.getElementById('reset-game-btn').addEventListener('click', resetGame);
    document.getElementById('leave-room-btn').addEventListener('click', leaveRoom);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeMultiplayerModal();
    });
  }

  function showMultiplayerModal() {
    const modal = document.getElementById('multiplayer-modal');
    if (modal) {
      modal.style.display = 'flex';
      updateModalStatus();
    }
  }

  function closeMultiplayerModal() {
    const modal = document.getElementById('multiplayer-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  function createNewGame() {
    // Check if server is connected first
    if (!window.MULTIPLAYER.connected) {
      alert('Please start the backend server first!\n\nRun these commands:\ncd backend\nnpm install\nnpm run dev');
      return;
    }
    
    // Generate a friendly room code
    const roomCode = generateFriendlyRoomCode();
    
    // Build the shareable URL
    let gameUrl;
    const deployedServerUrl = 'https://hyvemynd-backend.onrender.com'; // Render deployment URL
    
    if (deployedServerUrl && deployedServerUrl !== 'YOUR_RENDER_SERVER_URL') {
      // Use deployed server URL for internet sharing
      gameUrl = `${deployedServerUrl}/#${roomCode}`;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Local development
      gameUrl = `http://localhost:3000/#${roomCode}`;
    } else {
      // Fallback
      gameUrl = `${window.location.protocol}//${window.location.host}/#${roomCode}`;
    }
    
    console.log('Generated game URL:', gameUrl);
    
    // Update current URL and join room
    window.location.hash = roomCode;
    joinRoom(roomCode);
    
    // Show the share link section
    const shareLinkInput = document.getElementById('share-link');
    if (shareLinkInput) {
      shareLinkInput.value = gameUrl;
      console.log('Set share link value:', gameUrl);
    }
    
    // Show the room code
    const roomCodeDisplay = document.getElementById('room-code-display');
    if (roomCodeDisplay) {
      roomCodeDisplay.textContent = roomCode;
    }
    
    const gameLinkSection = document.getElementById('game-link-section');
    if (gameLinkSection) {
      gameLinkSection.style.display = 'block';
    }
    
    updateModalStatus();
  }

  function joinExistingGame() {
    const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (roomCode) {
      window.location.hash = roomCode;
      joinRoom(roomCode);
      closeMultiplayerModal();
    }
  }

  function copyShareLink() {
    const linkInput = document.getElementById('share-link');
    if (!linkInput || !linkInput.value) {
      console.error('No share link to copy');
      return;
    }
    
    console.log('Copying link:', linkInput.value);
    
    // Modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(linkInput.value).then(() => {
        showCopySuccess();
      }).catch(err => {
        console.error('Failed to copy with modern API:', err);
        fallbackCopy();
      });
    } else {
      fallbackCopy();
    }
    
    function fallbackCopy() {
      try {
        linkInput.select();
        linkInput.setSelectionRange(0, 99999); // For mobile devices
        document.execCommand('copy');
        showCopySuccess();
      } catch (err) {
        console.error('Failed to copy link:', err);
        // Show the link for manual copying
        alert(`Copy this link manually:\n\n${linkInput.value}`);
      }
    }
    
    function showCopySuccess() {
      const copyBtn = document.getElementById('copy-link-btn');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ Copied!';
        copyBtn.style.background = '#4CAF50';
        
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.background = '#2196F3';
        }, 2000);
      }
    }
  }

  function generateFriendlyRoomCode() {
    // Generate a 6-character room code with letters and numbers (avoiding confusing characters)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function updateModalStatus() {
    const statusText = document.getElementById('status-text');
    const serverStatusText = document.getElementById('server-status-text');
    const serverStatus = document.getElementById('server-status');
    const createGameBtn = document.getElementById('create-game-btn');
    
    // Update server status
    if (serverStatusText && serverStatus) {
      if (window.MULTIPLAYER.connected) {
        serverStatusText.textContent = '✅ Server connected - Ready for multiplayer!';
        serverStatus.style.background = '#1a5f1a';
        serverStatus.style.color = '#90ee90';
        if (createGameBtn) createGameBtn.disabled = false;
      } else {
        serverStatusText.textContent = '❌ Server not running - Start backend server first';
        serverStatus.style.background = '#5f1a1a';
        serverStatus.style.color = '#ff9090';
        if (createGameBtn) createGameBtn.disabled = true;
      }
    }
    
    if (!statusText) return;
    
    if (window.MULTIPLAYER.enabled) {
      if (window.MULTIPLAYER.connected) {
        statusText.textContent = `Connected as ${window.MULTIPLAYER.playerColor} player`;
        statusText.style.color = '#4CAF50';
      } else {
        statusText.textContent = 'Connecting...';
        statusText.style.color = '#FFA500';
      }
    } else {
      statusText.textContent = 'Waiting for opponent...';
      statusText.style.color = '#ccc';
    }
  }

  // Join a multiplayer room
  function joinRoom(roomId) {
    if (!window.MULTIPLAYER.socket) {
      initMultiplayer();
    }
    
    window.MULTIPLAYER.socket.emit('join-room', {
      roomId,
      playerName: `Player ${Date.now() % 1000}`
    });
  }

  // Reset the game to initial state
  function resetGame() {
    if (!window.MULTIPLAYER.roomId || !window.MULTIPLAYER.socket) return;
    
    if (confirm('Reset the game for both players? This will clear the board and start over.')) {
      window.MULTIPLAYER.socket.emit('reset-game', {
        roomId: window.MULTIPLAYER.roomId
      });
    }
  }

  // Leave the current room
  function leaveRoom() {
    if (!window.MULTIPLAYER.roomId || !window.MULTIPLAYER.socket) return;
    
    if (confirm('Leave the game room? This will disconnect you from the multiplayer game.')) {
      window.MULTIPLAYER.socket.emit('leave-room', {
        roomId: window.MULTIPLAYER.roomId
      });
      
      // Reset local multiplayer state
      window.MULTIPLAYER.enabled = false;
      window.MULTIPLAYER.roomId = null;
      window.MULTIPLAYER.playerColor = null;
      window.MULTIPLAYER.connected = false;
      
      // Remove player indicator
      const indicator = document.getElementById('player-indicator');
      if (indicator) indicator.remove();
      
      // Hide chat
      window.ChatUI.hideChatButton();
      
      // Close modal
      closeMultiplayerModal();
      
      // Refresh page to reset game state
      window.location.reload();
    }
  }

  // Initialize on page load
  window.addEventListener('load', () => {
    console.log('Multiplayer script loaded - setting up modal and button');
    
    try {
      createMultiplayerModal();
      console.log('Multiplayer modal created successfully');
    } catch (error) {
      console.error('Error creating multiplayer modal:', error);
    }
    
    // Set up multiplayer button
    const multiplayerBtn = document.getElementById('multiplayer-button');
    console.log('Multiplayer button found:', multiplayerBtn);
    
    if (multiplayerBtn) {
      multiplayerBtn.addEventListener('click', () => {
        console.log('Multiplayer button clicked!');
        try {
          showMultiplayerModal();
          // Try to connect when modal opens
          if (!window.MULTIPLAYER.socket) {
            initMultiplayer();
          }
        } catch (error) {
          console.error('Error showing multiplayer modal:', error);
        }
      });
      console.log('Multiplayer button event listener attached');
    } else {
      console.error('Multiplayer button not found!');
    }
    
    // Auto-join if there's a room code in the URL
    let roomCode = window.location.hash.slice(1);
    if (roomCode) {
      // Auto-join the room after a short delay
      setTimeout(() => {
        initMultiplayer();
        setTimeout(() => joinRoom(roomCode), 500);
      }, 1000);
    }
  });

  // Chat functionality
  function showChatSection() {
    const chatSection = document.getElementById('chat-section');
    if (chatSection) {
      chatSection.style.display = 'block';
    }
  }

  function addChatMessage(data) {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;
    
    const messageEl = document.createElement('div');
    messageEl.style.cssText = 'margin-bottom: 5px; padding: 3px 0; border-bottom: 1px solid #333;';
    
    const time = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const colorClass = data.playerColor === 'white' ? '#E6B84D' : '#90CAF9';
    
    messageEl.innerHTML = `
      <span style="color: ${colorClass}; font-weight: bold;">${data.playerName}</span>
      <span style="color: #666; font-size: 10px; margin-left: 5px;">${time}</span><br>
      <span style="color: #ddd;">${escapeHtml(data.message)}</span>
    `;
    
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function addSystemMessage(message) {
    const messagesDiv = document.getElementById('chat-messages');
    if (!messagesDiv) return;
    
    const messageEl = document.createElement('div');
    messageEl.style.cssText = 'margin-bottom: 5px; padding: 3px; color: #888; font-style: italic; text-align: center; font-size: 11px;';
    messageEl.textContent = `• ${message} •`;
    
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input || !input.value.trim() || !window.MULTIPLAYER.roomId) return;
    
    window.MULTIPLAYER.socket.emit('chat-message', {
      roomId: window.MULTIPLAYER.roomId,
      message: input.value.trim()
    });
    
    input.value = '';
    stopTyping();
  }

  let typingTimeout;
  function startTyping() {
    if (typingTimeout) return; // Already typing
    
    window.MULTIPLAYER.socket.emit('player-typing', {
      roomId: window.MULTIPLAYER.roomId,
      isTyping: true
    });
    
    typingTimeout = setTimeout(stopTyping, 3000);
  }

  function stopTyping() {
    if (!typingTimeout) return;
    
    clearTimeout(typingTimeout);
    typingTimeout = null;
    
    window.MULTIPLAYER.socket.emit('player-typing', {
      roomId: window.MULTIPLAYER.roomId,
      isTyping: false
    });
  }

  function showTypingIndicator(data) {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;
    
    if (data.isTyping) {
      indicator.textContent = `${data.playerName} is typing...`;
    } else {
      indicator.textContent = '';
    }
  }

  function getLocalPlayerName() {
    // You could make this customizable later
    return `Player ${Date.now() % 1000}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Notifications system
  function showNotification(message, type = 'info') {
    // Create notification container if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10001;
        max-width: 300px; font-family: 'Milonga', serif;
      `;
      document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    const colors = {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
      info: '#2196F3',
      chat: '#9C27B0'
    };
    
    notification.style.cssText = `
      background: ${colors[type] || colors.info}; color: white; padding: 12px 16px;
      border-radius: 5px; margin-bottom: 10px; font-size: 14px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      transform: translateX(320px); transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Slide in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after 4 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(320px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  }

  // Set up chat event listeners when modal is created
  const originalCreateModal = createMultiplayerModal;
  createMultiplayerModal = function() {
    originalCreateModal();
    
    // Chat input listeners
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat-btn');
    
    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendChatMessage();
        } else {
          startTyping();
        }
      });
      
      chatInput.addEventListener('blur', stopTyping);
    }
    
    if (sendBtn) {
      sendBtn.addEventListener('click', sendChatMessage);
    }
  };

  // Chat UI System
  const ChatUI = (() => {
    let typingTimer;
    let isTyping = false;
    
    const chatContainer = document.getElementById('chat-container');
    const chatToggle = document.getElementById('chat-toggle');
    const chatClose = document.getElementById('chat-close');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatMessages = document.getElementById('chat-messages');
    const typingIndicator = document.getElementById('typing-indicator');

    function init() {
      if (!chatContainer) return;
      
      // Chat toggle button
      if (chatToggle) {
        chatToggle.addEventListener('click', show);
      }
      
      // Close button
      if (chatClose) {
        chatClose.addEventListener('click', hide);
      }
      
      // Send message
      if (chatSend) {
        chatSend.addEventListener('click', sendMessage);
      }
      
      // Enter to send
      if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            sendMessage();
          } else {
            startTyping();
          }
        });
        
        chatInput.addEventListener('input', startTyping);
        chatInput.addEventListener('blur', stopTyping);
      }
    }

    function show() {
      if (chatContainer) {
        chatContainer.style.display = 'flex';
      }
      if (chatToggle) {
        chatToggle.style.display = 'none';
      }
    }

    function hide() {
      if (chatContainer) {
        chatContainer.style.display = 'none';
      }
      if (chatToggle) {
        chatToggle.style.display = 'block';
      }
    }

    function sendMessage() {
      if (!chatInput || !window.MULTIPLAYER.socket || !window.MULTIPLAYER.roomId) return;
      
      const message = chatInput.value.trim();
      if (!message) return;
      
      window.MULTIPLAYER.socket.emit('chat-message', {
        roomId: window.MULTIPLAYER.roomId,
        message: message
      });
      
      chatInput.value = '';
      stopTyping();
    }

    function startTyping() {
      if (!isTyping && window.MULTIPLAYER.socket && window.MULTIPLAYER.roomId) {
        isTyping = true;
        window.MULTIPLAYER.socket.emit('player-typing', {
          roomId: window.MULTIPLAYER.roomId,
          isTyping: true
        });
      }
      
      clearTimeout(typingTimer);
      typingTimer = setTimeout(stopTyping, 1000);
    }

    function stopTyping() {
      if (isTyping && window.MULTIPLAYER.socket && window.MULTIPLAYER.roomId) {
        isTyping = false;
        window.MULTIPLAYER.socket.emit('player-typing', {
          roomId: window.MULTIPLAYER.roomId,
          isTyping: false
        });
      }
      clearTimeout(typingTimer);
    }

    function addMessage(data) {
      if (!chatMessages) return;
      
      const messageDiv = document.createElement('div');
      messageDiv.className = 'chat-message';
      
      if (data.isSystem) {
        messageDiv.className += ' chat-message-system';
        messageDiv.textContent = data.message;
      } else {
        const isMyMessage = data.playerColor === window.MULTIPLAYER.playerColor;
        messageDiv.className += ` chat-message-${data.playerColor}`;
        
        const time = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        messageDiv.innerHTML = `
          <span class="chat-player-name">${data.playerName}:</span>
          ${escapeHtml(data.message)}
          <span class="chat-timestamp">${time}</span>
        `;
      }
      
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTyping(data) {
      if (!typingIndicator) return;
      
      // Don't show typing indicator for own messages
      if (data.playerColor === window.MULTIPLAYER.playerColor) return;
      
      if (data.isTyping) {
        typingIndicator.textContent = `${data.playerName} is typing...`;
      } else {
        typingIndicator.textContent = '';
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function showChatButton() {
      if (chatToggle) {
        chatToggle.style.display = 'block';
      }
    }

    function hideChatButton() {
      if (chatToggle) {
        chatToggle.style.display = 'none';
      }
    }

    return {
      init,
      show,
      hide,
      addMessage,
      showTyping,
      showChatButton,
      hideChatButton
    };
  })();

  // Initialize chat when page loads
  window.addEventListener('load', () => {
    ChatUI.init();
  });

  // Export for global access
  window.initMultiplayer = initMultiplayer;
  window.joinRoom = joinRoom;
  window.showNotification = showNotification;
  window.ChatUI = ChatUI;
  window.showMultiplayerModal = showMultiplayerModal;
  window.createMultiplayerModal = createMultiplayerModal;
})();