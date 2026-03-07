// Main application JavaScript

// State management
const state = {
    currentResults: [],
    currentQuery: '',
    currentDataset: '',
    searchStartTime: 0
};

// DOM Elements
const searchForm = document.getElementById('searchForm');
const resultsContainer = document.getElementById('resultsContainer');
const pageModal = document.getElementById('pageModal');
const modalClose = document.getElementById('modalClose');
const modalBody = document.getElementById('modalBody');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadFromURL();
});

// Setup event listeners
function setupEventListeners() {
    searchForm.addEventListener('submit', handleSearch);
    modalClose.addEventListener('click', closeModal);
    pageModal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    
    // Close modal on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && pageModal.classList.contains('active')) {
            closeModal();
        }
    });
}

// Load search from URL parameters if present
function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const dataset = params.get('dataset');
    const query = params.get('q');
    const boost = params.get('boost');
    const limit = params.get('limit');
    
    if (dataset && query) {
        document.getElementById('dataset').value = dataset;
        document.getElementById('query').value = query;
        
        if (boost) {
            const boostRadios = document.querySelectorAll('input[name="boost"]');
            boostRadios.forEach(radio => {
                if (radio.value === boost) {
                    radio.checked = true;
                }
            });
        }
        
        if (limit) {
            document.getElementById('limit').value = limit;
        }
        
        // Trigger search
        performSearch(dataset, query, boost === 'true', parseInt(limit) || 10);
    }
}

// Handle search form submission
async function handleSearch(e) {
    e.preventDefault();
    
    const dataset = document.getElementById('dataset').value;
    const query = document.getElementById('query').value.trim();
    const boost = document.querySelector('input[name="boost"]:checked').value === 'true';
    const limit = parseInt(document.getElementById('limit').value) || 10;
    
    if (!query) {
        return;
    }
    
    // Update URL without reloading
    const url = new URL(window.location);
    url.searchParams.set('dataset', dataset);
    url.searchParams.set('q', query);
    url.searchParams.set('boost', boost);
    url.searchParams.set('limit', limit);
    window.history.pushState({}, '', url);
    
    await performSearch(dataset, query, boost, limit);
}

