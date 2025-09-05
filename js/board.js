
// --- UTILS ---
function axialToPixel(q,r){
    return {
        x: CELL_RADIUS * 1.5 * q,
        y: CELL_RADIUS * Math.sqrt(3) * (r + q/2)
    };
}
function drawHex(g, radius){
    const a = Math.PI/3;
    g.moveTo(radius,0);
    for(let i=1;i<=6;i++){
        g.lineTo(radius*Math.cos(a*i), radius*Math.sin(a*i));
    }
}

// --- BOARD GRID ---
const cells = new Map(); // "q,r" → { gfx,q,r,stack:[] }
window.createBoard = function(boardLayer, app) {
    for(let q=-GRID_RADIUS; q<=GRID_RADIUS; q++){
        for(let r=-GRID_RADIUS; r<=GRID_RADIUS; r++){
            if(Math.abs(q+r)>GRID_RADIUS) continue;
            const c = new PIXI.Graphics()
                .lineStyle(2, THEME.boardLine)
                .beginFill(THEME.boardFill);
            drawHex(c, CELL_RADIUS);
            c.endFill();
            const p = axialToPixel(q,r);
            c.position.set(p.x,p.y);
            c.interactive = true;
            c.buttonMode  = true;
            boardLayer.addChild(c);
            cells.set(`${q},${r}`, { gfx:c, q, r, stack:[] }); // Store the main graphic for tinting
            c.on('pointerdown', ()=>{
                if(state.gameOver || animating || !selected) return;
                const key = `${q},${r}`;
                if(!legalZones.has(key)) return;
                if(selected.mode==='place') commitPlacement(q,r);
                else                     commitMove(q,r);
            });
        }
    }
}
