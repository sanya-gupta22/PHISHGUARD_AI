// ===== Sidebar Toggle (from app.js) =====
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
let hoverTimeout;

// Open sidebar on hover (desktop) or click (mobile)
if (menuToggle && sidebar) {
    menuToggle.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        sidebar.classList.add('open');
    });

    menuToggle.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
            if (!sidebar.matches(':hover')) {
                sidebar.classList.remove('open');
            }
        }, 300);
    });

    sidebar.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
    });

    sidebar.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
            sidebar.classList.remove('open');
        }, 300);
    });

    // Close sidebar when clicking a menu item (mobile)
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    });
}

// ===== Original history.js code (unchanged) =====
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
        console.log('Loaded history:', currentHistory);
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

// Function to extract unique reasons from email content dynamically
function extractDynamicReasons(emailContent, prediction, confidence) {
    const reasons = [];
    const lowerContent = emailContent.toLowerCase();
    
    // Only extract reasons for phishing emails
    if (prediction === "Phishing") {
        
        // Suspicious keywords detection
        const suspiciousPatterns = {
            'Urgent action required': ['urgent', 'immediately', 'as soon as possible', 'action required', 'verify now'],
            'Password/Account verification': ['password', 'verify your account', 'confirm your account', 'account verification', 'update your account'],
            'Suspicious links': ['click here', 'link below', 'follow this link', 'http://', 'https://', 'www.' ],
            'Bank/Financial references': ['bank', 'payment', 'credit card', 'debit card', 'paypal', 'account suspended', 'billing'],
            'Personal information request': ['ssn', 'social security', 'date of birth', 'address', 'phone number', 'driver license'],
            'Threatening language': ['suspended', 'closed', 'terminated', 'deactivated', 'locked', 'limited access'],
            'Spoofed sender indicators': ['@gmail.com', '@yahoo.com', '@outlook.com', 'paypa1', 'amaz0n'],
            'Unusual grammar/spelling': ['f0r', 'acc0unt', 'verificati0n', '!!!', 'clickable', 'kindly', 'dear customer'],
            'Attachment warning': ['attachment', 'download', 'invoice.pdf', 'document.zip', 'file attached'],
            'Prize/Winner scam': ['winner', 'won', 'prize', 'lottery', 'congratulations', 'cash reward']
        };
        
        // Check each pattern
        for (const [reason, keywords] of Object.entries(suspiciousPatterns)) {
            for (const keyword of keywords) {
                if (lowerContent.includes(keyword)) {
                    reasons.push(`${reason} detected in email`);
                    break;
                }
            }
        }
        
        // Extract sender domain analysis
        const senderMatch = emailContent.match(/from:\s*[<\[]?([^<\[>\s@]+@[^>\s\]]+)[>\]]?/i);
        if (senderMatch) {
            const sender = senderMatch[1];
            const domain = sender.split('@')[1];
            if (domain && !domain.includes('google') && !domain.includes('microsoft') && !domain.includes('yahoo')) {
                reasons.push(`Suspicious sender domain: ${domain}`);
            }
        }
        
        // Check for mismatched URLs (display text vs actual URL)
        const urlMatches = emailContent.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi);
        if (urlMatches) {
            reasons.push(`Contains ${urlMatches.length} hyperlinks that may be suspicious`);
        }
        
        // Check for unusual number of exclamation marks
        const exclamationCount = (emailContent.match(/!/g) || []).length;
        if (exclamationCount > 3) {
            reasons.push(`Unusual number of exclamation marks (${exclamationCount}) indicating urgency pressure`);
        }
        
        // Add confidence-based reason
        if (confidence > 0.8) {
            reasons.push(`High confidence (${Math.round(confidence * 100)}%) phishing detection`);
        } else if (confidence > 0.6) {
            reasons.push(`Medium confidence (${Math.round(confidence * 100)}%) phishing indicators found`);
        }
        
        // Remove duplicates and limit to 5 reasons
        const uniqueReasons = [...new Set(reasons)];
        return uniqueReasons.slice(0, 5);
    }
    
    return reasons;
}

