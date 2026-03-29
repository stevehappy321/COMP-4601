import fs from 'fs'; 

const text = fs.readFileSync('./ratings/lab8_data.txt', 'utf8');
const lines = text.trim().split(/\r?\n/);
const [numUsers, numItems] = lines[0].split(' ').map(Number);

const ratingsByUser = [], ratedItems = [];
const ratersByItem = new Array(numItems).fill(null).map(() => []);

for (let u = 0; u < numUsers; u++) {
    const row = lines[3 + u].split(' ').map(Number);
    ratingsByUser.push(row);
    const s = new Set();
    for (let i = 0; i < numItems; i++) {
        if (row[i] !== 0) { s.add(i); ratersByItem[i].push(u); }
    }
    ratedItems.push(s);
}

console.log(`Dataset: ${numUsers} users, ${numItems} items`);

// Precompute full averages (using all ratings)
const fullAvg = new Array(numUsers);
for (let u = 0; u < numUsers; u++) {
    let sum = 0, cnt = 0;
    for (const i of ratedItems[u]) { sum += ratingsByUser[u][i]; cnt++; }
    fullAvg[u] = cnt === 0 ? 3 : sum / cnt;
}

// Precompute Pearson similarities between all user pairs
// Only need pairs where users share at least 1 item
console.log('Precomputing similarities...');
const simCache = new Map(); // "uA,uB" -> sim

function getPearson(uA, uB) {
    if (uA === uB) return 1;
    const key = uA < uB ? `${uA},${uB}` : `${uB},${uA}`;
    if (simCache.has(key)) return simCache.get(key);

    const avgA = fullAvg[uA], avgB = fullAvg[uB];
    const [sm, lg] = ratedItems[uA].size <= ratedItems[uB].size
        ? [ratedItems[uA], ratedItems[uB]] : [ratedItems[uB], ratedItems[uA]];
    const [rA, rB] = ratedItems[uA].size <= ratedItems[uB].size
        ? [ratingsByUser[uA], ratingsByUser[uB]] : [ratingsByUser[uB], ratingsByUser[uA]];
    const [avgSm, avgLg] = ratedItems[uA].size <= ratedItems[uB].size
        ? [avgA, avgB] : [avgB, avgA];
    const [idxSm, idxLg] = ratedItems[uA].size <= ratedItems[uB].size ? [uA, uB] : [uB, uA];

    let num = 0, dA = 0, dB = 0;
    for (const i of sm) {
        if (!lg.has(i)) continue;
        const a = ratingsByUser[idxSm][i] - fullAvg[idxSm];
        const b = ratingsByUser[idxLg][i] - fullAvg[idxLg];
        num += a * b; dA += a * a; dB += b * b;
    }
    const d = Math.sqrt(dA * dB);
    const sim = d === 0 ? 0 : num / d;
    simCache.set(key, sim);
    return sim;
}

// Precompute all needed similarities
for (let u = 0; u < numUsers; u++) {
    for (const iIdx of ratedItems[u]) {
        for (const v of ratersByItem[iIdx]) {
            if (v !== u) getPearson(u, v);
        }
    }
}
console.log(`Cached ${simCache.size} user-pair similarities`);

// Leave-one-out MAE using precomputed similarities
// For each held-out (u, i): adjust u's average excluding item i
const t0 = Date.now();
let totalError = 0, totalCount = 0;
const k = 5;

for (let u = 0; u < numUsers; u++) {
    const userRatings = ratedItems[u];
    const userRow = ratingsByUser[u];
    const userSum = [...userRatings].reduce((s, i) => s + userRow[i], 0);
    const userCnt = userRatings.size;

    for (const iIdx of userRatings) {
        const actual = userRow[iIdx];

        // Leave-one-out average for target user (exclude item iIdx)
        const looCnt = userCnt - 1;
        const looAvg = looCnt === 0 ? 3 : (userSum - actual) / looCnt;

        // Find top-k neighbours who rated iIdx
        const cands = ratersByItem[iIdx].filter(v => v !== u);
        if (!cands.length) {
            totalError += Math.abs(Math.max(1, Math.min(5, looAvg)) - actual);
            totalCount++;
            continue;
        }

        const sims = cands
            .map(v => ({ v, sim: getPearson(u, v) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);

        let num = 0, den = 0;
        for (const { v, sim } of sims) {
            num += sim * (ratingsByUser[v][iIdx] - fullAvg[v]);
            den += sim;
        }

        let predicted;
        if (den === 0 || !isFinite(den)) {
            predicted = looAvg;
        } else {
            predicted = looAvg + num / den;
            if (!isFinite(predicted)) predicted = looAvg;
        }
        predicted = Math.max(1, Math.min(5, predicted));

        totalError += Math.abs(predicted - actual);
        totalCount++;
    }

    if ((u + 1) % 20 === 0 || u === numUsers - 1) {
        const el = ((Date.now() - t0) / 1000).toFixed(1);
        process.stdout.write(`\r[${el}s] ${u+1}/${numUsers} users done, ${totalCount} predictions`);
    }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
const mae = totalError / totalCount;
console.log(`\n\n=== Results (precomputed sims) ===`);
console.log(`MAE        : ${mae.toFixed(4)}`);
console.log(`Predictions: ${totalCount}`);
console.log(`Runtime    : ${elapsed}s`);