import Chart from '../chart.js/auto';

// ===== Global State ===== 
let currentHistory = [];
let filteredHistory = [];
let currentFilter = 'all';
let currentPage = 1;
let currentSearchTerm = '';
const itemsPerPage = 10;
let pieChart, riskChart, trendChart;
let isSyncing = false;
let syncQueue = 0;

// ===== DOM References =====
const pages = {
    dashboard: document.getElementById('page-dashboard'),
    history: document.getElementById('page-history'),
    settings: document.getElementById('page-settings')
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', async () => {
    // Load settings from storage
    await loadSettings();
    
    // Load history data
    await loadHistoryData();
    
    // Initialize UI
    updateStats();
    updateCharts();
    updateKeywordList();
    updateDomainList();
    displayHistory();
    updatePagination();
    
    // Attach event listeners
    attachEventListeners();
    
    // Start auto-sync
    if(useFirebase){
    setInterval(syncLocalToFirebase,30000);
}
    
    // Show welcome notification
    showNotification('PhishGuard AI is ready!', 'success');
});

// ===== Settings Management =====
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['darkMode', 'autoScan', 'sensitivity', 'cloudSync', 'notifications'], (result) => {
            if (result.darkMode) {
                document.body.classList.add('dark-mode');
                document.getElementById('darkModeToggle').checked = true;
            }
            
            document.getElementById('autoScanToggle').checked = result.autoScan !== false;
            document.getElementById('sensitivitySelect').value = result.sensitivity || 'medium';
            document.getElementById('cloudSyncToggle').checked = false;
            document.getElementById('cloudSyncToggle').disabled = true;
            document.getElementById('notifToggle').checked = result.notifications !== false;
            
            useFirebase = result.cloudSync !== false;
            resolve();
        });
    });
}

function saveSetting(key, value) {
    chrome.storage.local.set({ [key]: value });
}

// ===== History Data Management =====
async function loadHistoryData() {
    try {
        // Try to load from chrome storage first
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['scanHistory'], resolve);
        });
        
        if (result.scanHistory && result.scanHistory.length > 0) {
            currentHistory = result.scanHistory;
        } else if (useFirebase && db) {
            // Fallback to Firebase
            await loadFromFirebase();
        } else {
            // Load demo data
            currentHistory = getDemoData();
        }
    } catch (error) {
        console.error('Error loading history:', error);
        currentHistory = getDemoData();
    }
    
    filteredHistory = [...currentHistory];
}

function getDemoData() {
    const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'company.com', 'bank.com'];
    const subjects = ['Invoice', 'Account Update', 'Security Alert', 'Payment Confirmation', 'Meeting Reminder'];
    const senders = ['John Doe', 'Support Team', 'Admin', 'HR Department', 'IT Security'];
    
    const data = [];
    for (let i = 0; i < 25; i++) {
        const riskLevel = ['safe', 'phishing', 'suspicious'][Math.floor(Math.random() * 3)];
        const confidence = riskLevel === 'safe' ? Math.random() * 30 : 70 + Math.random() * 30;
        
        data.push({
            id: `demo_${i}`,
            timestamp: new Date(Date.now() - i * 3600000).toISOString(),
            sender: `${senders[i % 5]} <user@${domains[i % 5]}>`,
            subject: `${subjects[i % 5]} #${i + 1}`,
            confidence: Math.round(confidence),
            riskLevel: riskLevel,
            reasons: ['Suspicious link', 'Unusual sender', 'Urgency language'].slice(0, Math.floor(Math.random() * 3) + 1),
            scannedContent: `Sample email content for demo entry ${i + 1}`
        });
    }
    return data;
}

async function loadFromFirebase() {
    try {
        const q = query(collection(db, 'scanHistory'), orderBy('timestamp', 'desc'), limit(200));
        const querySnapshot = await getDocs(q);
        
        currentHistory = [];
        querySnapshot.forEach((doc) => {
            currentHistory.push({
                id: doc.id,
                ...doc.data()
            });
        });
    } catch (error) {
        console.error('Error loading from Firebase:', error);
        currentHistory = getDemoData();
    }
}