// Function to find duplicate emails and count total scans (auto + manual)
function findDuplicateEmailsWithCounts() {
    const emailMap = new Map();
    
    currentHistory.forEach((item, index) => {
        // Create a unique key based on email content similarity
        let key = null;
        
        // Try to get email ID from URL first
        if (item.url && item.url.includes('/msg/')) {
            const match = item.url.match(/\/msg\/([a-f0-9]+)/);
            if (match) key = match[1];
        }
        
        // If no URL ID, use email content hash (first 200 chars)
        if (!key && item.email) {
            // Normalize email content for better matching
            const normalizedEmail = item.email
                .replace(/\s+/g, ' ')
                .replace(/[^\w\s]/g, '')
                .substring(0, 200);
            key = normalizedEmail;
        }
        
        if (key) {
            if (!emailMap.has(key)) {
                emailMap.set(key, {
                    emails: [],
                    totalScans: 0,
                    autoScans: 0,
                    manualScans: 0,
                    emailIds: []
                });
            }
            const entry = emailMap.get(key);
            entry.emails.push({ index, item });
            entry.totalScans++;
            if (item.scanType === 'auto') {
                entry.autoScans++;
            } else {
                entry.manualScans++;
            }
            if (item.emailId) entry.emailIds.push(item.emailId);
        }
    });
    
    return emailMap;
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
        default:
            filteredHistory = history;
    }
    
    if (filteredHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px;">
                    <div>No history found</div>
                    <div style="font-size: 12px; margin-top: 10px;">
                        ${filter !== 'all' ? 'Try a different filter' : 'Start scanning emails to see history here'}
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Get duplicate email mapping with counts
    const duplicateMap = findDuplicateEmailsWithCounts();
    
    filteredHistory.forEach((item, idx) => {
        const row = tbody.insertRow();
        
        // Find the actual index in currentHistory
        const actualIndex = currentHistory.findIndex(h => h === item);
        
        // Format email preview
        const confidencePercent = Math.round((item.confidence || 0) * 100);
        
        // Determine risk level
        let riskLevel = item.risk;
        if (item.prediction === "Safe") {
            riskLevel = "Low";
        } else if (item.prediction === "Phishing") {
            riskLevel = confidencePercent > 70 ? "High" : "Medium";
        }
        
        // Extract email content preview
        let emailPreview = item.email || item.text || '';
        emailPreview = emailPreview.substring(0, 150);
        
        // Extract email ID, thread ID, and original URL
        let emailId = null;
        let threadId = null;
        let originalUrl = item.url || '';
        
        if (originalUrl) {
            const gmailMatch = originalUrl.match(/\/msg\/([a-f0-9]+)/);
            if (gmailMatch) emailId = gmailMatch[1];
            
            const threadMatch = originalUrl.match(/\/b\/([A-Za-z0-9]+)/);
            if (threadMatch) threadId = threadMatch[1];
        }
        
        // Check if email might be deleted (older than 30 days)
        const scanDate = new Date(item.time);
        const daysOld = (new Date() - scanDate) / (1000 * 60 * 60 * 24);
        const isDeleted = daysOld > 30;
        
        // Find duplicate information for this email
        let duplicateInfo = null;
        let normalizedKey = null;
        
        // Normalize email for duplicate matching
        if (item.email) {
            const normalizedEmail = item.email
                .replace(/\s+/g, ' ')
                .replace(/[^\w\s]/g, '')
                .substring(0, 200);
            normalizedKey = normalizedEmail;
        }
        
        for (const [key, info] of duplicateMap.entries()) {
            const match = info.emails.some(e => e.index === actualIndex);
            if (match && info.totalScans > 1) {
                duplicateInfo = {
                    totalScans: info.totalScans,
                    autoScans: info.autoScans,
                    manualScans: info.manualScans
                };
                break;
            }
        }
        
        // Get dynamic reasons for phishing emails
        let reasonsHtml = '';
        if (item.prediction === "Phishing") {
            // Use saved reasons from scan or extract dynamically
            let reasons = item.reasons || [];
            if (reasons.length === 0 && item.email) {
                reasons = extractDynamicReasons(item.email, item.prediction, item.confidence);
            }
            
            if (reasons.length > 0) {
                reasonsHtml = `
                    <div style="margin-top: 8px; font-size: 11px; color: #ff1744; background: rgba(255,23,68,0.1); padding: 6px; border-radius: 6px;">
                        <strong>Detection reasons:</strong>
                        <ul style="margin: 4px 0 0 15px; padding: 0;">
                            ${reasons.slice(0, 3).map(r => `<li style="margin: 2px 0;">${escapeHtml(r)}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        }
        
        row.innerHTML = `
            <td class="email-preview">
                <div class="email-snippet">
                    ${escapeHtml(emailPreview)}${emailPreview.length >= 150 ? '...' : ''}
                    ${reasonsHtml}
                    ${isDeleted ? '<div class="deleted-badge" style="margin-top: 5px;">Email may be deleted from inbox</div>' : ''}
                    ${duplicateInfo ? `<div class="deleted-badge" style="background: #667eea; margin-top: 5px;">
                        Scanned ${duplicateInfo.totalScans} times total (${duplicateInfo.autoScans} auto, ${duplicateInfo.manualScans} manual)
                    </div>` : ''}
                </div>
            </td>
            <td class="${item.prediction === 'Phishing' ? 'phishing' : 'safe'}">
                ${item.prediction === 'Phishing' ? 'Phishing' : 'Safe'}
            </td>
            <td>
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidencePercent}%; background: ${confidencePercent > 70 ? '#ff1744' : confidencePercent > 40 ? '#ff9100' : '#00e676'};"></div>
                </div>
                <span style="font-size: 12px;">${confidencePercent}%</span>
            </td>
            <td class="risk-${riskLevel.toLowerCase()}">
                ${getRiskBadge(riskLevel)}
            </td>
            <td style="font-size: 12px;">
                ${item.time || new Date().toLocaleString()}
                ${item.scanType ? `<div style="font-size: 10px; color: #888; margin-top: 3px;">${item.scanType === 'auto' ? 'Auto-detected' : 'Manually scanned'}</div>` : ''}
            </td>
            <td>
                <div class="action-buttons-cell">
                    <button class="view-email-btn" 
                            data-email-id="${emailId || ''}" 
                            data-thread-id="${threadId || ''}" 
                            data-url="${escapeHtml(originalUrl)}"
                            data-email-content="${escapeHtml(item.email || '')}">
                        View Email
                    </button>
                    <button class="delete-item-btn" data-index="${actualIndex}">Delete</button>
                </div>
            </td>
        `;
    });
    
    // Add event listeners to view email buttons
    document.querySelectorAll('.view-email-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const emailId = btn.getAttribute('data-email-id');
            const threadId = btn.getAttribute('data-thread-id');
            const url = btn.getAttribute('data-url');
            const emailContent = btn.getAttribute('data-email-content');
            
            await openEmailInGmail(emailId, threadId, url, emailContent);
        });
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(btn.getAttribute('data-index'));
            deleteHistoryItem(index);
        });
    });
}

