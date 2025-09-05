// --- CONFIG ---
window.CELL_RADIUS = 38;

window.GRID_RADIUS = 4;
const DIRS = [
    {dq:1,dr:0},{dq:1,dr:-1},{dq:0,dr:-1},
    {dq:-1,dr:0},{dq:-1,dr:1},{dq:0,dr:1}
];

function isNearBorder(q, r) {
    return Math.abs(q) > GRID_RADIUS || Math.abs(r) > GRID_RADIUS;
}

const COLORS = { white:0xFFFFFF, black:0x000000 };
const THEME  = {
    boardFill: 0xC27B15,
    boardLine: 0x4B382A,
    boardShadowColor: 0xB0515,
    boardHighlightColor: 0xFFB3D,
    highlight: 0x8B3E20
};

const SETUP = [
    {key:'Q',count:1},
    {key:'A',count:3},
    {key:'G',count:3},
    {key:'B',count:2},
    {key:'S',count:2}
];

// --- STATE ---
let state = {
    current:'white',
    moveNumber:1,
    queenPlaced:{white:false,black:false},
    gameOver: false
};
let selected = null;
let legalZones = new Set();
let animating = false;
let clickSfx;
try {
    clickSfx = new Audio('https://cdn.jsdelivr.net/gh/irustm/pings/ping1.mp3');
} catch (e) {
    console.warn('Could not load sound file.');
    clickSfx = { play: () => {} };
}

// --- HUD ---
const hud = document.getElementById('hud');
function updateHUD(){
    // Check if current player has any legal moves
    if (hasLegalMoves(state.current)) {
        hud.textContent = state.current.charAt(0).toUpperCase()
                       + state.current.slice(1)
                       + ' to move (turn '+state.moveNumber+')';
    } else {
        // Current player has no legal moves - pass turn
        passTurn();
    }
}

function hasLegalMoves(color) {
    // Check if player can place any pieces
    const myPieces = tray.filter(p => p.meta.color === color && !p.meta.placed);
    if (myPieces.length > 0) {
        // Check if any piece can be legally placed
        for (const piece of myPieces) {
            const zones = legalPlacementZones(color);
            if (zones.size > 0) {
                return true; // Can place at least one piece
            }
        }
    }
    
    // Check if player can move any existing pieces
    const placedPieces = tray.filter(p => p.meta.color === color && p.meta.placed);
    for (const piece of placedPieces) {
        const moves = legalMoveZones(piece);
        if (moves.length > 0) {
            return true; // Can move at least one piece
        }
    }
    
    return false; // No legal moves available
}

function passTurn() {
    console.log(`${state.current} has no legal moves - passing turn`);
    
    // Add pass entry to history
    try {
        const list = document.getElementById('moves-list');
        if (list) {
            const li = document.createElement('li');
            li.className = 'history-entry';
            const moveNum = state.moveNumber;
            const txt = document.createElement('div');
            txt.className = 'move-text';
            txt.style.fontStyle = 'italic';
            txt.style.color = '#888';
            txt.textContent = `${moveNum}. ${state.current} pass (no legal moves)`;
            li.appendChild(txt);
            list.appendChild(li);
            
            // Auto-scroll to bottom
            const historyPanel = document.getElementById('move-history');
            if (historyPanel) {
                historyPanel.scrollTop = historyPanel.scrollHeight;
            }
        }
    } catch (e) {
        console.warn('pass turn history update failed', e);
    }
    
    // Switch turns
    state.moveNumber++;
    state.current = state.current === 'white' ? 'black' : 'white';
    
    // Check if the new current player also has no moves (potential game end)
    setTimeout(() => {
        updateHUD(); // This will recursively check the new player
    }, 100);
}

function clearHighlights(){
    legalZones.forEach(k=>{
        const c=cells.get(k);
        if(c) c.gfx.tint = 0xFFFFFF;
    });
    legalZones.clear();
}

// --- PLACEMENT LOGIC ---
function selectPlacement(piece){
    clearHighlights();
    selected = {piece, mode:'place'};
    legalPlacementZones(piece.meta.color).forEach(k=>{
        const c = cells.get(k);
        if(c){ c.gfx.tint = THEME.highlight; legalZones.add(k); }
    });
    clickSfx.play().catch(()=>{});
}

