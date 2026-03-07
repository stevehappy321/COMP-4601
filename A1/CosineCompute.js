export class CosineCompute {
    static idf(df, N) {
        if (!df || df <= 0) {
            return 0;
        }
        return Math.max( 0, Math.log2(N / (1 + df)) ); 
    }

    static tf(count, totalWords) {
        if (!totalWords || totalWords <= 0 || !count) {
            return 0;
        }

        return count / totalWords;
    }

    static tfidf(count, totalWords, df, N) {
        const tf = this.tf(count, totalWords);
        const idf = this.idf(df, N);
        return Math.log2(1+tf) * idf;
    }

    static v_document(queryTerms, totalWords, df_dict, tf_dict, N) {
        let vec = [];

        for (const term of queryTerms) {
            const count = tf_dict.get(term) || 0;
            vec.push( this.tfidf(count, totalWords, df_dict.get(term), N) );
        }

        let magnitude = Math.sqrt(vec.reduce((sum, val) => sum + (val * val), 0));

        return { vec, magnitude };
    }

    static cosineScore(queryTerms, docObj, df_dict, q_vec, q_magnitude, N) {
        const { vec: d_vec, magnitude: d_magnitude } = this.v_document(
            queryTerms,
            docObj.totalWords,
            df_dict,
            docObj.tf,
            N
        );

        const dot = this.dotProduct(q_vec, d_vec);
        const scalar = q_magnitude * docObj.mag;

        const cosine = (scalar === 0) ? 0 : dot / scalar;

        return cosine;
    }

    static dotProduct(vector1, vector2) {
        if (vector1.length !== vector2.length) {
            throw new Error("Vectors must be of the same length to calculate the dot product.");
        }

        let result = 0;
        for (let i = 0; i < vector1.length; i++) {
            result += vector1[i] * vector2[i];
        }
        return result;
    }
}

