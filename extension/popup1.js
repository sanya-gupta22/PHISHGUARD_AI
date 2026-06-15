const API_URL = "https://phishing-detection-apia.onrender.com/predict";

// Global state
let currentTabId = null;
let lastProcessedEmailId = null;
let warningShownForCurrentEmail = false;
let scannedEmailsHistory = new Set();

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup loaded');

    // Get current tab
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTabId = tab.id;
    } catch (error) {
        console.error('Error getting tab:', error);
    }

    // Load scanned history
    await loadScannedHistory();

    // Attach button listeners
    document.getElementById('scanBtn').addEventListener('click', scanEmail);
    document.getElementById('historyBtn').addEventListener('click', openHistory);
    document.getElementById('dashboardBtn').addEventListener('click', openDashboard);
    document.getElementById('darkToggle').addEventListener('change', toggleDarkMode);

    // Load dark mode preference
    chrome.storage.local.get(["darkMode"], (result) => {
        if (result.darkMode) {
            document.getElementById("darkToggle").checked = true;
            document.body.classList.add("dark-mode");
        }
    });

    // Load latest scan result (for auto-scanned emails)
        chrome.storage.local.get(
            ["latestScanResult"],
            (result) => {

                if (result.latestScanResult) {

                    console.log(
                        "Loaded latest scan result from storage"
                    );

                    updateUIFromScanResult(
                        result.latestScanResult
                    );
                }

            }
        );

    // Listen for scan results
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "emailScanned" || request.action === "manualScanResult") {
            console.log('Received scan result:', request.result);
            const emailId = request.result.emailId;
            if (emailId && !scannedEmailsHistory.has(emailId)) {
                scannedEmailsHistory.add(emailId);
                saveScannedHistory();
            }
            updateUIFromScanResult(request.result);
            highlightSuspiciousContent(request.result);
            // Save to history + Firebase
            saveToHistory(request.result);
        }
        return true;
    });

    // Request current email status
    requestCurrentEmailStatus();
});

// ===== Navigation Functions =====

function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
}