function legalPlacementZones(color){
    const placed=tray.filter(p=>p.meta.placed);
    const my=placed.filter(p=>p.meta.color===color);
    const occ=new Set(placed.map(p=>`${p.meta.q},${p.meta.r}`));
    const zones=new Set();

    // Queen by turn 4
    const turn = Math.ceil(state.moveNumber / 2);
    if(!state.queenPlaced[color] && turn === 4){
        if(selected.piece.meta.key!=='Q') return zones;
    }

    if(placed.length===0){
        zones.add('0,0');
        return zones;
    }

    // first piece of this color must touch an opponent
    if(my.length===0){
        placed.forEach(p=>{
            if(p.meta.color!==color) DIRS.forEach(d=>{
                const k=`${p.meta.q+d.dq},${p.meta.r+d.dr}`;
                if(cells.has(k)&&!occ.has(k)) zones.add(k);
            });
        });
        return zones;
    }

    // general rule: neighbor to own, no neighbor to opp
    my.forEach(p=>{
        DIRS.forEach(d=>{
            const x=p.meta.q+d.dq, y=p.meta.r+d.dr, k=`${x},${y}`;
            if(!cells.has(k)||occ.has(k)) return;
            const bad=DIRS.some(d2=>{
                const nkey=`${x+d2.dq},${y+d2.dr}`;
                const nc=cells.get(nkey);
                if(!nc||nc.stack.length===0) return false;
                return nc.stack[nc.stack.length-1].meta.color!==color;
            });
            if(!bad) zones.add(k);
        });
    });
    return zones;
}

function commitPlacement(q,r){
    const p = selected.piece; // Move piece reference to function scope
    if (!isNearBorder(q,r)) {
        animating=true;
        p.meta.placed = true;
        p.meta.q = q; p.meta.r = r;
        if(p.meta.key==='Q') state.queenPlaced[p.meta.color] = true;

        const cell = cells.get(`${q},${r}`);
        cell.stack.push(p);
        const base=axialToPixel(q,r);
        cell.stack.forEach((c,i)=>{
            c.x = base.x;
            c.y = base.y - i*6;
            pieceLayer.setChildIndex(c,
                pieceLayer.children.length - cell.stack.length + i
            );
        });

        animating=false;
        state.moveNumber++;
        state.current = state.current==='white'?'black':'white';
        updateHUD();
    }
    // win check: check both players for surrounded queens
    const winner = checkForWinner();
    if (winner) {
        state.gameOver = true;
        setTimeout(() => {
            const banner = window.winBanner;
            if (banner) {
                if (winner === 'DRAW') {
                    banner.text = `GAME OVER - DRAW!`;
                } else {
                    banner.text = `GAME OVER - ${winner.toUpperCase()} WINS!`;
                }
                banner.visible = true;
            } else {
                console.log(`GAME OVER - ${winner === 'DRAW' ? 'DRAW' : winner.toUpperCase() + ' WINS'}!`);
                alert(`GAME OVER - ${winner === 'DRAW' ? 'DRAW' : winner.toUpperCase() + ' WINS'}!`);
            }
        }, 100);
    }
    // update move history UI (use p which is the placed piece)
    try{
        const list = document.getElementById('moves-list');
        if(list){
            const li = document.createElement('li');
            li.className = 'history-entry';
            const mini = buildMiniPathSVG([[q,r]]); // single dot for placement
            const label = labelFromCenter(q,r);
            const moveNum = Math.max(1, state.moveNumber - 1);
            const txt = document.createElement('div'); txt.className='move-text';
            txt.textContent = `${moveNum}. ${p.meta.color} ${p.meta.key} placed at ${q},${r} (${label})`;
            li.appendChild(mini);
            li.appendChild(txt);
            li.addEventListener('mouseenter', ()=> showOrientationOverlay(q,r));
            li.addEventListener('mouseleave', ()=> hideOrientationOverlay());
            list.appendChild(li);
            
            // Auto-scroll to bottom to show latest move
            const historyPanel = document.getElementById('move-history');
            if(historyPanel) {
                historyPanel.scrollTop = historyPanel.scrollHeight;
            }
        }
    }catch(e){console.warn('move history update failed', e);} 

    clearHighlights();
    layoutTray(app);
    selected = null;
    clickSfx.play().catch(()=>{});
}

function checkSurrounded(color) {
    console.log(`Checking if ${color} queen is surrounded...`);
    const queen = tray.find(p =>
        p.meta.key === 'Q' &&
        p.meta.color === color &&
        p.meta.placed
    );
    if (!queen) {
        console.log('Queen not found on board.');
        return false;
    }

    const { q, r } = queen.meta;
    console.log(`Queen found at ${q},${r}`);
    return DIRS.every(d => {
        const key = `${q + d.dq},${r + d.dr}`;
        const cell = cells.get(key);
        const isOccupied = cell && cell.stack.length > 0;
        console.log(`  Checking neighbor ${key}: ${isOccupied ? 'Occupied' : 'Empty'}`);
        return isOccupied;
    });
}

function checkForWinner() {
    const whiteSurrounded = checkSurrounded('white');
    const blackSurrounded = checkSurrounded('black');
    
    // Both queens surrounded = draw (rules say game is drawn in this case)
    if (whiteSurrounded && blackSurrounded) {
        return 'DRAW';
    }
    
    // One queen surrounded = opposite color wins
    if (whiteSurrounded) return 'black';
    if (blackSurrounded) return 'white';
    
    // No one surrounded = game continues
    return null;
}