// ===== Save to Firebase =====
async function saveHistoryToFirebase(scanData) {
    if (!useFirebase || !db) return;
    
    try {
        const docRef = await addDoc(collection(db, 'scanHistory'), {
            ...scanData,
            timestamp: Timestamp.fromDate(new Date(scanData.timestamp))
        });
        scanData.id = docRef.id;
        return docRef.id;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        showNotification('Failed to sync to cloud', 'error');
        return null;
    }
}

async function deleteHistoryFromFirebase(docId) {
    if (!useFirebase || !db) return;
    
    try {
        await deleteDoc(doc(db, 'scanHistory', docId));
    } catch (error) {
        console.error('Error deleting from Firebase:', error);
    }
}

async function clearAllHistoryFromFirebase() {
    if (!useFirebase || !db) return;
    
    try {
        const querySnapshot = await getDocs(collection(db, 'scanHistory'));
        const deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);
    } catch (error) {
        console.error('Error clearing Firebase history:', error);
    }
}

// ===== Sync Functions =====
async function syncLocalToFirebase() {
    if (!useFirebase || !db || isSyncing) return;
    
    isSyncing = true;
    updateSyncStatus('syncing');
    
    try {
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(['scanHistory', 'lastSync'], resolve);
        });
        
        const localHistory = result.scanHistory || [];
        const lastSync = result.lastSync || 0;
        
        // Only sync new items
        const newItems = localHistory.filter(item => 
            !item.synced && new Date(item.timestamp).getTime() > lastSync
        );
        
        for (const item of newItems) {
            await saveHistoryToFirebase(item);
            item.synced = true;
        }
        
        // Update last sync time
        const now = Date.now();
        chrome.storage.local.set({ 
            scanHistory: localHistory,
            lastSync: now 
        });
        
        document.getElementById('lastSyncTime').textContent = new Date(now).toLocaleString();
        syncQueue = 0;
        document.getElementById('syncQueue').textContent = '0';
        
        updateSyncStatus('idle');
        showNotification('Sync completed successfully', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        updateSyncStatus('error');
        showNotification('Sync failed', 'error');
    } finally {
        isSyncing = false;
    }
}

function updateSyncStatus(status) {
    const indicator = document.getElementById('syncIndicator');
    indicator.className = 'sync-indicator ' + status;
    
    const statusText = {
        'idle': 'Idle',
        'syncing': 'Syncing...',
        'error': 'Error'
    };
    
    indicator.textContent = statusText[status] || 'Unknown';
}

// ===== Scan Result Saving =====
async function saveScanResult(scanData) {
    // Add to local history
    const newEntry = {
        id: 'local_' + Date.now(),
        timestamp: new Date().toISOString(),
        ...scanData,
        synced: false
    };
    
    currentHistory.unshift(newEntry);
    filteredHistory = [...currentHistory];
    
    // Save to chrome storage
    const result = await new Promise((resolve) => {
        chrome.storage.local.get(['scanHistory'], resolve);
    });
    
    const history = result.scanHistory || [];
    history.unshift(newEntry);
    
    // Keep only last 200 items
    if (history.length > 200) {
        history.length = 200;
    }
    
    await new Promise((resolve) => {
        chrome.storage.local.set({ scanHistory: history }, resolve);
    });
    
    // Try to sync to Firebase
    if (useFirebase && db && navigator.onLine) {
        const firebaseId = await saveHistoryToFirebase(newEntry);
        if (firebaseId) {
            newEntry.id = firebaseId;
            newEntry.synced = true;
        }
    }
    
    // Update UI
    updateStats();
    updateCharts();
    updateKeywordList();
    updateDomainList();
    displayHistory();
    updatePagination();
    
    return newEntry;
}

// ===== Delete History Entry =====
async function deleteHistoryEntry(entryId) {
    const index = currentHistory.findIndex(item => item.id === entryId);
    if (index === -1) return;
    
    const entry = currentHistory[index];
    
    // Remove from local
    currentHistory.splice(index, 1);
    filteredHistory = [...currentHistory];
    
    // Update chrome storage
    const result = await new Promise((resolve) => {
        chrome.storage.local.get(['scanHistory'], resolve);
    });
    
    let history = result.scanHistory || [];
    history = history.filter(item => item.id !== entryId);
    
    await new Promise((resolve) => {
        chrome.storage.local.set({ scanHistory: history }, resolve);
    });
    
    // Delete from Firebase if synced
    if (entry.synced && useFirebase && db) {
        await deleteHistoryFromFirebase(entryId);
    }
    
    // Update UI
    updateStats();
    updateCharts();
    updateKeywordList();
    updateDomainList();
    displayHistory();
    updatePagination();
    
    showNotification('Entry deleted', 'info');
}

