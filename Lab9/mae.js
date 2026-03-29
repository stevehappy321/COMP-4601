export class RecommendCompute {

    // ─── Parse Dataset ────────────────────────────────────────────────────────────
    static parseDataset(text) {
        const lines = text.trim().split(/\r?\n/).map(l => l.trim());
        const [numUsers, numItems] = lines[0].split(' ').map(Number);
        const users = lines[1].split(' ');
        const items = lines[2].split(' ');

        // Index maps for O(1) lookups
        const userIndex = Object.fromEntries(users.map((u, i) => [u, i]));
        const itemIndex = Object.fromEntries(items.map((it, i) => [it, i]));

        // Numeric rating matrix [user][item], 0 = no rating
        const matrix = Array.from({ length: numUsers }, (_, u) =>
            lines[3 + u].split(' ').map(Number)
        );

        // Per-user: set of rated item indices
        const ratedByUser = matrix.map(row =>
            new Set(row.reduce((s, v, i) => { if (v > 0) s.push(i); return s; }, []))
        );

        // Per-item: list of user indices who rated it
        const ratersByItem = Array.from({ length: numItems }, () => []);
        for (let u = 0; u < numUsers; u++)
            for (const i of ratedByUser[u]) ratersByItem[i].push(u);

        // Precompute full user averages
        const userAvgFull = matrix.map((row, u) => {
            const rated = [...ratedByUser[u]];
            return rated.length === 0 ? 3 : rated.reduce((s, i) => s + row[i], 0) / rated.length;
        });

        return { users, items, userIndex, itemIndex, matrix, ratedByUser, ratersByItem, userAvgFull };
    }

    // ─── Precompute & Cache All Needed Pearson Similarities ──────────────────────
    // Call once after parseDataset for maximum performance.
    static precomputeSimilarities(dataset) {
        const { matrix, ratedByUser, ratersByItem, userAvgFull } = dataset;
        const simCache = new Map();

        const getPearson = (uA, uB) => {
            if (uA === uB) return 1;
            const key = uA < uB ? `${uA},${uB}` : `${uB},${uA}`;
            if (simCache.has(key)) return simCache.get(key);

            const [sm, lg] = ratedByUser[uA].size <= ratedByUser[uB].size
                ? [uA, uB] : [uB, uA];

            let num = 0, dA = 0, dB = 0;
            for (const i of ratedByUser[sm]) {
                if (!ratedByUser[lg].has(i)) continue;
                const a = matrix[sm][i] - userAvgFull[sm];
                const b = matrix[lg][i] - userAvgFull[lg];
                num += a * b; dA += a * a; dB += b * b;
            }
            const sim = dA === 0 || dB === 0 ? 0 : num / Math.sqrt(dA * dB);
            simCache.set(key, sim);
            return sim;
        };

        // Warm the cache: only pairs that share at least one item
        for (let u = 0; u < matrix.length; u++)
            for (const i of ratedByUser[u])
                for (const v of ratersByItem[i])
                    if (v !== u) getPearson(u, v);

        dataset.simCache = simCache;
        dataset.getPearson = getPearson;
        return simCache.size;
    }

    // ─── User Average (LOO-aware, works with numeric index) ──────────────────────
    static _looAvg(dataset, uIdx, excludeItemIdx = -1) {
        const { matrix, ratedByUser, userAvgFull } = dataset;
        if (excludeItemIdx < 0) return userAvgFull[uIdx];
        const cnt = ratedByUser[uIdx].size - 1;
        if (cnt <= 0) return 3;
        return (userAvgFull[uIdx] * ratedByUser[uIdx].size - matrix[uIdx][excludeItemIdx]) / cnt;
    }

    // ─── Pearson Similarity (falls back to on-demand if not precomputed) ─────────
    static _pearson(dataset, uA, uB) {
        if (dataset.getPearson) return dataset.getPearson(uA, uB);

        // On-demand fallback (no precomputation)
        const { matrix, ratedByUser, userAvgFull } = dataset;
        const [sm, lg] = ratedByUser[uA].size <= ratedByUser[uB].size ? [uA, uB] : [uB, uA];
        let num = 0, dA = 0, dB = 0;
        for (const i of ratedByUser[sm]) {
            if (!ratedByUser[lg].has(i)) continue;
            const a = matrix[sm][i] - userAvgFull[sm];
            const b = matrix[lg][i] - userAvgFull[lg];
            num += a * b; dA += a * a; dB += b * b;
        }
        return dA === 0 || dB === 0 ? 0 : num / Math.sqrt(dA * dB);
    }

    // ─── Predict Rating: User-Based CF ───────────────────────────────────────────
    // user / item can be names (strings) or numeric indices.
    // excludeItem: pass the item name/index to use LOO average for the target user.
    static predictRatingUser(dataset, user, item, k = 5, excludeItem = null) {
        const { userIndex, itemIndex, matrix, ratersByItem, users } = dataset;
        const uIdx  = typeof user === 'string' ? userIndex[user] : user;
        const iIdx  = typeof item === 'string' ? itemIndex[item] : item;
        const exIdx = excludeItem == null ? -1
            : typeof excludeItem === 'string' ? itemIndex[excludeItem] : excludeItem;

        const looAvg = this._looAvg(dataset, uIdx, exIdx);

        // Candidates: users who rated this item, excluding the target
        const cands = ratersByItem[iIdx].filter(v => v !== uIdx);
        if (cands.length === 0) return { score: this._clamp(looAvg), source: 'fallback' };

        const neighbours = cands
            .map(v => ({ v, sim: this._pearson(dataset, uIdx, v) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);

        let num = 0, den = 0;
        for (const { v, sim } of neighbours) {
            num += sim * (matrix[v][iIdx] - dataset.userAvgFull[v]);
            den += sim;
        }

        const raw = den === 0 ? looAvg : looAvg + num / den;
        return { score: this._clamp(raw, looAvg), source: 'predicted' };
    }

    // ─── Adjusted Cosine Similarity Between Two Items ────────────────────────────
    static _adjustedCosine(dataset, iAIdx, iBIdx) {
        const { matrix, ratersByItem, userAvgFull } = dataset;

        // Users who rated both items
        const [sm, lg] = ratersByItem[iAIdx].length <= ratersByItem[iBIdx].length
            ? [new Set(ratersByItem[iAIdx]), ratersByItem[iBIdx]]
            : [new Set(ratersByItem[iBIdx]), ratersByItem[iAIdx]];

        let num = 0, dA = 0, dB = 0;
        for (const u of lg) {
            if (!sm.has(u)) continue;
            const a = matrix[u][iAIdx] - userAvgFull[u];
            const b = matrix[u][iBIdx] - userAvgFull[u];
            num += a * b; dA += a * a; dB += b * b;
        }
        return dA === 0 || dB === 0 ? 0 : num / Math.sqrt(dA * dB);
    }

    // ─── Predict Rating: Item-Based CF ───────────────────────────────────────────
    static predictRatingItem(dataset, user, item, k = 5) {
        const { userIndex, itemIndex, matrix, ratedByUser } = dataset;
        const uIdx = typeof user === 'string' ? userIndex[user] : user;
        const iIdx = typeof item === 'string' ? itemIndex[item] : item;

        const fallbackAvg = this._looAvg(dataset, uIdx, iIdx);

        // Candidate items: ones this user has rated (excluding target)
        const cands = [...ratedByUser[uIdx]].filter(i => i !== iIdx);
        if (cands.length === 0) return { score: this._clamp(fallbackAvg), source: 'fallback' };

        const neighbours = cands
            .map(i => ({ i, sim: this._adjustedCosine(dataset, i, iIdx) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);

        let num = 0, den = 0;
        for (const { i, sim } of neighbours) {
            num += sim * matrix[uIdx][i];
            den += Math.abs(sim);
        }

        const raw = den === 0 ? fallbackAvg : num / den;
        return { score: this._clamp(raw, fallbackAvg), source: 'predicted' };
    }

    // ─── Leave-One-Out MAE ────────────────────────────────────────────────────────
    // method: 'user' | 'item'
    // onProgress(done, total): optional callback called every 20 users
    static computeMAE(dataset, k = 5, method = 'user', onProgress = null) {
        const { matrix, ratedByUser } = dataset;
        const numUsers = matrix.length;
        let totalError = 0, count = 0;

        for (let u = 0; u < numUsers; u++) {
            for (const iIdx of ratedByUser[u]) {
                const actual = matrix[u][iIdx];

                const { score } = method === 'user'
                    ? this.predictRatingUser(dataset, u, iIdx, k, iIdx)
                    : this.predictRatingItem(dataset, u, iIdx, k);

                totalError += Math.abs(score - actual);
                count++;
            }

            if (onProgress && ((u + 1) % 20 === 0 || u === numUsers - 1))
                onProgress(u + 1, numUsers, count);
        }

        return { mae: totalError / count, count };
    }

    // ─── Clamp Helper ─────────────────────────────────────────────────────────────
    static _clamp(score, fallback = 3) {
        const v = isFinite(score) ? score : fallback;
        return Math.min(5, Math.max(1, v));
    }
}