// --- MOVE LOGIC ---
function selectMove(piece) {
    console.log('--- SELECT MOVE ---');
    if (!state.queenPlaced[piece.meta.color]) return;

    if (selected && selected.piece === piece) {
        clearHighlights();
        selected = null;
        tray.forEach(p => p.interactive = true);
        clickSfx.play().catch(() => {});
        return;
    }

    clearHighlights();
    selected = { piece, mode: 'move' };

    const moves = legalMoveZones(piece);
    if (moves.length === 0) {
        selected = null;
        tray.forEach(p => p.interactive = true);
        clickSfx.play().catch(() => {});
        return;
    }

    tray.forEach(p => { if (p !== piece) p.interactive = false; });
    moves.forEach(k => {
        const c = cells.get(k);
        if (c) {
            c.gfx.tint = THEME.highlight;
            legalZones.add(k);
        }
    });
    clickSfx.play().catch(() => {});
}

function isHiveConnected(set){
    if(set.size<2) return true;
    const arr=Array.from(set),
            seen=new Set([arr[0]]),
            q=[arr[0]];
    while(q.length){
        const cur=q.shift(),
              [x,y]=cur.split(',').map(Number);
        DIRS.forEach(d=>{
            const nb=`${x+d.dq},${y+d.dr}`;
            if(set.has(nb)&&!seen.has(nb)){
                seen.add(nb);
                q.push(nb);
            }
        });
    }
    return seen.size===set.size;
}

// simulate removing a piece at (fx,fr) and placing it at (tx,tr)
// return true if the resulting occupied tile set remains connected
function wouldHiveRemainConnectedAfterMove(fx,fr,tx,tr){
    const fromKey = `${fx},${fr}`;
    const toKey = `${tx},${tr}`;
    const occ = new Set();
    // build occupancy from actual cell stacks
    cells.forEach((c, key) => { if (c && c.stack && c.stack.length > 0) occ.add(key); });
    const fromCell = cells.get(fromKey);
    // simulate removal: if the origin cell becomes empty, delete it
    if (!fromCell || !fromCell.stack || fromCell.stack.length <= 1) {
        occ.delete(fromKey);
    }
    // simulate placement: if destination was empty, add it
    const toCell = cells.get(toKey);
    if (!toCell || !toCell.stack || toCell.stack.length === 0) {
        occ.add(toKey);
    }
    return isHiveConnected(occ);
}

function canSlide(fx,fr,tx,tr,occ){
    const dq=tx-fx, dr=tr-fr;
    const idx=DIRS.findIndex(d=>d.dq===dq&&d.dr===dr);
    const i1=(idx+5)%6, i2=(idx+1)%6;
    const s1=`${fx+DIRS[i1].dq},${fr+DIRS[i1].dr}`,
            s2=`${fx+DIRS[i2].dq},${fr+DIRS[i2].dr}`;
    return !(occ.has(s1)&&occ.has(s2));
}

function hiveIntactAfterRemoval(q, r) {
    const k = `${q},${r}`;
    const cell = cells.get(k);
    // if origin cell is empty, nothing to remove
    if (!cell || !cell.stack || cell.stack.length === 0) return true;
    // build occupancy from actual cell stacks so stacking is respected
    const occ = new Set();
    cells.forEach((c, key) => {
        if (c && c.stack && c.stack.length > 0) occ.add(key);
    });
    // simulate removal: if the origin cell only had one piece, it becomes empty
    if (cell.stack.length === 1) occ.delete(k);
    return isHiveConnected(occ);
}

function legalMoveZones(piece){
    const type=piece.meta.key,
            q0=piece.meta.q,
            r0=piece.meta.r;
    // build occupancy from actual cell stacks so stacking is respected
    const occAll = new Set();
    cells.forEach((c, key) => { if (c && c.stack && c.stack.length > 0) occAll.add(key); });
    const occRem = new Set(occAll);
    // simulate removal: only delete the origin key if it will become empty
    const originKey = `${q0},${r0}`;
    const originCell = cells.get(originKey);
    if (!originCell || !originCell.stack || originCell.stack.length <= 1) {
        occRem.delete(originKey);
    }

    if(!hiveIntactAfterRemoval(q0, r0)) return [];

    const zones=new Set();

    if(type==='B'){
        DIRS.forEach(d=>{
            const x=q0+d.dq, y=r0+d.dr, k=`${x},${y}`;
            if(cells.has(k) && wouldHiveRemainConnectedAfterMove(q0,r0,x,y)) zones.add(k);
        });
    }
    else if(type==='Q'){
        DIRS.forEach(d=>{
            const x=q0+d.dq, y=r0+d.dr, k=`${x},${y}`;
            if(cells.has(k)
               && !occAll.has(k)
               && canSlide(q0,r0,x,y,occRem)
               && wouldHiveRemainConnectedAfterMove(q0,r0,x,y)
            ) zones.add(k);
        });
    }
    else if(type==='G'){
        DIRS.forEach(d=>{
            let x=q0+d.dq, y=r0+d.dr, jumped=0;
            while(occAll.has(`${x},${y}`)){
                jumped++;
                x+=d.dq; y+=d.dr;
            }
            const k=`${x},${y}`;
            if(jumped>0 && cells.has(k) && !occAll.has(k) && wouldHiveRemainConnectedAfterMove(q0,r0,x,y)) zones.add(k);
        });
    }
    else if(type==='A'){
        const queue=[[q0,r0]], vis=new Set();
        while(queue.length){
            const [cx,cy]=queue.shift();
            DIRS.forEach(d=>{
                const nx=cx+d.dq, ny=cy+d.dr, k=`${nx},${ny}`;
                if(!cells.has(k)
                   || occRem.has(k)
                   || vis.has(k)
                   || !canSlide(cx,cy,nx,ny,occRem)
                ) return;
                // ensure making this move would not break the hive
                if(!wouldHiveRemainConnectedAfterMove(q0,r0,nx,ny)) return;
                vis.add(k);
                queue.push([nx,ny]);
                zones.add(k);
            });
        }
    }
    else if(type==='S'){
        return getSpiderMoves(q0, r0);
    }

    return Array.from(zones);
}