// ===== Clear All History =====
async function clearAllHistory() {
    if (!confirm('Are you sure you want to clear all history? This cannot be undone.')) return;
    
    currentHistory = [];
    filteredHistory = [];
    
    // Clear chrome storage
    await new Promise((resolve) => {
        chrome.storage.local.set({ scanHistory: [] }, resolve);
    });
    
    // Clear Firebase
    if (useFirebase && db) {
        await clearAllHistoryFromFirebase();
    }
    
    // Update UI
    updateStats();
    updateCharts();
    updateKeywordList();
    updateDomainList();
    displayHistory();
    updatePagination();
    
    showNotification('All history cleared', 'info');
}

// ===== Update Stats =====
function updateStats() {
    const total = currentHistory.length;
    const phishing = currentHistory.filter(item => item.riskLevel === 'phishing').length;
    const safe = currentHistory.filter(item => item.riskLevel === 'safe').length;
    const suspicious = currentHistory.filter(item => item.riskLevel === 'suspicious').length;
    
    document.getElementById('totalScanned').textContent = total;
    document.getElementById('totalPhishing').textContent = phishing;
    document.getElementById('totalSafe').textContent = safe;
    document.getElementById('totalSuspicious').textContent = suspicious;
    
    // Update history stats
    document.getElementById('totalCount').textContent = total;
    document.getElementById('phishingCount').textContent = phishing;
    document.getElementById('safeCount').textContent = safe;
    document.getElementById('suspiciousCount').textContent = suspicious;
}

// ===== Update Charts =====
function updateCharts() {
    const phishing = currentHistory.filter(item => item.riskLevel === 'phishing').length;
    const safe = currentHistory.filter(item => item.riskLevel === 'safe').length;
    const suspicious = currentHistory.filter(item => item.riskLevel === 'suspicious').length;
    
    // Pie Chart
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    
    pieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: ['Safe', 'Phishing', 'Suspicious'],
            datasets: [{
                data: [safe, phishing, suspicious],
                backgroundColor: [
                    'rgba(72, 187, 120, 0.8)',
                    'rgba(245, 101, 101, 0.8)',
                    'rgba(237, 137, 54, 0.8)'
                ],
                borderColor: [
                    'rgba(72, 187, 120, 1)',
                    'rgba(245, 101, 101, 1)',
                    'rgba(237, 137, 54, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#2d3748'
                    }
                }
            }
        }
    });
    
    // Risk Distribution Chart
    const riskCtx = document.getElementById('riskChart').getContext('2d');
    if (riskChart) riskChart.destroy();
    
    const riskLevels = ['0-20', '21-40', '41-60', '61-80', '81-100'];
    const riskCounts = riskLevels.map(range => {
        const [min, max] = range.split('-').map(Number);
        return currentHistory.filter(item => item.confidence >= min && item.confidence <= max).length;
    });
    
    riskChart = new Chart(riskCtx, {
        type: 'bar',
        data: {
            labels: riskLevels,
            datasets: [{
                label: 'Number of Emails',
                data: riskCounts,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#2d3748'
                    }
                },
                x: {
                    ticks: {
                        color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#2d3748'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#2d3748'
                    }
                }
            }
        }
    });
    
    // Trend Chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    if (trendChart) trendChart.destroy();
    
    // Group by date (last 7 days)
    const last7Days = [];
    const phishingTrend = [];
    const safeTrend = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        last7Days.push(dateStr);
        
        const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
        const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();
        
        const dayItems = currentHistory.filter(item => {
            const itemTime = new Date(item.timestamp).getTime();
            return itemTime >= dayStart && itemTime <= dayEnd;
        });
        
        phishingTrend.push(dayItems.filter(item => item.riskLevel === 'phishing').length);
        safeTrend.push(dayItems.filter(item => item.riskLevel === 'safe').length);
    }
    
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [
                {
                    label: 'Phishing',
                    data: phishingTrend,
                    borderColor: 'rgba(245, 101, 101, 1)',
                    backgroundColor: 'rgba(245, 101, 101, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Safe',
                    data: safeTrend,
                    borderColor: 'rgba(72, 187, 120, 1)',
                    backgroundColor: 'rgba(72, 187, 120, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#2d3748'
                    }
                },
                x: {
                    ticks: {
                        color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#2d3748'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#2d3748'
                    }
                }
            }
        }
    });
}

