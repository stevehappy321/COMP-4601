export class RecommendCompute {

    // ─── Parse Dataset ────────────────────────────────────────────────────────────
    static parseDataset(text) {
        const lines = text.trim().split(/\r?\n/).map(l => l.trim());
        const [numUsers, numItems] = lines[0].split(' ').map(Number);
        const users = lines[1].split(' ');
        const items = lines[2].split(' ');

        const userIndex = Object.fromEntries(users.map((u, i) => [u, i]));
        const itemIndex = Object.fromEntries(items.map((it, i) => [it, i]));

        // parse ratings
        const matrix = Array.from({ length: numUsers }, (_, u) =>
            lines[3 + u].split(' ').map(Number)
        );

        // each user's rated items (indexes)
        const ratedByUser = matrix.map(row =>
            new Set(row.reduce((s, v, i) => { if (v > 0) s.push(i); return s; }, []))
        );

        // for each item, generate a list of users who rated it
        const ratersByItem = Array.from({ length: numItems }, () => []);
        for (let u = 0; u < numUsers; u++)
            for (const i of ratedByUser[u]) ratersByItem[i].push(u);

        // avg ratings for each user
        const userAvgFull = matrix.map((row, u) => {
            const rated = [...ratedByUser[u]];
            return rated.length === 0 ? 3 : rated.reduce((s, i) => s + row[i], 0) / rated.length;
        });

        return { users, items, userIndex, itemIndex, matrix, ratedByUser, ratersByItem, userAvgFull };
    }

    // ─── Precompute & Cache All Needed Pearson Similarities ──────────────────────
    // Call once after parseDataset for maximum performance.
    static precomputePearson(dataset) {
        const { matrix, ratedByUser, ratersByItem, userAvgFull } = dataset;
        const simCache = new Map();

        const getPearson = (uA, uB) => {
            if (uA === uB) return 1;
            const key = uA < uB ? `${uA},${uB}` : `${uB},${uA}`;
            if (simCache.has(key)) return simCache.get(key);

            // whichever user has fewer ratings - shorter loop
            const [sm, lg] = ratedByUser[uA].size <= ratedByUser[uB].size
                ? [uA, uB] : [uB, uA];

            let num = 0, dA = 0, dB = 0;
            // for each item that both users rated
            for (const i of ratedByUser[sm]) {
                if (!ratedByUser[lg].has(i)) continue;

                // delta from user's total average
                const a = matrix[sm][i] - userAvgFull[sm]; 
                const b = matrix[lg][i] - userAvgFull[lg];

                // covariance
                num += a * b;

                // variance
                dA += a * a;
                dB += b * b;
            }

            // pearson sim formula
            const sim = dA === 0 || dB === 0 ? 0 : num / Math.sqrt(dA * dB);
            simCache.set(key, sim);
            return sim;
        };

        // precompute only for user pairs that share at least 1 item
        for (let u = 0; u < matrix.length; u++)
            for (const i of ratedByUser[u])
                for (const v of ratersByItem[i])
                    if (v !== u) getPearson(u, v);

        dataset.simCache = simCache;
        dataset.getPearson = getPearson;
        return simCache.size;
    }

    // ─── User Average (LOO-aware, works with numeric index) ──────────────────────
    static _userAverage(dataset, uIdx, excludeItemIdx = -1) {
        const { matrix, ratedByUser, userAvgFull } = dataset;
        if (excludeItemIdx < 0) return userAvgFull[uIdx];
        const cnt = ratedByUser[uIdx].size - 1;
        if (cnt <= 0) return 3;
        return (userAvgFull[uIdx] * ratedByUser[uIdx].size - matrix[uIdx][excludeItemIdx]) / cnt;
    }

    // ─── Pearson Similarity (falls back to on-demand if not precomputed) ─────────
    static _pearson(dataset, uA, uB) {
        if (dataset.getPearson) return dataset.getPearson(uA, uB);

        // similar algorithm to precomputed
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

    // predict how [user] will rate [item] by looking at similar users
    static predictRatingUser(dataset, user, item, k = 5, excludeItem = null) {
        const { userIndex, itemIndex, matrix, ratersByItem, users } = dataset;
        const u  = typeof user === 'string' ? userIndex[user] : user;
        const i  = typeof item === 'string' ? itemIndex[item] : item;
        const exclude = excludeItem == null ? -1
            : typeof excludeItem === 'string' ? itemIndex[excludeItem] : excludeItem;

        // user rating avg excluding [excludeItem]
        const looAvg = this._userAverage(dataset, u, exclude);

        // users who rated this item except [user]
        const cands = ratersByItem[i].filter(v => v !== u);
        if (cands.length === 0) return { score: this._clamp(looAvg), source: 'fallback' };

        // closest k neighbors
        const neighbours = cands
            .map(v => ({ v, sim: this._pearson(dataset, u, v) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);

        let num = 0, den = 0;
        for (const { v, sim } of neighbours) {
            num += sim * (matrix[v][i] - dataset.userAvgFull[v]); // accumulate deviation
            den += sim; // accumulate similarity
        }

        const raw = den === 0 ? looAvg : looAvg + num / den;
        return { score: this._clamp(raw, looAvg), source: 'predicted' };
    }

    static _adjustedCosine(dataset, iAIdx, iBIdx) {
        const { matrix, ratersByItem, userAvgFull } = dataset;

        // users who rated both items
        const [sm, lg] = ratersByItem[iAIdx].length <= ratersByItem[iBIdx].length
            ? [new Set(ratersByItem[iAIdx]), ratersByItem[iBIdx]]
            : [new Set(ratersByItem[iBIdx]), ratersByItem[iAIdx]];

        let num = 0, dA = 0, dB = 0;
        for (const u of lg) {
            if (!sm.has(u)) continue;
            // deviation from user avg - removes bias from generous/strict rating
            const a = matrix[u][iAIdx] - userAvgFull[u]; 
            const b = matrix[u][iBIdx] - userAvgFull[u];
            num += a * b; dA += a * a; dB += b * b;
        }
        return dA === 0 || dB === 0 ? 0 : num / Math.sqrt(dA * dB);
    }

    // predict how [user] will rate [item] by looking at similar users
    static predictRatingItem(dataset, user, item, k = 5) {
        const { userIndex, itemIndex, matrix, ratedByUser } = dataset;
        const uIdx = typeof user === 'string' ? userIndex[user] : user;
        const iIdx = typeof item === 'string' ? itemIndex[item] : item;
 
        const fallbackAvg = this._userAverage(dataset, uIdx, iIdx);
 
        // other items this user has rated
        const cands = [...ratedByUser[uIdx]].filter(i => i !== iIdx);
        if (cands.length === 0) return { score: this._clamp(fallbackAvg), source: 'fallback' };
 
        // k most similar items
        const neighbours = cands
            .map(i => ({ i, sim: this._adjustedCosine(dataset, i, iIdx) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);
 
        let num = 0, den = 0;
        for (const { i, sim } of neighbours) {
            num += sim * matrix[uIdx][i]; // accumulate weighted ratings
            den += Math.abs(sim);  // accumulate similarity
        }
 
        const raw = den === 0 ? fallbackAvg : num / den;
        return { score: this._clamp(raw, fallbackAvg), source: 'predicted' };
    }

    // ─── Leave-One-Out MAE ────────────────────────────────────────────────────────
    static computeMAE(dataset, k = 5, method = 'user') {
        const { matrix, ratedByUser } = dataset;
        const numUsers = matrix.length;
        let totalError = 0, count = 0;

        // leave one out
        for (let u = 0; u < numUsers; u++) {
            for (const iIdx of ratedByUser[u]) {
                const actual = matrix[u][iIdx];

                /* 
                predict
                user mode - ignore iIdx'th rating as we left it out
                item mode - predict as usual
                */
                const { score } = method === 'user'
                    ? this.predictRatingUser(dataset, u, iIdx, k, iIdx)
                    : this.predictRatingItem(dataset, u, iIdx, k);

                // difference
                totalError += Math.abs(score - actual);
                count++;
            }
        }

        return { mae: totalError / count, count };
    }


    static coldStartRecommendations(dataset, targetUser = 'User1') {
        const { userIndex, items, matrix, ratedByUser, ratersByItem } = dataset;

        const uIdx = typeof targetUser === 'string' ? userIndex[targetUser] : targetUser;

        // Items User1 has already interacted with (rated 1)
        const ratedItems = ratedByUser[uIdx]; // Set of item indices

        // Vote accumulator for unrated items
        const votes = new Map(); // itemIdx → count

        // Traverse length-3 paths: uIdx → itemA → otherUser → itemB
        for (const itemA of ratedItems) {
            for (const otherUser of ratersByItem[itemA]) {
                if (otherUser === uIdx) continue; // skip self

                for (const itemB of ratedByUser[otherUser]) {
                    if (ratedItems.has(itemB)) continue; // skip already-rated items

                    votes.set(itemB, (votes.get(itemB) ?? 0) + 1);
                }
            }
        }

        // Build sorted result (highest votes first)
        return [...votes.entries()]
            .map(([idx, v]) => ({ name: items[idx], votes: v }))
            .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
    }

    // ─── Clamp Helper ─────────────────────────────────────────────────────────────
    static _clamp(score, fallback = 3) {
        const v = isFinite(score) ? score : fallback;
        return Math.min(5, Math.max(1, v));
    }
}