function getSpiderMoves(q0, r0) {
    // Spider must move exactly 3 slides along the hive perimeter (CW or CCW).
    // Strategy:
    // 1) Ensure hive remains connected after removal.
    // 2) Collect perimeter empty hexes (adjacent to any occupied hex).
    // 3) Order perimeter hexes around the hive centroid (angle sort).
    // 4) For each perimeter neighbor adjacent to the origin, compute the
    //    +3 and -3 indices along the ordered ring and validate the three
    //    slide steps with canSlide and touching-hive checks.

    if (!hiveIntactAfterRemoval(q0, r0)) return [];

    const startKey = `${q0},${r0}`;
    const cell = cells.get(startKey);
    // build occRem from current cells and simulate removal of the spider piece
    const occAll = new Set();
    cells.forEach((c, key) => { if (c && c.stack && c.stack.length > 0) occAll.add(key); });
    const occRem = new Set(occAll);
    if (!cell || !cell.stack || cell.stack.length <= 1) {
        occRem.delete(startKey);
    }

    // collect perimeter candidates: empty cells adjacent to occRem
    const perimeter = new Map(); // key -> {q,r,x,y}
    let cx = 0, cy = 0, count = 0;
    occRem.forEach(k => {
        const [oq,or] = k.split(',').map(Number);
        const pt = axialToPixel(oq,or);
        cx += pt.x; cy += pt.y; count++;
    });
    if(count===0) return [];
    cx /= count; cy /= count;

    occRem.forEach(k=>{}); // no-op to keep parity

    // build perimeter set
    occRem.forEach(k=>{});
    occRem.forEach(o => {});

    // iterate neighborhood around occupied cells
    occRem.forEach(k => {
        const [oq,or] = k.split(',').map(Number);
        DIRS.forEach(d => {
            const nq = oq + d.dq, nr = or + d.dr;
            const nk = `${nq},${nr}`;
            if(!cells.has(nk)) return;
            if(occRem.has(nk)) return;
            // ensure it touches hive (by virtue of adjacency above)
            if(!perimeter.has(nk)){
                const p = axialToPixel(nq,nr);
                perimeter.set(nk, {q:nq,r:nr,x:p.x,y:p.y});
            }
        });
    });

    if(perimeter.size===0) return [];

    // sort by angle around centroid
    const arr = Array.from(perimeter.entries()).map(([k,v])=>{
        const angle = Math.atan2(v.y - cy, v.x - cx);
        return {key:k, angle, ...v};
    });
    arr.sort((a,b)=>a.angle - b.angle);
    const ring = arr.map(a=>a.key);

    // helper to verify a 3-step walk along the ring starting at index and stepDir
    function validateWalkFrom(startIdx, stepDir){
        const n = ring.length;
        let curQ = q0, curR = r0;
        for(let s=1;s<=3;s++){
            // first step should be the originNeighbor (startIdx), then startIdx+stepDir, etc.
            const idx = (startIdx + (s-1)*stepDir + n) % n;
            const [nx,ny] = ring[idx].split(',').map(Number);
            // step must be to an adjacent hex
            const neigh = DIRS.some(d=>curQ + d.dq === nx && curR + d.dr === ny);
            if(!neigh) return null;
            if(!canSlide(curQ,curR,nx,ny,occRem)) return null;
            // next hex must touch hive
            if(!DIRS.some(d=>occRem.has(`${nx + d.dq},${ny + d.dr}`))) return null;
            curQ = nx; curR = ny;
        }
        return `${curQ},${curR}`;
    }

    // find perimeter neighbors that touch the origin
    const originNeighbors = [];
    for(let i=0;i<DIRS.length;i++){
        const nx = q0 + DIRS[i].dq, ny = r0 + DIRS[i].dr;
        const k = `${nx},${ny}`;
        if(perimeter.has(k)) originNeighbors.push(k);
    }

    const endpoints = new Set();
    const n = ring.length;

    // Try each origin neighbor as a start; pick the first start that yields
    // a valid 3-step walk in each direction. This ensures the spider 'hugs'
    // the hive and never backtracks.
    let found = { cw: null, ccw: null, startIdxCW: null, startIdxCCW: null };
    for(const startKey of originNeighbors){
        const startIdx = ring.indexOf(startKey);
        if(startIdx === -1) continue;
        if(!found.ccw){
            const ep = validateWalkFrom(startIdx, +1);
            if(ep){ found.ccw = ep; found.startIdxCCW = startIdx; endpoints.add(ep); }
        }
        if(!found.cw){
            const ep = validateWalkFrom(startIdx, -1);
            if(ep){ found.cw = ep; found.startIdxCW = startIdx; endpoints.add(ep); }
        }
        if(found.cw && found.ccw) break;
    }

    function finalFromStart(startIdx, stepDir){
        let last = null;
        for(let s=1;s<=3;s++){
            const idx = (startIdx + (s-1)*stepDir + n) % n;
            last = ring[idx];
        }
        return last;
    }

    // If only one direction had a strict path, include the theoretical
    // opposite endpoint computed from that working start index so both
    // directions are shown when the spider is not trapped.
    if(found.cw && !found.ccw && found.startIdxCW !== null){
        endpoints.add(finalFromStart(found.startIdxCW, +1));
    }
    if(found.ccw && !found.cw && found.startIdxCCW !== null){
        endpoints.add(finalFromStart(found.startIdxCCW, -1));
    }

    // Fallback: if endpoints empty, try original neighbor-index walker as a last resort
    if(endpoints.size===0){
        // previous simple walker: try starting at any adjacent empty cell and step by neighbor index
        function neighborIndex(fromQ, fromR, toQ, toR){
            for(let i=0;i<DIRS.length;i++){
                if(fromQ+DIRS[i].dq===toQ && fromR+DIRS[i].dr===toR) return i;
            }
            return -1;
        }
        function walkDirection(dirStep){
            let q=q0, r=r0;
            // find any neighbor index that touches the hive
            let startIdx = -1;
            for(let i=0;i<6;i++){
                const nx = q + DIRS[i].dq, ny = r + DIRS[i].dr;
                const k = `${nx},${ny}`;
                if(!cells.has(k) || occRem.has(k)) continue;
                if(DIRS.some(d=>occRem.has(`${nx + d.dq},${ny + d.dr}`))){ startIdx = i; break; }
            }
            if(startIdx === -1) return null;
            let idx = startIdx;
            for(let step=0; step<3; step++){
                idx = (idx + dirStep + 6) % 6;
                const nx = q + DIRS[idx].dq, ny = r + DIRS[idx].dr;
                const k = `${nx},${ny}`;
                if(!cells.has(k) || occRem.has(k)) return null;
                if(!canSlide(q,r,nx,ny,occRem)) return null;
                if(!DIRS.some(d=>occRem.has(`${nx + d.dq},${ny + d.dr}`))) return null;
                const common = DIRS.some(d2=>{
                    const a = `${q + d2.dq},${r + d2.dr}`;
                    const b = `${nx + d2.dq},${ny + d2.dr}`;
                    return occRem.has(a) && occRem.has(b);
                });
                if(!common) return null;
                q = nx; r = ny;
            }
            return `${q},${r}`;
        }
        const cw = walkDirection(+1);
        const ccw = walkDirection(-1);
        if(cw) endpoints.add(cw);
        if(ccw) endpoints.add(ccw);
    }

    // For compatibility, prefer validated endpoints from getSpiderPaths
    const paths = getSpiderPaths(q0, r0);
    if(paths && paths.length) return paths.map(p=>`${p[p.length-1][0]},${p[p.length-1][1]}`);
    return Array.from(endpoints);
}