// Perform search API call
async function performSearch(dataset, query, boost, limit) {
    state.currentQuery = query;
    state.currentDataset = dataset;
    state.searchStartTime = performance.now();
    
    // Show loading state
    showLoading();
    
    try {
        // Build query string
        const params = new URLSearchParams({
            q: query,
            boost: boost,
            limit: limit
        });
        
        const response = await fetch(`/${dataset}?${params}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const searchTime = performance.now() - state.searchStartTime;
        
        state.currentResults = data.result || [];
        displayResults(state.currentResults, query, searchTime);
        
    } catch (error) {
        console.error('Search error:', error);
        showError('Failed to perform search. Please try again.');
    }
}

// Show loading state
function showLoading() {
    resultsContainer.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p class="loading-text">Searching...</p>
        </div>
    `;
}

// Show error message
function showError(message) {
    resultsContainer.innerHTML = `
        <div class="results-placeholder">
            <div class="placeholder-icon">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <circle cx="40" cy="40" r="30" stroke="currentColor" stroke-width="3"/>
                    <line x1="40" y1="25" x2="40" y2="45" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="40" cy="55" r="2" fill="currentColor"/>
                </svg>
            </div>
            <p class="placeholder-text">${message}</p>
        </div>
    `;
}

// Display search results
function displayResults(results, query, searchTime) {
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="results-placeholder">
                <div class="placeholder-icon">
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                        <circle cx="32" cy="32" r="20" stroke="currentColor" stroke-width="3"/>
                        <line x1="46" y1="46" x2="65" y2="65" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                        <line x1="20" y1="32" x2="44" y2="32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                    </svg>
                </div>
                <p class="placeholder-text">No results found</p>
                <p class="placeholder-hint">Try adjusting your search terms</p>
            </div>
        `;
        return;
    }
    
    const resultsHTML = `
        <div class="results-header">
            <div class="results-meta">
                <p class="results-count">
                    Found <strong>${results.length}</strong> results
                </p>
                <p class="results-time">
                    ${searchTime.toFixed(2)}ms
                </p>
            </div>
            <h2 class="results-query">${escapeHtml(query)}</h2>
        </div>
        <div class="results-list">
            ${results.map((result, index) => createResultItem(result, index)).join('')}
        </div>
    `;
    
    resultsContainer.innerHTML = resultsHTML;
    
    // Attach event listeners to view details buttons
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.target.dataset.url;
            loadPageDetails(url);
        });
    });
}

// Create individual result item HTML
function createResultItem(result, index) {
    const rank = index + 1;
    const score = result.score ? result.score.toFixed(6) : '0.000000';
    const pageRank = result.pr ? result.pr.toFixed(6) : '0.000000';
    const title = result.title || 'Untitled';
    const url = result.url || '';
    
    return `
        <div class="result-item">
            <div class="result-header">
                <span class="result-rank">#${rank}</span>
                <div class="result-content">
                    <h3 class="result-title">${escapeHtml(title)}</h3>
                    <a href="${escapeHtml(url)}" class="result-url" target="_blank" rel="noopener noreferrer">
                        ${escapeHtml(url)}
                    </a>
                    <div class="result-metrics">
                        <div class="metric">
                            <span class="metric-label">Score</span>
                            <span class="metric-value score">${score}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">PageRank</span>
                            <span class="metric-value pagerank">${pageRank}</span>
                        </div>
                    </div>
                    <div class="result-actions">
                        <button class="view-details-btn" data-url="${escapeHtml(url)}">
                            View Page Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Load page details for modal
async function loadPageDetails(webUrl) {
    try {
        modalBody.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p class="loading-text">Loading page details...</p>
            </div>
        `;
        
        openModal();
        
        const params = new URLSearchParams({ webUrl });
        const response = await fetch(`/${state.currentDataset}/page?${params}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        displayPageDetails(data);
        
    } catch (error) {
        console.error('Error loading page details:', error);
        modalBody.innerHTML = `
            <div class="results-placeholder">
                <p class="placeholder-text">Failed to load page details</p>
                <p class="placeholder-hint">${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// Display page details in modal
function displayPageDetails(data) {
    const title = data.title || 'Untitled';
    const url = data.url || '';
    const pageRank = data.pageRank ? data.pageRank.toFixed(6) : '0.000000';
    const incomingLinks = data.incomingLinks || [];
    const outgoingLinks = data.outgoingLinks || [];
    const wordFrequency = data.wordFrequency || {};
    
    const wordFreqEntries = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50);
    
    modalBody.innerHTML = `
        <div class="modal-section">
            <h2 class="section-title">Page Information</h2>
            <h3 class="page-title-display">${escapeHtml(title)}</h3>
            <p class="page-url-display">${escapeHtml(url)}</p>
            <p class="page-pagerank-display">PageRank: ${pageRank}</p>
        </div>
        
        <div class="modal-section">
            <h2 class="section-title">Incoming Links (${incomingLinks.length})</h2>
            ${incomingLinks.length > 0 ? `
                <div class="links-list">
                    ${incomingLinks.map(link => `
                        <div class="link-item">${escapeHtml(link)}</div>
                    `).join('')}
                </div>
            ` : '<p class="empty-state">No incoming links</p>'}
        </div>
        
        <div class="modal-section">
            <h2 class="section-title">Outgoing Links (${outgoingLinks.length})</h2>
            ${outgoingLinks.length > 0 ? `
                <div class="links-list">
                    ${outgoingLinks.map(link => `
                        <div class="link-item">${escapeHtml(link)}</div>
                    `).join('')}
                </div>
            ` : '<p class="empty-state">No outgoing links</p>'}
        </div>
        
        <div class="modal-section">
            <h2 class="section-title">Word Frequency (Top ${wordFreqEntries.length})</h2>
            ${wordFreqEntries.length > 0 ? `
                <div class="word-freq-grid">
                    ${wordFreqEntries.map(([word, count]) => `
                        <div class="word-freq-item">
                            <span class="word-freq-word">${escapeHtml(word)}</span>
                            <span class="word-freq-count">${count}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="empty-state">No word frequency data</p>'}
        </div>
    `;
}

// Modal functions
function openModal() {
    pageModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    pageModal.classList.remove('active');
    document.body.style.overflow = '';
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        performSearch,
        displayResults,
        loadPageDetails
    };
}