// ===== Update Keyword List =====
function updateKeywordList() {
    const keywordCounts = {};
    const phishingKeywords = ['urgent', 'password', 'verify', 'account', 'suspended', 'click here', 'limited', 'security', 'update', 'confirm'];
    
    currentHistory.forEach(item => {
        if (item.reasons) {
            item.reasons.forEach(reason => {
                phishingKeywords.forEach(keyword => {
                    if (reason.toLowerCase().includes(keyword)) {
                        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                    }
                });
            });
        }
    });
    
    const sortedKeywords = Object.entries(keywordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const keywordList = document.getElementById('keywordList');
    keywordList.innerHTML = '';
    
    sortedKeywords.forEach(([keyword, count]) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${keyword}</span>
            <span class="count-badge">${count}</span>
        `;
        keywordList.appendChild(li);
    });
    
    if (sortedKeywords.length === 0) {
        keywordList.innerHTML = '<li class="empty-message">No keywords detected yet</li>';
    }
}

// ===== Update Domain List =====
function updateDomainList() {
    const domainCounts = {};
    
    currentHistory.forEach(item => {
        const match = item.sender.match(/@([\w.-]+)/);
        if (match) {
            const domain = match[1];
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        }
    });
    
    const sortedDomains = Object.entries(domainCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const domainList = document.getElementById('domainList');
    domainList.innerHTML = '';
    
    sortedDomains.forEach(([domain, count]) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${domain}</span>
            <span class="count-badge">${count}</span>
        `;
        domainList.appendChild(li);
    });
    
    if (sortedDomains.length === 0) {
        domainList.innerHTML = '<li class="empty-message">No domains detected yet</li>';
    }
}