// Return exact validated 3-step spider paths (array of arrays of [q,r]).
function getSpiderPaths(q0, r0, occAllParam){
    // occAllParam: optional Set of occupied keys representing board state before move
    const startKey = `${q0},${r0}`;
    let occAll;
    if (occAllParam) {
        occAll = new Set(occAllParam);
    } else {
        // build occupancy from actual cell stacks like other functions
        occAll = new Set();
        cells.forEach((c, key) => { if (c && c.stack && c.stack.length > 0) occAll.add(key); });
    }
    // remove the spider itself (it must move)
    occAll.delete(startKey);
    if(!isHiveConnected(occAll)) return [];

    const occRem = new Set(occAll);

    // collect perimeter empty hexes
    const perimeter = new Map();
    let cx=0, cy=0, count=0;
    occRem.forEach(k=>{
        const [oq,or] = k.split(',').map(Number);
        const p = axialToPixel(oq,or); cx += p.x; cy += p.y; count++;
    });
    if(count===0) return [];
    cx/=count; cy/=count;
    occRem.forEach(k=>{
        const [oq,or] = k.split(',').map(Number);
        DIRS.forEach(d=>{
            const nq=oq+d.dq, nr=or+d.dr, nk=`${nq},${nr}`;
            if(!cells.has(nk)) return; if(occRem.has(nk)) return;
            if(!perimeter.has(nk)) perimeter.set(nk, {q:nq,r:nr,x:axialToPixel(nq,nr).x,y:axialToPixel(nq,nr).y});
        });
    });
    if(perimeter.size===0) return [];
    const arr = Array.from(perimeter.entries()).map(([k,v])=>{ const angle=Math.atan2(v.y-cy, v.x-cx); return {key:k,angle,...v}; });
    arr.sort((a,b)=>a.angle-b.angle);
    const ring = arr.map(a=>a.key);

    const n = ring.length;
    function buildPathFrom(startIdx, stepDir){
        let curQ=q0, curR=r0;
        const path=[[curQ,curR]];
        const visited = new Set([`${curQ},${curR}`]);
        for(let s=1;s<=3;s++){
            const idx = (startIdx + (s-1)*stepDir + n) % n;
            const [nx,ny] = ring[idx].split(',').map(Number);
            const key = `${nx},${ny}`;
            // must be adjacent
            if(!DIRS.some(d=>curQ + d.dq === nx && curR + d.dr === ny)) return null;
            // cannot revisit a previously visited hex (no backtracking)
            if(visited.has(key)) return null;
            if(!canSlide(curQ,curR,nx,ny,occRem)) return null;
            if(!DIRS.some(d=>occRem.has(`${nx + d.dq},${ny + d.dr}`))) return null;
            path.push([nx,ny]); visited.add(key); curQ=nx; curR=ny;
        }
        return path;
    }

    // find origin neighbors on perimeter
    const originNeighbors=[];
    for(let i=0;i<DIRS.length;i++){ const nx=q0+DIRS[i].dq, ny=r0+DIRS[i].dr, k=`${nx},${ny}`; if(perimeter.has(k)) originNeighbors.push(k); }

    const paths = [];
    let found={cw:null,ccw:null,startIdxCW:null,startIdxCCW:null};
    for(const sk of originNeighbors){
        const startIdx = ring.indexOf(sk); if(startIdx===-1) continue;
        if(!found.ccw){ const pth = buildPathFrom(startIdx, +1); if(pth){ paths.push(pth); found.ccw=pth; found.startIdxCCW=startIdx; }}
        if(!found.cw){ const pth = buildPathFrom(startIdx, -1); if(pth){ paths.push(pth); found.cw=pth; found.startIdxCW=startIdx; }}
        if(found.cw && found.ccw) break;
    }

    function finalFromStartPath(startIdx, stepDir){
        const path = [[q0,r0]];
        for(let s=1;s<=3;s++){ const idx=(startIdx + (s-1)*stepDir + n)%n; const [nx,ny]=ring[idx].split(',').map(Number); path.push([nx,ny]); }
        return path;
    }

    if(found.cw && !found.ccw && found.startIdxCW!==null){ paths.push(finalFromStartPath(found.startIdxCW,+1)); }
    if(found.ccw && !found.cw && found.startIdxCCW!==null){ paths.push(finalFromStartPath(found.startIdxCCW,-1)); }

    return paths;
}

