
export class RecommendCompute {
    static parseDataset(text) {
        const lines = text.trim().split('\n').map(l => l.trim());
        const [numUsers, numItems] = lines[0].split(' ').map(Number);
        const users = lines[1].split(' ');
        const items = lines[2].split(' ');

        // ratings[user][item] = score, or -1 if unrated
        const ratings = {};
        for (let u = 0; u < numUsers; u++) {
            ratings[users[u]] = {};
            const row = lines[3 + u].split(' ').map(Number);
            for (let i = 0; i < numItems; i++) {
            ratings[users[u]][items[i]] = row[i];
            }
        }
        return { users, items, ratings };
    }


    // ─── User Average (ignoring -1s) ──────────────────────────────────────────────
    static userAverage(ratings, user) {
        const vals = Object.values(ratings[user]).filter(v => v !== -1);
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }


    // ─── Pearson Correlation Similarity Between Two Users ─────────────────────────
    // Uses only items both users have rated
    static pearsonSimilarity(ratings, userA, userB) {
        const avgA = userAverage(ratings, userA);
        const avgB = userAverage(ratings, userB);

        // Items rated by both
        const sharedItems = Object.keys(ratings[userA]).filter(
            item => ratings[userA][item] !== -1 && ratings[userB][item] !== -1
        );

        if (sharedItems.length === 0) return 0;

        let num = 0, denomA = 0, denomB = 0;
        for (const item of sharedItems) {
            const diffA = ratings[userA][item] - avgA;
            const diffB = ratings[userB][item] - avgB;
            num    += diffA * diffB;
            denomA += diffA ** 2;
            denomB += diffB ** 2;
        }

        const denom = Math.sqrt(denomA) * Math.sqrt(denomB);
        return denom === 0 ? 0 : num / denom;
    }


    // ─── Find K Nearest Neighbours for a User ─────────────────────────────────────
    static getNearestNeighbours(ratings, users, targetUser, k) {
        return users
            .filter(u => u !== targetUser)
            .map(u => ({ user: u, sim: pearsonSimilarity(ratings, targetUser, u) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);
    }


    // ─── Predict Rating (User-Based) ──────────────────────────────────────────────
    // pred(a, p) = avg_a + Σ sim(a,b)*(r_b,p - avg_b) / Σ |sim(a,b)|
    static predictRatingUser(ratings, users, targetUser, targetItem, k = 2) {
        // If already rated, return truth
        if (ratings[targetUser][targetItem] !== -1) {
            return { score: ratings[targetUser][targetItem], source: 'truth' };
        }

        const avgTarget = userAverage(ratings, targetUser);
        const neighbours = getNearestNeighbours(ratings, users, targetUser, k)
            .filter(n => ratings[n.user][targetItem] !== -1); // must have rated item

        if (neighbours.length === 0) return { score: avgTarget, source: 'guess' };

        let num = 0, denom = 0;
        for (const { user, sim } of neighbours) {
            const avgN = userAverage(ratings, user);
            num   += sim * (ratings[user][targetItem] - avgN);
            denom += Math.abs(sim);
        }

        const score = denom === 0 ? avgTarget : avgTarget + num / denom;
        return { score: Math.round(score * 100) / 100, source: 'guess' };
    }


    // ─── Adjusted Cosine Similarity Between Two Items ─────────────────────────────
    // Uses only users that rated both items, subtracts per-user average
    static adjustedCosineSimilarity(ratings, users, itemA, itemB) {
        const sharedUsers = users.filter(
            u => ratings[u][itemA] !== -1 && ratings[u][itemB] !== -1
        );
        if (sharedUsers.length === 0) return 0;

        let num = 0, denomA = 0, denomB = 0;
        for (const u of sharedUsers) {
            const avg = userAverage(ratings, u);
            const diffA = ratings[u][itemA] - avg;
            const diffB = ratings[u][itemB] - avg;
            num    += diffA * diffB;
            denomA += diffA ** 2;
            denomB += diffB ** 2;
        }

        const denom = Math.sqrt(denomA) * Math.sqrt(denomB);
        return denom === 0 ? 0 : num / denom;
    }


    // ─── Predict Rating (Item-Based) ──────────────────────────────────────────────
    // pred(u, p) = Σ sim(i,p)*r_u,i / Σ |sim(i,p)|  for rated items i
    static predictRatingItem(ratings, users, items, targetUser, targetItem, k = 2) {
        if (ratings[targetUser][targetItem] !== -1) {
            return { score: ratings[targetUser][targetItem], source: 'truth' };
        }

        // Compute similarity of targetItem to all other items the user rated
        const candidates = items
            .filter(i => i !== targetItem && ratings[targetUser][i] !== -1)
            .map(i => ({ item: i, sim: adjustedCosineSimilarity(ratings, users, targetItem, i) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);

        if (candidates.length === 0) return { score: null, source: 'guess' };

        let num = 0, denom = 0;
        for (const { item, sim } of candidates) {
            num   += sim * ratings[targetUser][item];
            denom += Math.abs(sim);
        }

        const score = denom === 0 ? null : num / denom;
        return { score: score !== null ? Math.round(score * 100) / 100 : null, source: 'guess' };
    }
}