// ===== Display History =====
function displayHistory() {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';

    // Apply filters
    let displayData = [...currentHistory];
    if (currentFilter !== 'all') {
        if (currentFilter === 'high') {
            displayData = displayData.filter(item => item.riskLevel === 'phishing' && item.confidence >= 80);
        } else if (currentFilter === 'medium') {
            displayData = displayData.filter(item => item.riskLevel === 'suspicious' || (item.riskLevel === 'phishing' && item.confidence < 80));
        } else {
            displayData = displayData.filter(item => item.riskLevel === currentFilter);
        }
    }
    if (currentSearchTerm) {
        const searchLower = currentSearchTerm.toLowerCase();
        displayData = displayData.filter(item =>
            item.sender.toLowerCase().includes(searchLower) ||
            item.subject.toLowerCase().includes(searchLower) ||
            (item.reasons && item.reasons.some(r => r.toLowerCase().includes(searchLower)))
        );
    }

    filteredHistory = displayData;

    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = displayData.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">📭 No scan history found</td></tr>';
        return;
    }

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        const confidencePercent = item.confidence;
        const riskClass = item.riskLevel;
        const dangerClass = riskClass === 'phishing' ? 'phishing' : 'safe';
        const riskBadge = getRiskBadge(riskClass, confidencePercent);
        const preview = `${escapeHtml(item.sender)}<br><small>${escapeHtml(item.subject)}</small>`;
        const reasonsHtml = item.reasons && item.reasons.length > 0
            ? `<div style="margin-top:6px;font-size:11px;color:#ff1744;background:rgba(255,23,68,0.08);padding:4px 8px;border-radius:6px;">
                 <strong>Reasons:</strong> ${item.reasons.slice(0,2).map(r => escapeHtml(r)).join(', ')}
               </div>`
            : '';

        tr.innerHTML = `
            <td>
                <div class="email-snippet">${preview}${reasonsHtml}</div>
            </td>
            <td class="${dangerClass}">${riskClass === 'phishing' ? '⚠️ Phishing' : '✅ Safe'}</td>
            <td>
                <div class="confidence-bar" style="width:100px;background:#e0e0e0;border-radius:10px;overflow:hidden;margin-bottom:4px;">
                    <div class="confidence-fill" style="width:${confidencePercent}%;height:8px;background:${confidencePercent > 70 ? '#ff1744' : confidencePercent > 40 ? '#ff9100' : '#00e676'};"></div>
                </div>
                <span style="font-size:12px;">${confidencePercent}%</span>
            </td>
            <td>${riskBadge}</td>
            <td style="font-size:12px;">
                ${new Date(item.timestamp).toLocaleString()}
                <div style="font-size:10px;color:#888;margin-top:3px;">${item.scanType === 'auto' ? '🤖 Auto' : '👤 Manual'}</div>
            </td>
            <td>
                <div class="action-buttons-cell" style="display:flex;gap:6px;">
                    <button class="table-action-btn view" onclick="viewDetails('${item.id}')">👁️</button>
                    <button class="table-action-btn delete" onclick="deleteHistoryEntry('${item.id}')">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Helper to generate risk badge
function getRiskBadge(riskLevel, confidence) {
    if (riskLevel === 'phishing') {
        return `<span class="risk-badge high">HIGH RISK</span>`;
    } else if (riskLevel === 'suspicious' || (riskLevel === 'safe' && confidence > 50)) {
        return `<span class="risk-badge medium">MEDIUM RISK</span>`;
    } else {
        return `<span class="risk-badge low">LOW RISK</span>`;
    }
}

// Override updateStats to also update new stats bar
function updateStats() {
    const total = currentHistory.length;
    const phishing = currentHistory.filter(item => item.riskLevel === 'phishing').length;
    const safe = currentHistory.filter(item => item.riskLevel === 'safe').length;
    const suspicious = currentHistory.filter(item => item.riskLevel === 'suspicious').length;
    const highRisk = currentHistory.filter(item => item.riskLevel === 'phishing' && item.confidence >= 80).length;

    document.getElementById('totalScanned').textContent = total;
    document.getElementById('totalPhishing').textContent = phishing;
    document.getElementById('totalSafe').textContent = safe;
    document.getElementById('totalSuspicious').textContent = suspicious;

    // New stats bar IDs
    document.getElementById('totalScans').textContent = total;
    document.getElementById('phishingCount').textContent = phishing;
    document.getElementById('safeCount').textContent = safe;
    document.getElementById('highRiskCount').textContent = highRisk;
}

// ===== Update Pagination =====
function updatePagination() {
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
    
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

// ===== View Details =====
function viewDetails(entryId) {
    const entry = currentHistory.find(item => item.id === entryId);
    if (!entry) return;
    
    const details = `
        <div class="details-modal">
            <h3>Scan Details</h3>
            <div class="details-content">
                <p><strong>Date:</strong> ${new Date(entry.timestamp).toLocaleString()}</p>
                <p><strong>Sender:</strong> ${escapeHtml(entry.sender)}</p>
                <p><strong>Subject:</strong> ${escapeHtml(entry.subject)}</p>
                <p><strong>Confidence:</strong> ${entry.confidence}%</p>
                <p><strong>Risk Level:</strong> <span class="risk-badge ${entry.riskLevel}">${entry.riskLevel}</span></p>
                ${entry.reasons ? `
                    <p><strong>Reasons:</strong></p>
                    <ul>
                        ${entry.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                    </ul>
                ` : ''}
                ${entry.scannedContent ? `
                    <p><strong>Scanned Content:</strong></p>
                    <div class="scanned-content">${escapeHtml(entry.scannedContent)}</div>
                ` : ''}
            </div>
            <button onclick="closeModal()" class="action-btn">Close</button>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'detailsModal';
    modal.innerHTML = details;
    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.getElementById('detailsModal');
    if (modal) modal.remove();
}