function commitMove(q,r){
    animating=true;
    const p=selected.piece;
    // capture occupancy prior to move (includes the moving piece at its old position)
    const occBefore = new Set(tray.filter(p2=>p2.meta.placed).map(p2=>`${p2.meta.q},${p2.meta.r}`));
    const oldKey=`${p.meta.q},${p.meta.r}`,
            oldCell=cells.get(oldKey);
    const ix=oldCell.stack.indexOf(p);
    if(ix>=0) oldCell.stack.splice(ix,1);

    oldCell.stack.forEach((c,i)=>{
        const rel=axialToPixel(oldCell.q,oldCell.r);
        c.x = rel.x;
        c.y = rel.y - i*6;
    });

    const cell=cells.get(`${q},${r}`);
    cell.stack.push(p);
    const rel=axialToPixel(q,r);

    gsap.to(p, {
        x: rel.x,
        y: rel.y - (cell.stack.length - 1) * 6,
        duration: 0.5,
        onComplete: () => {
            cell.stack.forEach((c,i)=>{
                c.x = rel.x;
                c.y = rel.y - i*6;
                pieceLayer.setChildIndex(c,
                    pieceLayer.children.length-cell.stack.length+i
                );
            });

            p.meta.q=q; p.meta.r=r;

            animating=false;
            state.moveNumber++;
            state.current = state.current==='white'?'black':'white';
            updateHUD();

            const winner = checkForWinner();
            if (winner) {
                state.gameOver = true;
                setTimeout(() => {
                    const banner = window.winBanner;
                    if (banner) {
                        if (winner === 'DRAW') {
                            banner.text = `GAME OVER - DRAW!`;
                        } else {
                            banner.text = `GAME OVER - ${winner.toUpperCase()} WINS!`;
                        }
                        banner.visible = true;
                    } else {
                        console.log(`GAME OVER - ${winner === 'DRAW' ? 'DRAW' : winner.toUpperCase() + ' WINS'}!`);
                        alert(`GAME OVER - ${winner === 'DRAW' ? 'DRAW' : winner.toUpperCase() + ' WINS'}!`);
                    }
                }, 100);
            }

            clearHighlights();
            selected = null;
            tray.forEach(p2=>p2.interactive = true);
            clickSfx.play().catch(()=>{});

            // add to move history
            try{
                const list = document.getElementById('moves-list');
                if(list){
                    const li = document.createElement('li');
                    li.className = 'history-entry';
                    let mini, txt;
                    const moveNum = Math.max(1, state.moveNumber - 1);
                    if(p.meta.key === 'S'){
                        // attempt to get exact validated 3-step spider path using board occupancy before the move
                        const start = oldKey.split(',').map(Number);
                        const exactPaths = getSpiderPaths(start[0], start[1], occBefore);
                        let path = null;
                        if(exactPaths && exactPaths.length){
                            // prefer the path that ends at the moved-to coordinate if present
                            for(const pth of exactPaths){
                                const last = pth[pth.length-1];
                                if(last[0]===q && last[1]===r){ path = pth; break; }
                            }
                            // otherwise just pick the first exact path
                            if(!path) path = exactPaths[0];
                        }
                        if(!path){
                            // fallback: approximate stepwise path from old to new
                            const end = [q,r];
                            const steps = pathStepsBetween(start[0], start[1], end[0], end[1]);
                            path = [[start[0],start[1]], ...steps.slice(0,3)];
                        }
                        mini = buildMiniPathSVG(path);
                        const stepLabels = path.map(([aq,ar],i)=>{
                            if(i===0) return null;
                            const prev = path[i-1];
                            return directionLabelFromDelta(aq - prev[0], ar - prev[1]);
                        }).filter(Boolean).join(',');
                        txt = document.createElement('div'); txt.className='move-text';
                        txt.textContent = `${moveNum}. ${p.meta.color} ${p.meta.key} ${oldKey} → ${q},${r} [${stepLabels}]`;
                    } else {
                        mini = buildMiniPathSVG([[q,r]]);
                        txt = document.createElement('div'); txt.className='move-text';
                        txt.textContent = `${moveNum}. ${p.meta.color} ${p.meta.key} ${oldKey} → ${q},${r}`;
                    }
                    li.appendChild(mini);
                    li.appendChild(txt);
                    li.addEventListener('mouseenter', ()=> showOrientationOverlay(p.meta.q, p.meta.r));
                    li.addEventListener('mouseleave', ()=> hideOrientationOverlay());
                    list.appendChild(li);
                    
                    // Auto-scroll to bottom to show latest move
                    const historyPanel = document.getElementById('move-history');
                    if(historyPanel) {
                        historyPanel.scrollTop = historyPanel.scrollHeight;
                    }
                }
            }catch(e){console.warn('move history update failed', e);} 
        }
    });
}

