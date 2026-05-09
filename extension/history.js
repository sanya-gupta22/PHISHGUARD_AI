// history.js - Complete history management with full email display

let currentHistory = [];
let currentFilter = "all";

// Load and display history on page load
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    
    // Load dark mode preference
    chrome.storage.local.get(["darkMode"], (result) => {
        if (result.darkMode) {
            document.body.classList.add("dark-mode");
        }
    });
});

function loadHistory() {
    chrome.storage.local.get(["history"], (result) => {
        currentHistory = result.history || [];
        updateStats();
        displayHistory(currentHistory, currentFilter);
    });
}

function updateStats() {
    const total = currentHistory.length;
    const phishing = currentHistory.filter(item => item.prediction === "Phishing").length;
    const safe = currentHistory.filter(item => item.prediction === "Safe").length;
    const highRisk = currentHistory.filter(item => item.risk === "High").length;
    
    document.getElementById("totalScans").innerText = total;
    document.getElementById("phishingCount").innerText = phishing;
    document.getElementById("safeCount").innerText = safe;
    document.getElementById("highRiskCount").innerText = highRisk;
}

function displayHistory(history, filter) {
    const tbody = document.getElementById("historyTableBody");
    tbody.innerHTML = "";
    
    let filteredHistory = history;
    
    switch(filter) {
        case "Phishing":
            filteredHistory = history.filter(item => item.prediction === "Phishing");
            break;
        case "Safe":
            filteredHistory = history.filter(item => item.prediction === "Safe");
            break;
        case "High":
            filteredHistory = history.filter(item => item.risk === "High");
            break;
        case "Medium":
            filteredHistory = history.filter(item => item.risk === "Medium");
            break;
        case "Low":
            filteredHistory = history.filter(item => item.risk === "Low" || !item.risk);
            break;
        default:
            filteredHistory = history;
    }
    
    if (filteredHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <div> No ${filter !== 'all' ? filter : ''} emails found</div>
                    <div style="font-size: 12px; margin-top: 10px;">
                        ${filter !== 'all' ? 'Try a different filter' : 'Start scanning emails to see history here'}
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    filteredHistory.forEach((item, index) => {
        const row = tbody.insertRow();
        const originalIndex = history.findIndex(h => h === item);
        
        // Format email preview
        const confidencePercent = Math.round((item.confidence || 0) * 100);
        const emailPreview = item.email || item.text || '';
        const subject = item.subject || 'No Subject';
        const sender = item.sender || 'Unknown Sender';
        
        // Check if email might be deleted (older than 7 days or marked)
        const scanDate = new Date(item.time);
        const daysOld = (new Date() - scanDate) / (1000 * 60 * 60 * 24);
        const isDeleted = daysOld > 30; // Consider emails older than 30 days as "deleted"
        
        row.innerHTML = `
            <td class="email-preview">
                <div class="email-content">
                    <div class="email-subject"> ${escapeHtml(subject)}</div>
                    <div class="email-sender"> From: ${escapeHtml(sender)}</div>
                    <div class="email-snippet">${escapeHtml(emailPreview.substring(0, 100))}${emailPreview.length > 100 ? '...' : ''}</div>
                    ${isDeleted ? '<div class="deleted-badge" style="margin-top: 5px;"> Email may be deleted</div>' : ''}
                </div>
            </td>
            <td class="${item.prediction === 'Phishing' ? 'phishing' : 'safe'}">
                ${item.prediction === 'Phishing' ? ' Phishing' : ' Safe'}
            </td>
            <td>
                <div class="confidence-bar" style="width: 100%; background: #e0e0e0; border-radius: 10px; overflow: hidden;">
                    <div style="width: ${confidencePercent}%; background: ${confidencePercent > 70 ? '#ff1744' : confidencePercent > 40 ? '#ff9100' : '#00e676'}; height: 6px;"></div>
                </div>
                <span style="font-size: 12px;">${confidencePercent}%</span>
            </td>
            <td class="risk-${(item.risk || 'Low').toLowerCase()}">
                ${getRiskBadge(item.risk || (confidencePercent > 70 ? 'High' : confidencePercent > 40 ? 'Medium' : 'Low'))}
            </td>
            <td style="font-size: 12px;">
                ${item.time || new Date().toLocaleString()}
            </td>
            <td>
                <button class="view-details-btn" onclick="viewEmailDetails(${originalIndex})"> View Full</button>
                <button class="delete-item-btn" onclick="deleteHistoryItem(${originalIndex})"> Delete</button>
            </td>
        `;
    });
}

function getRiskBadge(risk) {
    const badges = {
        'High': '<span class="risk-high" style="background: #ff1744; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px;"> HIGH</span>',
        'Medium': '<span class="risk-medium" style="background: #ff9100; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px;"> MEDIUM</span>',
        'Low': '<span class="risk-low" style="background: #00e676; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px;"> LOW</span>'
    };
    return badges[risk] || badges['Low'];
}

function viewEmailDetails(index) {
    const item = currentHistory[index];
    if (!item) return;
    
    const confidencePercent = Math.round((item.confidence || 0) * 100);
    const emailContent = item.email || item.text || 'No content available';
    const subject = item.subject || 'No Subject';
    const sender = item.sender || 'Unknown Sender';
    const reasons = item.reasons || [];
    const scanDate = new Date(item.time);
    const daysOld = Math.round((new Date() - scanDate) / (1000 * 60 * 60 * 24));
    
    const modalBody = document.getElementById("modalBody");
    modalBody.innerHTML = `
        <div style="margin-bottom: 20px;">
            <strong> Subject:</strong><br>
            <div style="padding: 10px; background: #f0f0f0; border-radius: 8px; margin-top: 5px;">
                ${escapeHtml(subject)}
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <strong>👤 From:</strong><br>
            <div style="padding: 10px; background: #f0f0f0; border-radius: 8px; margin-top: 5px;">
                ${escapeHtml(sender)}
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <strong>🔍 Scan Result:</strong><br>
            <div style="margin-top: 5px;">
                <span class="${item.prediction === 'Phishing' ? 'phishing' : 'safe'}" style="font-size: 16px;">
                    ${item.prediction === 'Phishing' ? ' PHISHING DETECTED' : ' SAFE'}
                </span>
                <div style="margin-top: 10px;">
                    <div>Confidence: ${confidencePercent}%</div>
                    <div class="confidence-bar" style="width: 100%; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin-top: 5px;">
                        <div style="width: ${confidencePercent}%; background: ${confidencePercent > 70 ? '#ff1744' : confidencePercent > 40 ? '#ff9100' : '#00e676'}; height: 8px;"></div>
                    </div>
                </div>
            </div>
        </div>
        
        ${reasons.length > 0 ? `
        <div style="margin-bottom: 20px;">
            <strong> Reasons for Detection:</strong>
            <ul style="margin-top: 10px; padding-left: 20px;">
                ${reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        <div style="margin-bottom: 20px;">
            <strong> Scan Information:</strong><br>
            <div style="margin-top: 5px; font-size: 13px;">
                <div> Scanned on: ${item.time}</div>
                <div> Days ago: ${daysOld} days</div>
                ${daysOld > 30 ? '<div style="color: #ff9100;"> This email was scanned over 30 days ago and may no longer exist in your inbox</div>' : ''}
            </div>
        </div>
        
        <div>
            <strong> Email Content Preview:</strong>
            <div class="email-full-content">
                ${escapeHtml(emailContent.substring(0, 2000))}${emailContent.length > 2000 ? '...' : ''}
            </div>
        </div>
    `;
    
    const modal = document.getElementById("emailModal");
    modal.style.display = "flex";
    modal.style.animation = "slideDown 0.3s ease";
}

function closeModal() {
    const modal = document.getElementById("emailModal");
    modal.style.display = "none";
}

function deleteHistoryItem(index) {
    if (confirm('Are you sure you want to delete this history entry? This cannot be undone.')) {
        currentHistory.splice(index, 1);
        chrome.storage.local.set({ history: currentHistory }, () => {
            loadHistory();
            showNotification('Entry deleted successfully', 'success');
        });
    }
}

function clearAllHistory() {
    if (confirm(' WARNING: This will delete ALL history entries. This action cannot be undone. Are you sure?')) {
        currentHistory = [];
        chrome.storage.local.set({ history: [] }, () => {
            loadHistory();
            showNotification('All history cleared successfully', 'warning');
        });
    }
}

function exportToCSV() {
    if (currentHistory.length === 0) {
        showNotification('No history to export', 'error');
        return;
    }
    
    const headers = ['Subject', 'Sender', 'Prediction', 'Confidence %', 'Risk Level', 'Scan Time', 'Email Preview'];
    const csvRows = [headers];
    
    currentHistory.forEach(item => {
        csvRows.push([
            `"${(item.subject || 'No Subject').replace(/"/g, '""')}"`,
            `"${(item.sender || 'Unknown').replace(/"/g, '""')}"`,
            item.prediction,
            Math.round((item.confidence || 0) * 100),
            item.risk || 'Low',
            item.time,
            `"${(item.email || '').substring(0, 200).replace(/"/g, '""')}"`
        ]);
    });
    
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phishguard_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('History exported successfully', 'success');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#ff1744' : '#ff9100'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10001;
        animation: slideUp 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Filter button event listeners
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        displayHistory(currentHistory, currentFilter);
    });
});

// Export and clear buttons
document.getElementById('exportBtn')?.addEventListener('click', exportToCSV);
document.getElementById('clearHistoryBtn')?.addEventListener('click', clearAllHistory);

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById("emailModal");
    if (event.target === modal) {
        closeModal();
    }
}