// ===== Export Functions =====
function exportToCSV() {
    if (currentHistory.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    const headers = ['Timestamp', 'Sender', 'Subject', 'Confidence', 'Risk Level', 'Reasons'];
    const rows = currentHistory.map(item => [
        item.timestamp,
        `"${item.sender.replace(/"/g, '""')}"`,
        `"${item.subject.replace(/"/g, '""')}"`,
        item.confidence,
        item.riskLevel,
        `"${(item.reasons || []).join('; ').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('');
    downloadFile(csvContent, 'phishguard_history.csv', 'text/csv');
    showNotification('CSV exported successfully', 'success');
}

function exportToJSON() {
    if (currentHistory.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    const jsonContent = JSON.stringify(currentHistory, null, 2);
    downloadFile(jsonContent, 'phishguard_history.json', 'application/json');
    showNotification('JSON exported successfully', 'success');
}

function importFromJSON(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (!Array.isArray(importedData)) {
                showNotification('Invalid JSON format', 'error');
                return;
            }
            
            // Merge with existing data
            currentHistory = [...importedData, ...currentHistory];
            
            // Remove duplicates by id
            const seen = new Set();
            currentHistory = currentHistory.filter(item => {
                const duplicate = seen.has(item.id);
                seen.add(item.id);
                return !duplicate;
            });
            
            // Keep only last 200 items
            if (currentHistory.length > 200) {
                currentHistory.length = 200;
            }
            
            filteredHistory = [...currentHistory];
            
            // Save to storage
            await new Promise((resolve) => {
                chrome.storage.local.set({ scanHistory: currentHistory }, resolve);
            });
            
            // Update UI
            updateStats();
            updateCharts();
            updateKeywordList();
            updateDomainList();
            displayHistory();
            updatePagination();
            
            showNotification(`Imported ${importedData.length} entries`, 'success');
        } catch (error) {
            showNotification('Error importing JSON', 'error');
        }
    };
    reader.readAsText(file);
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ===== Utility Functions =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== Event Listeners =====
function attachEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            
            const page = item.dataset.page;
            Object.keys(pages).forEach(key => pages[key].classList.remove('active'));
            pages[page]?.classList.add('active');
            
            // Close sidebar on mobile
            document.getElementById('sidebar').classList.remove('open');
            
            // Refresh charts when switching to dashboard
            if (page === 'dashboard') {
                setTimeout(updateCharts, 100);
            }
        });
    });
    
    // Menu toggle
    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            currentPage = 1;
            displayHistory();
            updatePagination();
        });
    });
    
    // Search
    document.getElementById('searchBtn').addEventListener('click', () => {
        currentSearchTerm = document.getElementById('searchInput').value;
        currentPage = 1;
        displayHistory();
        updatePagination();
    });
    
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('searchBtn').click();
        }
    });
    
    // Pagination
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayHistory();
            updatePagination();
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayHistory();
            updatePagination();
        }
    });
    
    // Export buttons
    document.getElementById('exportCSVBtn')?.addEventListener('click', exportToCSV);
    document.getElementById('exportJSONBtn')?.addEventListener('click', exportToJSON);
    document.getElementById('importJSONBtn')?.addEventListener('click', () => {
        document.getElementById('jsonFileInput').click();
    });
    document.getElementById('jsonFileInput')?.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            importFromJSON(e.target.files[0]);
            e.target.value = '';
        }
    });

    document.getElementById('syncBtn')
    ?.addEventListener('click', () => {
        showNotification('Cloud sync disabled', 'info');
    });    

    // History actions
    document.getElementById('clearHistoryBtn')?.addEventListener('click', clearAllHistory);
    document.getElementById('exportHistoryCSVBtn')?.addEventListener('click', exportToCSV);
    
    // Settings
    document.getElementById('autoScanToggle')?.addEventListener('change', (e) => {
        saveSetting('autoScan', e.target.checked);
    });
    
    document.getElementById('sensitivitySelect')?.addEventListener('change', (e) => {
        saveSetting('sensitivity', e.target.value);
    });
    
    document.getElementById('darkModeToggle')?.addEventListener('change', (e) => {
        document.body.classList.toggle('dark-mode', e.target.checked);
        saveSetting('darkMode', e.target.checked);
        setTimeout(updateCharts, 100);
    });
    
    document.getElementById('cloudSyncToggle')?.addEventListener('change', (e) => {
        useFirebase = e.target.checked;
        saveSetting('cloudSync', useFirebase);
        if (useFirebase && navigator.onLine) {
            syncLocalToFirebase();
        }
    });
    
    document.getElementById('notifToggle')?.addEventListener('change', (e) => {
        saveSetting('notifications', e.target.checked);
    });
    
    document.getElementById('clearAllBtn')?.addEventListener('click', clearAllHistory);
    document.getElementById('forceSyncBtn')?.addEventListener('click', syncLocalToFirebase);
    document.getElementById('exportDataBtn')?.addEventListener('click', exportToJSON);
    
    // Close modal on overlay click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });
}

// ===== Make functions globally accessible =====
window.viewDetails = viewDetails;
window.closeModal = closeModal;
window.deleteHistoryEntry = deleteHistoryEntry;