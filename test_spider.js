// test_spider.js
// Standalone Node test harness to reproduce the spider move scenario.
// It recreates the relevant helper functions and prints legal spider endpoints.

const GRID_RADIUS = 4;
const DIRS = [
	{dq:1,dr:0},{dq:1,dr:-1},{dq:0,dr:-1},
	{dq:-1,dr:0},{dq:-1,dr:1},{dq:0,dr:1}
];

const CELL_RADIUS = 38;

function axialToPixel(q,r){
	return {
		x: CELL_RADIUS * 1.5 * q,
		y: CELL_RADIUS * Math.sqrt(3) * (r + q/2)
	};
}

function cellExists(key){
	const [q,r] = key.split(',').map(Number);
	return Math.abs(q) <= GRID_RADIUS && Math.abs(r) <= GRID_RADIUS;
}

function isHiveConnected(set){
	if(set.size < 2) return true;
	const arr = Array.from(set);
	const seen = new Set([arr[0]]);
	const q = [arr[0]];
	while(q.length){
		const cur = q.shift();
		const [x,y] = cur.split(',').map(Number);
		for(const d of DIRS){
			const nb = `${x + d.dq},${y + d.dr}`;
			if(set.has(nb) && !seen.has(nb)){
				seen.add(nb);
				q.push(nb);
			}
		}
	}
	return seen.size === set.size;
}

function canSlide(fx,fr,tx,tr,occ){
	const dq = tx - fx, dr = tr - fr;
	const idx = DIRS.findIndex(d => d.dq === dq && d.dr === dr);
	if(idx === -1) return false;
	const i1 = (idx + 5) % 6, i2 = (idx + 1) % 6;
	const s1 = `${fx + DIRS[i1].dq},${fr + DIRS[i1].dr}`;
	const s2 = `${fx + DIRS[i2].dq},${fr + DIRS[i2].dr}`;
	return !(occ.has(s1) && occ.has(s2));
}

function getSpiderMoves(q0, r0, occAll){
	const startKey = `${q0},${r0}`;
	const occAfterRemoval = new Set(occAll);
	occAfterRemoval.delete(startKey);
	if(!isHiveConnected(occAfterRemoval)) return [];

	const occRem = new Set(occAfterRemoval);

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

	occRem.forEach(k => {
		const [oq,or] = k.split(',').map(Number);
		DIRS.forEach(d => {
			const nq = oq + d.dq, nr = or + d.dr;
			const nk = `${nq},${nr}`;
			if(!cellExists(nk)) return;
			if(occRem.has(nk)) return;
			if(!perimeter.has(nk)){
				const p = axialToPixel(nq,nr);
				perimeter.set(nk, {q:nq,r:nr,x:p.x,y:p.y});
			}
		});
	});
	if(perimeter.size===0) return [];

	const arr = Array.from(perimeter.entries()).map(([k,v])=>{
		const angle = Math.atan2(v.y - cy, v.x - cx);
		return {key:k, angle, ...v};
	});
	arr.sort((a,b)=>a.angle - b.angle);
	const ring = arr.map(a=>a.key);

	// DEBUG: print perimeter and ring order
	console.log('DEBUG: occRem=', Array.from(occRem).sort());
	console.log('DEBUG: perimeter keys=', Array.from(perimeter.keys()).sort());
	console.log('DEBUG: ring order=', ring);

	function validateWalkFrom(startIdx, stepDir){
		const n = ring.length;
		let curQ = q0, curR = r0;
		for(let s=1;s<=3;s++){
			// first step should be the originNeighbor (startIdx), then startIdx+stepDir, etc.
			const idx = (startIdx + (s-1)*stepDir + n) % n;
			const [nx,ny] = ring[idx].split(',').map(Number);
			const neigh = DIRS.some(d=>curQ + d.dq === nx && curR + d.dr === ny);
			if(!neigh) return null;
			if(!canSlide(curQ,curR,nx,ny,occRem)) return null;
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

	if(found.cw && !found.ccw && found.startIdxCW !== null){
		endpoints.add(finalFromStart(found.startIdxCW, +1));
	}
	if(found.ccw && !found.cw && found.startIdxCCW !== null){
		endpoints.add(finalFromStart(found.startIdxCCW, -1));
	}

	return Array.from(endpoints);
}

// Build the scenario from your history:
// 1. white Q placed at 0,0
// 1. black Q placed at 0,-1
// 2. white A placed at 1,0
// 2. black G placed at 1,-2
// 3. white S placed at 2,0  <-- spider origin
// 3. black B placed at 0,-2

const placed = [
	'0,0', // white Q
	'0,-1',// black Q
	'1,0', // white A
	'1,-2',// black G
	'2,0', // white S (spider)
	'0,-2' // black B
];

const occAll = new Set(placed);

const spiderOrigin = [2,0];
const endpoints = getSpiderMoves(spiderOrigin[0], spiderOrigin[1], occAll);

console.log('Spider legal endpoints:', endpoints.sort());
console.log('Contains 2,-3?', endpoints.includes('2,-3'));