// Build a tiny SVG visual showing a path (array of [q,r]) scaled to mini box
function buildMiniPathSVG(path){
    const ns = 'http://www.w3.org/2000/svg';
    const w=72,h=32;
    const svg = document.createElementNS(ns,'svg');
    svg.setAttribute('width',w); svg.setAttribute('height',h);
    svg.className = 'mini-path';
    // map axial to local x,y in the mini box
    const pts = path.map(([q,r])=>{
        const p = axialToPixel(q,r);
        return {x:p.x, y:p.y};
    });
    // normalize
    const minx = Math.min(...pts.map(p=>p.x)), maxx = Math.max(...pts.map(p=>p.x));
    const miny = Math.min(...pts.map(p=>p.y)), maxy = Math.max(...pts.map(p=>p.y));
    const pad = 6;
    const spanx = Math.max(1, maxx-minx), spany = Math.max(1, maxy-miny);
    pts.forEach((p,i)=>{
        const nx = pad + ((p.x-minx)/spanx)*(w-2*pad);
        const ny = pad + ((p.y-miny)/spany)*(h-2*pad);
        if(i>0){
            const prev = pts[i-1];
            const px = pad + ((prev.x-minx)/spanx)*(w-2*pad);
            const py = pad + ((prev.y-miny)/spany)*(h-2*pad);
            const line = document.createElementNS(ns,'line');
            line.setAttribute('x1',px); line.setAttribute('y1',py);
            line.setAttribute('x2',nx); line.setAttribute('y2',ny);
            line.setAttribute('stroke','rgba(255,255,255,0.6)'); line.setAttribute('stroke-width','2');
            svg.appendChild(line);
        }
        const circ = document.createElementNS(ns,'circle');
        circ.setAttribute('cx',nx); circ.setAttribute('cy',ny); circ.setAttribute('r',3);
        circ.setAttribute('fill','rgba(255,255,255,0.9)'); svg.appendChild(circ);
    });
    return svg;
}

