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


    // ─── User Average (ignoring -1s) ─────────────────────────────────────────────
    static userAverage(ratings, user) {
        const vals = Object.values(ratings[user]).filter(v => v !== -1);
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }


    // ─── Pearson Correlation Similarity Between Two Users ────────────────────────
    // Uses only items both users have rated
    static pearsonSimilarity(ratings, userA, userB) {
        const avgA = this.userAverage(ratings, userA);
        const avgB = this.userAverage(ratings, userB);

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


    // ─── Find K Nearest Neighbours for a User ────────────────────────────────────
    static getNearestNeighbours(ratings, users, targetUser, k) {
        return users
            .filter(u => u !== targetUser)
            .map(u => ({ user: u, sim: this.pearsonSimilarity(ratings, targetUser, u) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);
    }


    // ─── Predict Rating (User-Based) ─────────────────────────────────────────────
    // pred(a, p) = r̄_a + Σ sim(a,b) * (r_b,p - r̄_b) / Σ sim(a,b)
    // Matches slide formula exactly — denominator uses sim (not |sim|)
    static predictRatingUser(ratings, users, targetUser, targetItem, k = 2) {
        if (ratings[targetUser][targetItem] !== -1) {
            return { score: ratings[targetUser][targetItem], source: 'truth' };
        }

        const avgTarget = this.userAverage(ratings, targetUser);

        // Get top-k neighbours who have rated the target item
        const neighbours = users
            .filter(u => u !== targetUser && ratings[u][targetItem] !== -1)
            .map(u => ({ user: u, sim: this.pearsonSimilarity(ratings, targetUser, u) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);

        if (neighbours.length === 0) return { score: avgTarget, source: 'guess' };

        let num = 0, denom = 0;
        for (const { user, sim } of neighbours) {
            const avgN = this.userAverage(ratings, user);
            num   += sim * (ratings[user][targetItem] - avgN);
            denom += sim; // ✅ slide formula: Σ sim(a,b), not Σ |sim(a,b)|
        }

        const score = denom === 0 ? avgTarget : avgTarget + num / denom;
        return { score: Math.round(score * 100) / 100, source: 'guess' };
    }


    // ─── Adjusted Cosine Similarity Between Two Items ────────────────────────────
    // Uses only users that rated both items, subtracts per-user average
    static adjustedCosineSimilarity(ratings, users, itemA, itemB) {
        const sharedUsers = users.filter(
            u => ratings[u][itemA] !== -1 && ratings[u][itemB] !== -1
        );
        if (sharedUsers.length === 0) return 0;

        let num = 0, denomA = 0, denomB = 0;
        for (const u of sharedUsers) {
            const avg = this.userAverage(ratings, u); // ✅ fixed: was bare userAverage()
            const diffA = ratings[u][itemA] - avg;
            const diffB = ratings[u][itemB] - avg;
            num    += diffA * diffB;
            denomA += diffA ** 2;
            denomB += diffB ** 2;
        }

        const denom = Math.sqrt(denomA) * Math.sqrt(denomB);
        return denom === 0 ? 0 : num / denom;
    }


    // ─── Predict Rating (Item-Based) ─────────────────────────────────────────────
    // pred(u, p) = Σ sim(i, p) * r_u,i / Σ |sim(i, p)|  for items i rated by user u
    static predictRatingItem(ratings, users, targetUser, targetItem, k = 2) { // ✅ renamed
        if (ratings[targetUser][targetItem] !== -1) {
            return { score: ratings[targetUser][targetItem], source: 'truth' };
        }

        const allItems = Object.keys(ratings[targetUser]);

        // Get top-k most similar items that the target user has actually rated
        const neighbours = allItems
            .filter(item => item !== targetItem && ratings[targetUser][item] !== -1)
            .map(item => ({
                item,
                sim: this.adjustedCosineSimilarity(ratings, users, item, targetItem) // ✅ uses item similarity
            }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, k);

        if (neighbours.length === 0) {
            return { score: this.userAverage(ratings, targetUser), source: 'guess' };
        }

        let num = 0, denom = 0;
        for (const { item, sim } of neighbours) {
            num   += sim * ratings[targetUser][item];
            denom += Math.abs(sim); // ✅ item-based formula uses |sim|
        }

        const score = denom === 0
            ? this.userAverage(ratings, targetUser)
            : num / denom;

        return { score: Math.round(score * 100) / 100, source: 'guess' };
    }
}