// Function to find the actual email in Gmail using multiple methods
async function findEmailInGmail(emailId, threadId, url, emailContent) {
    // Method 1: Try original URL
    if (url && url.includes('mail.google.com')) {
        return url;
    }
    
    // Method 2: Try using email ID
    if (emailId) {
        return `https://mail.google.com/mail/u/0/#inbox/${emailId}`;
    }
    
    // Method 3: Try using thread ID
    if (threadId) {
        return `https://mail.google.com/mail/u/0/#search/${threadId}`;
    }
    
    // Method 4: Try to extract subject from email content and search
    if (emailContent) {
        let subject = '';
        const subjectMatch = emailContent.match(/^Subject:\s*(.+)$/m);
        if (subjectMatch) {
            subject = subjectMatch[1];
            return `https://mail.google.com/mail/u/0/#search/subject:${encodeURIComponent(subject)}`;
        }
    }
    
    return null;
}

// Function to open email in Gmail
async function openEmailInGmail(emailId, threadId, url, emailContent) {
    console.log('Opening email with ID:', emailId, 'Thread:', threadId, 'URL:', url);
    
    showNotification('Searching for email in Gmail...', 'info');
    
    const emailUrl = await findEmailInGmail(emailId, threadId, url, emailContent);
    
    if (!emailUrl) {
        showNotification('Could not find this email. It may have been deleted or moved.', 'error');
        return;
    }
    
    chrome.tabs.create({ url: emailUrl });
    
    const isOldEmail = emailId && (Date.now() - (parseInt(emailId) || 0) > 2592000000);
    if (isOldEmail) {
        showNotification('Opening email (may be deleted if older than 30 days)', 'warning');
    } else {
        showNotification('Opening email in Gmail...', 'success');
    }
}

function getRiskBadge(risk) {
    if (risk === 'High') {
        return '<span style="background: #ff1744; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; display: inline-block;">HIGH</span>';
    } else if (risk === 'Medium') {
        return '<span style="background: #ff9100; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; display: inline-block;">MEDIUM</span>';
    } else {
        return '<span style="background: #00e676; color: white; padding: 4px 10px; border-radius: 20px; font-size: 11px; display: inline-block;">LOW</span>';
    }
}

function deleteHistoryItem(index) {
    if (confirm('Are you sure you want to delete this history entry? This cannot be undone.')) {
        console.log('Deleting item at index:', index);
        currentHistory.splice(index, 1);
        chrome.storage.local.set({ history: currentHistory }, () => {
            console.log('History updated, new length:', currentHistory.length);
            loadHistory();
            showNotification('Entry deleted successfully', 'success');
        });
    }
}

function clearAllHistory() {
    if (confirm('WARNING: This will delete ALL history entries. This action cannot be undone. Are you sure?')) {
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
    
    const headers = ['Prediction', 'Confidence %', 'Risk Level', 'Scan Type', 'Scan Time', 'Email URL', 'Reasons', 'Email Preview'];
    const csvRows = [headers];
    
    currentHistory.forEach(item => {
        const confidencePercent = Math.round((item.confidence || 0) * 100);
        let riskLevel = item.risk;
        if (item.prediction === "Safe") {
            riskLevel = "Low";
        } else if (item.prediction === "Phishing") {
            riskLevel = confidencePercent > 70 ? "High" : "Medium";
        }
        
        const reasons = item.reasons || [];
        const reasonsText = reasons.join('; ');
        
        csvRows.push([
            item.prediction || 'Unknown',
            confidencePercent,
            riskLevel,
            item.scanType || 'manual',
            item.time || new Date().toLocaleString(),
            `"${(item.url || '').replace(/"/g, '""')}"`,
            `"${reasonsText.replace(/"/g, '""')}"`,
            `"${(item.email || '').substring(0, 200).replace(/"/g, '""')}"`
        ]);
    });
    
    const csvContent = csvRows.map(row => row.join(",")).join(" ");
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
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#ff1744' : type === 'warning' ? '#ff9100' : '#667eea'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10001;
        animation: slideUp 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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