// Simple straight-line splitter for path fallback: returns start, mid, end as q,r arrays
function computeStraightPath(startKey, endKey){
    const [sq,sr]=startKey.split(',').map(Number);
    const [eq,er]=endKey.split(',').map(Number);
    // try to divide into 3 steps by linear interpolation on cube coords
    const a = axialToCube(sq,sr), b = axialToCube(eq,er);
    const res = [];
    for(let t=0;t<=3;t++){
        const x = Math.round(lerp(a.x,b.x,t/3));
        const y = Math.round(lerp(a.y,b.y,t/3));
        const z = -x-y;
        const axial = cubeToAxial(x,y,z);
        res.push(axial);
    }
    return res;
}
function lerp(a,b,t){ return a + (b-a)*t; }
function axialToCube(q,r){ const x=q, z=r, y=-x-z; return {x,y,z}; }
function cubeToAxial(x,y,z){ return [x,z]; }

// orientation overlay helpers
function showOrientationOverlay(q,r){
    const el = document.getElementById('hex-orient-overlay');
    if(!el) return;
    // build simple SVG showing N,NE,SE,S,SW,NW around center
    el.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns,'svg');
    svg.setAttribute('width',160); svg.setAttribute('height',160);
    const cx = 80, cy = 80, R = 48;
    const circle = document.createElementNS(ns,'circle');
    circle.setAttribute('cx',cx); circle.setAttribute('cy',cy); circle.setAttribute('r',56);
    svg.appendChild(circle);
    const labels = [['N',0,-1],['NE',1,-1],['SE',1,0],['S',0,1],['SW',-1,1],['NW',-1,0]];
    labels.forEach(([lab,dq,dr],i)=>{
        const ang = -Math.PI/2 + i*(Math.PI/3);
        const x = cx + Math.cos(ang)*R;
        const y = cy + Math.sin(ang)*R;
        const t = document.createElementNS(ns,'text');
        t.setAttribute('x', x); t.setAttribute('y', y+4);
        t.setAttribute('text-anchor','middle');
        t.textContent = lab;
        svg.appendChild(t);
    });
    el.appendChild(svg);
    el.style.display = 'block';
}
function hideOrientationOverlay(){ const el=document.getElementById('hex-orient-overlay'); if(el) el.style.display='none'; }

// Direction label helpers
const LABEL_DIRS = [
    {label:'N', dq:0, dr:-1},
    {label:'NE', dq:1, dr:-1},
    {label:'SE', dq:1, dr:0},
    {label:'S', dq:0, dr:1},
    {label:'SW', dq:-1, dr:1},
    {label:'NW', dq:-1, dr:0}
];

function directionLabelFromDelta(dq, dr){
    for(const d of LABEL_DIRS) if(d.dq===dq && d.dr===dr) return d.label;
    return '?';
}

function labelFromCenter(q, r){
    // map angle to nearest of 6 labels used above
    const p = axialToPixel(q,r);
    const cx = 0, cy = 0; // center at pixel(0,0) for angle calculation
    const ang = Math.atan2(p.y - cy, p.x - cx);
    // convert angle so that -PI/2 (up) is N and then rotate by 60deg sectors
    let base = ang + Math.PI/2;
    while(base < 0) base += Math.PI*2;
    const sector = Math.floor((base) / (Math.PI/3)) % 6;
    return LABEL_DIRS[sector].label;
}

function pathStepsBetween(sq, sr, eq, er){
    const result = [];
    let curQ = sq, curR = sr;
    const targetCube = axialToCube(eq, er);
    const maxIter = 12;
    for(let i=0;i<maxIter;i++){
        if(curQ===eq && curR===er) break;
        // choose neighbor that minimizes cube distance to target
        let best = null, bestDist = Infinity, bestStep = null;
        for(const d of DIRS){
            const nq = curQ + d.dq, nr = curR + d.dr;
            const dist = hexDistanceAxial(nq,nr, eq,er);
            if(dist < bestDist){ bestDist = dist; best = [nq,nr]; bestStep = d; }
        }
        if(!best) break;
        result.push(best);
        curQ = best[0]; curR = best[1];
    }
    return result;
}

function hexDistanceAxial(aq, ar, bq, br){
    const a = axialToCube(aq, ar), b = axialToCube(bq, br);
    return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y), Math.abs(a.z-b.z));
}