// ===== Scan Email  ===== 
async function scanEmail() {
    console.log('Manual scan initiated');

    if (!currentTabId) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTabId = tab.id;
        } catch (error) {
            showNotification('Could not access current tab', 'error');
            return;
        }
    }

    showLoading();

    try {
        await ensureContentScriptInjected();
        chrome.tabs.sendMessage(currentTabId, { action: "forceScan" }, (response) => {
            if (chrome.runtime.lastError) {
                hideLoading();
                showNotification('Error: Page not ready. Refresh and try again.', 'error');
                return;
            }
            if (response && response.status === "scanning") {
                // Wait for message listener to handle result
            }
        });
    } catch (error) {
        hideLoading();
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// ===== UI Updates =====
function updateUIFromScanResult(result) {
    if (!result) return;

    const statusEl = document.getElementById("status");
    const confidenceEl = document.getElementById("confidence");
    const meterFill = document.getElementById("meter-fill");
    const riskLevel = document.getElementById("risk-level");
    const reasonsEl = document.getElementById("reasons");
    const tipsEl = document.getElementById("tips");

    const isPhishing = result.isPhishing || result.label === 'Phishing';
    const confidence = result.confidence || 0;
    const confidencePercent = Math.round(confidence * 100);
    const risk = confidencePercent > 70 ? 'High' : confidencePercent > 40 ? 'Medium' : 'Low';
    const reasons = result.reasons || [];
    const suspiciousWords = result.suspiciousWords || [];
    const suspiciousPhrases = result.suspiciousPhrases || [];

    // Status
    statusEl.innerText = `Status: ${isPhishing ? ' SUSPICIOUS' : ' SAFE'}`;
    statusEl.classList.remove('loading');

    // Confidence
    confidenceEl.innerText = `${confidencePercent}%`;

    // Meter
    meterFill.style.width = '0%';
    setTimeout(() => { meterFill.style.width = `${confidencePercent}%`; }, 100);

    // Risk level
    riskLevel.innerText = `Risk Level: ${risk}`;
    let riskColor = '#00ff88';
    let riskBg = 'rgba(0, 255, 136, 0.1)';
    if (risk === 'High') {
        riskColor = '#ff4444';
        riskBg = 'rgba(255, 68, 68, 0.1)';
    } else if (risk === 'Medium') {
        riskColor = '#ffaa00';
        riskBg = 'rgba(255, 170, 0, 0.1)';
    }
    riskLevel.style.borderLeft = `4px solid ${riskColor}`;
    riskLevel.style.background = riskBg;

    // Reasons
    let allReasons = [...reasons];
    if (suspiciousWords.length > 0) {
        allReasons.push(` Suspicious words: ${suspiciousWords.join(', ')}`);
    }
    if (suspiciousPhrases.length > 0) {
        allReasons.push(` Suspicious phrases: ${suspiciousPhrases.join(', ')}`);
    }

    if (allReasons.length > 0) {
        reasonsEl.innerHTML = `<h4> Analysis Results</h4>` +
            allReasons.map(r => `<p>${r}</p>`).join('');
    } else if (isPhishing) {
        reasonsEl.innerHTML = `<h4> Analysis Results</h4>
            <p> Suspicious patterns detected</p>
            <p> Email contains potential phishing indicators</p>`;
    } else {
        reasonsEl.innerHTML = `<h4> Analysis Results</h4>
            <p> No phishing indicators detected</p>
            <p> Email appears legitimate</p>`;
    }

    // Tips
    const tips = getDefaultTips(risk);
    tipsEl.innerHTML = `<h4> Safety Tips</h4>` +
        tips.map(t => `<p>${t}</p>`).join('');

    hideLoading();
}

function showLoading() {
    document.getElementById("status").innerText = " Scanning Email...";
    document.getElementById("status").classList.add('loading');
    document.getElementById("reasons").innerHTML = `<h4> Analysis Results</h4><p> Analyzing email content...</p>`;
    document.getElementById("tips").innerHTML = `<h4> Safety Tips</h4><p> Please wait...</p>`;
    document.getElementById("confidence").innerText = "Analyzing...";
}

function hideLoading() {
    document.getElementById("status").classList.remove('loading');
}

function getDefaultTips(riskLevel) {
    const tips = [
        ' Always verify the sender\'s email address',
        ' Hover over links to see actual URL before clicking',
        ' Never share passwords or personal information via email'
    ];
    if (riskLevel === 'High') {
        tips.unshift(' URGENT: Do not interact with this email!');
        tips.push(' Report this email as phishing immediately');
        tips.push(' Do not reply or click any links');
    }
    return tips;
}

// ===== Content Script Management =====
async function ensureContentScriptInjected() {
    try {
        await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(currentTabId, { action: "ping" }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error('Content script not loaded'));
                } else {
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.log('Injecting content script...');
        await chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

async function highlightSuspiciousContent(result) {
    if (!currentTabId) return;
    try {
        await ensureContentScriptInjected();
        chrome.tabs.sendMessage(currentTabId, {
            action: "highlightPhishing",
            data: {
                suspiciousWords: result.suspiciousWords || [],
                suspiciousPhrases: result.suspiciousPhrases || [],
                confidence: result.confidence,
                isPhishing: result.isPhishing
            }
        });
    } catch (error) {
        console.log('Highlight failed:', error);
    }
}

async function requestCurrentEmailStatus() {
    if (!currentTabId) return;
    try {
        await ensureContentScriptInjected();
        chrome.tabs.sendMessage(currentTabId, { action: "getScanStatus" }, (response) => {
            if (response && response.status === "scanned" && response.data) {
                updateUIFromScanResult(response.data);
            }
        });
    } catch (error) {
        console.log('Could not get status:', error);
    }
}

// ===== Open History Page =====
function openHistory() {
    chrome.tabs.create({ url: chrome.runtime.getURL("history.html") });
}

// ===== History Management =====
async function loadScannedHistory() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["scannedEmails"], (result) => {
            if (result.scannedEmails) {
                scannedEmailsHistory = new Set(result.scannedEmails);
            }
            resolve();
        });
    });
}

function saveScannedHistory() {
    const historyArray = Array.from(scannedEmailsHistory);
    if (historyArray.length > 500) {
        historyArray.splice(0, historyArray.length - 500);
    }
    chrome.storage.local.set({ scannedEmails: historyArray });
}


// ===== Save to History  =====
function saveToHistory(data, scanType = 'manual') {
    const entry = {
        emailId: data.emailId || Date.now().toString(),
        sender: data.sender || 'Unknown',
        subject: data.subject || 'No subject',
        confidence: Math.round((data.confidence || 0) * 100),
        riskLevel: data.isPhishing ? 'phishing' : 'safe',
        reasons: data.reasons || [],
        timestamp: new Date().toISOString(),
        scanType: scanType,  // 'auto' or 'manual'
        synced: false
    };

    chrome.storage.local.get(["scanHistory"], (result) => {
        let history = result.scanHistory || [];
        history.unshift(entry);
        if (history.length > 200) history.length = 200;
        chrome.storage.local.set({ scanHistory: history }, () => {
            console.log('Saved to local history with scanType:', scanType);
        });
    });
}


// ===== Dark Mode =====
function toggleDarkMode(e) {
    document.body.classList.toggle("dark-mode", e.target.checked);
    chrome.storage.local.set({ darkMode: e.target.checked });
}

// ===== Notification (FIXED - was missing) =====
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.popup-notification');
    if (existing) existing.remove();

    const notif = document.createElement('div');
    notif.className = `popup-notification ${type}`;
    notif.textContent = message;
    notif.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
        color: white;
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: fadeInUp 0.3s ease;
        max-width: 90%;
        text-align: center;
    `;
    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// Add animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
`;
document.head.appendChild(style);