// content.js - Complete PhishGuard AI Content Script
// AUTOMATICALLY SCANS EVERY OPENED EMAIL - ONCE PER EMAIL ONLY
// PERSISTENT STORAGE TO PREVENT BANNER REAPPEARING AFTER PAGE RELOAD

console.log('PhishGuard AI: Content script loaded - Auto-scan mode ACTIVE');

let processedEmails = new Map(); // Store processed emails with timestamp and scan type
let scanInProgress = false;
let warningActive = false;
let currentWarningEmailId = null;

// ============================================
// PING HANDLER - For popup connection
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request.action);
    
    if (request.action === "ping") {
        sendResponse({ status: "ready", timestamp: Date.now() });
        return true;
    }
    
    if (request.action === "extractEmail") {
        let emailBody = extractEmailContent();
        sendResponse({
            text: emailBody ? emailBody.text : "",
            url: window.location.href,
            sender: emailBody ? emailBody.sender : "",
            subject: emailBody ? emailBody.subject : ""
        });
        return true;
    }
    
    if (request.action === "reportPhishing") {
        reportPhishingEmail();
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === "forceScan") {
        scanCurrentlyOpenedEmail('manual', true);
        sendResponse({ status: "scanning" });
        return true;
    }
    
    if (request.action === "getScanStatus") {
        const emailData = extractEmailContent();
        if (emailData && emailData.text) {
            const emailUniqueId = getEmailUniqueId(emailData);
            const scanInfo = processedEmails.get(emailUniqueId);
            
            if (scanInfo && scanInfo.result) {
                sendResponse({ status: "scanned", data: scanInfo.result });
            } else if (scanInProgress) {
                sendResponse({ status: "scanning" });
            } else {
                sendResponse({ status: "not_scanned" });
            }
        } else {
            sendResponse({ status: "no_email" });
        }
        return true;
    }
});

// ============================================
// PERSISTENT STORAGE FOR PROCESSED EMAILS
// ============================================
function loadProcessedEmailsFromStorage() {
    chrome.storage.local.get(["processedEmails"], (result) => {
        if (result.processedEmails) {
            // Convert object back to Map
            const savedMap = result.processedEmails;
            processedEmails = new Map();
            for (const [key, value] of Object.entries(savedMap)) {
                processedEmails.set(key, value);
            }
            console.log('Loaded processed emails from storage:', processedEmails.size);
        }
    });
}

function saveProcessedEmailsToStorage() {
    const saveObject = {};
    for (const [key, value] of processedEmails.entries()) {
        saveObject[key] = value;
    }
    chrome.storage.local.set({ processedEmails: saveObject });
    console.log('Saved processed emails to storage:', processedEmails.size);
}

// ============================================
// EXTRACT EMAIL CONTENT (Non-intrusive)
// ============================================
function extractEmailContent() {
    let emailElement = null;
    let sender = "";
    let subject = "";
    let emailId = "";
    
    // GMAIL - Use non-intrusive selectors that don't modify DOM
    if (window.location.hostname.includes('mail.google.com')) {
        emailElement = document.querySelector('.a3s') || 
                      document.querySelector('.ii.gt') ||
                      document.querySelector('[role="main"] .a3s');
        
        const senderElement = document.querySelector('.gD');
        if (senderElement) {
            sender = senderElement.getAttribute('email') || senderElement.innerText;
        }
        
        const subjectElement = document.querySelector('.hP');
        if (subjectElement) {
            subject = subjectElement.innerText;
        }
        
        const urlMatch = window.location.hash.match(/\/msg\/([a-f0-9]+)/);
        if (urlMatch) emailId = urlMatch[1];
    }
    // OUTLOOK
    else if (window.location.hostname.includes('outlook') || window.location.hostname.includes('office.com')) {
        emailElement = document.querySelector('[role="article"]') || document.querySelector('.message-content');
        const senderElement = document.querySelector('.ms-Persona-primaryDetail');
        if (senderElement) sender = senderElement.innerText;
        const subjectElement = document.querySelector('[aria-label*="Subject"]');
        if (subjectElement) subject = subjectElement.innerText;
    }
    // YAHOO MAIL
    else if (window.location.hostname.includes('mail.yahoo')) {
        emailElement = document.querySelector('.message-body');
        const senderElement = document.querySelector('.from .value');
        if (senderElement) sender = senderElement.innerText;
        const subjectElement = document.querySelector('.subject');
        if (subjectElement) subject = subjectElement.innerText;
    }
    
    if (!emailElement || !emailElement.innerText) {
        return null;
    }
    
    const emailText = emailElement.innerText;
    
    return {
        text: emailText,
        sender: sender,
        subject: subject,
        emailId: emailId,
        element: emailElement
    };
}

// ============================================
// EXTRACT DYNAMIC REASONS AND SAFETY TIPS
// ============================================
function extractDynamicReasonsAndTips(emailContent, confidence, isPhishing) {
    const reasons = [];
    const tips = [];
    const lowerContent = emailContent.toLowerCase();
    
    if (isPhishing) {
        // Check for different phishing indicators and add corresponding reasons and tips
        const indicators = [
            {
                pattern: ['urgent', 'immediately', 'as soon as possible', 'action required'],
                reason: 'Urgent language detected to create false urgency',
                tip: 'Be cautious of urgent requests - legitimate organizations give you time to respond'
            },
            {
                pattern: ['verify your account', 'confirm your account', 'account verification', 'update your account'],
                reason: 'Account verification request - common phishing tactic',
                tip: 'Never verify account details through email links. Go directly to the official website'
            },
            {
                pattern: ['password', 'change your password', 'reset password'],
                reason: 'Password-related request detected',
                tip: 'Legitimate services never ask for passwords via email'
            },
            {
                pattern: ['click here', 'link below', 'follow this link'],
                reason: 'Suspicious link prompt detected',
                tip: 'Hover over links to see actual URL before clicking'
            },
            {
                pattern: ['bank', 'payment', 'credit card', 'debit card', 'paypal'],
                reason: 'Financial information request detected',
                tip: 'Never share financial information via email'
            },
            {
                pattern: ['suspended', 'closed', 'terminated', 'deactivated', 'locked'],
                reason: 'Account threat language detected to create fear',
                tip: 'Contact the service directly using official contact information'
            },
            {
                pattern: ['ssn', 'social security', 'date of birth', 'driver license'],
                reason: 'Request for personal identification information',
                tip: 'Legitimate organizations don\'t request sensitive IDs via email'
            },
            {
                pattern: ['attachment', 'download', 'invoice.pdf', 'document.zip'],
                reason: 'Suspicious attachment detected',
                tip: 'Do not open unexpected attachments - verify with sender first'
            },
            {
                pattern: ['winner', 'won', 'prize', 'lottery', 'congratulations', 'cash reward'],
                reason: 'Prize or lottery scam detected',
                tip: 'If you didn\'t enter, you didn\'t win - ignore such emails'
            },
            {
                pattern: ['dear customer', 'dear user', 'valued customer'],
                reason: 'Generic greeting - legitimate services usually address you by name',
                tip: 'Check if the email addresses you personally by name'
            }
        ];
        
        indicators.forEach(indicator => {
            for (const pattern of indicator.pattern) {
                if (lowerContent.includes(pattern)) {
                    if (!reasons.includes(indicator.reason)) {
                        reasons.push(indicator.reason);
                    }
                    if (!tips.includes(indicator.tip)) {
                        tips.push(indicator.tip);
                    }
                    break;
                }
            }
        });
        
        // Extract sender domain
        const senderMatch = emailContent.match(/from:\s*[<\[]?([^<\[>\s@]+@[^>\s\]]+)[>\]]?/i);
        if (senderMatch) {
            const sender = senderMatch[1];
            const domain = sender.split('@')[1];
            if (domain && !domain.includes('google') && !domain.includes('microsoft') && !domain.includes('yahoo')) {
                reasons.push(`Suspicious sender domain: ${domain}`);
                tips.push(`Verify the sender domain - legitimate emails come from official domains`);
            }
        }
        
        // Count URLs
        const urlMatches = emailContent.match(/https?:\/\/[^\s]+/g);
        if (urlMatches && urlMatches.length > 0) {
            reasons.push(`Contains ${urlMatches.length} external URL(s)`);
            tips.push(`Hover over links to see where they actually lead before clicking`);
        }
        
        // Add confidence-based reason
        if (confidence > 0.8) {
            reasons.push(`High confidence (${Math.round(confidence * 100)}%) phishing detection by AI model`);
        } else if (confidence > 0.6) {
            reasons.push(`Medium confidence (${Math.round(confidence * 100)}%) phishing indicators found`);
        }
    } else {
        // Safe email tips
        tips.push('This email appears legitimate based on AI analysis');
        tips.push('Always remain vigilant even with safe-looking emails');
        tips.push('Verify sender information before taking any action');
    }
    
    // Add general safety tips if needed
    if (tips.length < 3 && isPhishing) {
        tips.push('Never share passwords or sensitive information via email');
        tips.push('Enable two-factor authentication on your important accounts');
        tips.push('Report suspicious emails to help protect others');
    }
    
    // Remove duplicates and limit
    const uniqueReasons = [...new Set(reasons)];
    const uniqueTips = [...new Set(tips)];
    
    return {
        reasons: uniqueReasons.slice(0, 5),
        tips: uniqueTips.slice(0, 5)
    };
}

// ============================================
// GET EMAIL UNIQUE ID
// ============================================
function getEmailUniqueId(emailData) {
    if (emailData.emailId && emailData.emailId !== '') {
        return emailData.emailId;
    }
    return btoa(`${emailData.subject}|${emailData.sender}|${emailData.text.substring(0, 200)}`);
}

// ============================================
// CHECK IF EMAIL WAS ALREADY PROCESSED
// ============================================
function isEmailProcessed(emailUniqueId) {
    return processedEmails.has(emailUniqueId);
}

function isWarningClosedForEmail(emailUniqueId) {
    const warningClosedKey = `warning_closed_${emailUniqueId}`;
    // Check sessionStorage first (for current session)
    if (sessionStorage.getItem(warningClosedKey) === 'true') {
        return true;
    }
    // Check chrome.storage.local (persists across page reloads)
    let result = false;
    chrome.storage.local.get([warningClosedKey], (data) => {
        if (data[warningClosedKey] === true) {
            result = true;
        }
    });
    return result;
}

function markWarningClosedForEmail(emailUniqueId) {
    const warningClosedKey = `warning_closed_${emailUniqueId}`;
    // Store in sessionStorage for current session
    sessionStorage.setItem(warningClosedKey, 'true');
    // Store in chrome.storage.local for persistence across reloads
    chrome.storage.local.set({ [warningClosedKey]: true });
}

function markEmailProcessed(emailUniqueId, scanType, result) {
    processedEmails.set(emailUniqueId, {
        scanType: scanType,
        timestamp: Date.now(),
        result: result
    });
    saveProcessedEmailsToStorage();
}

// ============================================
// SCAN CURRENTLY OPENED EMAIL
// ============================================
async function scanCurrentlyOpenedEmail(scanType = 'auto', forceManual = false) {
    if (scanInProgress) {
        console.log('PhishGuard: Scan already in progress');
        return;
    }
    
    console.log('PhishGuard: Scanning email (Type: ' + scanType + ')');
    
    const emailData = extractEmailContent();
    if (!emailData || !emailData.text || emailData.text.length < 50) {
        console.log('PhishGuard: No valid email content found');
        return;
    }
    
    const emailUniqueId = getEmailUniqueId(emailData);
    
    // For auto scans: check if already processed
    if (scanType === 'auto') {
        if (isEmailProcessed(emailUniqueId)) {
            console.log('PhishGuard: Email already processed, skipping auto-scan');
            return;
        }
    }
    
    scanInProgress = true;
    
    // Notify popup
    chrome.runtime.sendMessage({ action: "scanStarted", status: "scanning" }).catch(() => {});
    showScanningIndicator();
    
    try {
        const requestData = {
            text: emailData.text,
            subject: emailData.subject || "",
            sender: emailData.sender || ""
        };
        
        const response = await fetch("https://phishing-detection-apia.onrender.com/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        
        const data = await response.json();
        console.log('PhishGuard: API Response:', data);
        
        // Get confidence from API
        const confidence = data.confidence || data.score || 0;
        const isPhishing = data.label === 'Phishing' || data.prediction === 'Phishing' || confidence > 0.7;
        
        // Extract dynamic reasons and tips
        const { reasons, tips } = extractDynamicReasonsAndTips(emailData.text, confidence, isPhishing);
        
        const scanResult = {
            isPhishing: isPhishing,
            confidence: confidence,
            subject: emailData.subject,
            sender: emailData.sender,
            reasons: reasons,
            tips: tips,
            scanType: scanType,
            emailId: emailUniqueId
        };
        
        // Mark email as processed
        markEmailProcessed(emailUniqueId, scanType, scanResult);
        
        // Save to history with domain for dashboard
        saveToHistory(emailData.text, data, window.location.href, emailData.subject, emailData.sender, scanType, reasons, tips);
        
        // Send result to popup
        chrome.runtime.sendMessage({ action: "emailScanned", result: scanResult }).catch(() => {});
        
        // Show warning if phishing detected
        if (isPhishing) {
            console.log('PhishGuard: PHISHING DETECTED!');
            // Check if warning was already closed for this email
            const warningAlreadyClosed = await checkWarningClosedPersistent(emailUniqueId);
            if (!warningAlreadyClosed && (!warningActive || currentWarningEmailId !== emailUniqueId)) {
                showWarningBanner(scanResult, emailUniqueId);
            } else {
                console.log('PhishGuard: Warning already closed for this email, not showing again');
            }
            showTemporaryNotification('Phishing Alert!', `${Math.round(confidence * 100)}% confidence`, '#ff4444');
        } else {
            console.log('PhishGuard: Email appears safe');
            showSafeIndicator();
        }
        
        hideScanningIndicator();
        
    } catch (error) {
        console.error('PhishGuard: Scan error:', error);
        hideScanningIndicator();
    }
    
    scanInProgress = false;
}

// Helper function to check if warning was closed persistently
async function checkWarningClosedPersistent(emailUniqueId) {
    const warningClosedKey = `warning_closed_${emailUniqueId}`;
    
    // Check sessionStorage
    if (sessionStorage.getItem(warningClosedKey) === 'true') {
        return true;
    }
    
    // Check chrome.storage.local
    return new Promise((resolve) => {
        chrome.storage.local.get([warningClosedKey], (result) => {
            resolve(result[warningClosedKey] === true);
        });
    });
}

// ============================================
// SHOW WARNING BANNER (ONCE PER EMAIL - PERSISTENT)
// ============================================
function showWarningBanner(scanResult, emailUniqueId) {
    // Check if warning was already closed for this email
    const warningClosedKey = `warning_closed_${emailUniqueId}`;
    chrome.storage.local.get([warningClosedKey], (result) => {
        if (result[warningClosedKey] === true) {
            console.log('PhishGuard: Warning was previously closed for this email, not showing');
            return;
        }
        
        // Also check sessionStorage
        if (sessionStorage.getItem(warningClosedKey) === 'true') {
            console.log('PhishGuard: Warning was closed in this session, not showing');
            return;
        }
        
        // Remove existing warning
        const existingWarning = document.querySelector(".phishguard-warning-banner");
        if (existingWarning) existingWarning.remove();
        
        warningActive = true;
        currentWarningEmailId = emailUniqueId;
        
        const confidencePercent = Math.round(scanResult.confidence * 100);
        const reasons = scanResult.reasons || [];
        const tips = scanResult.tips || [];
        
        const banner = document.createElement("div");
        banner.className = "phishguard-warning-banner";
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #dc3545, #b02a37);
            color: white;
            padding: 16px 24px;
            z-index: 2147483647;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            border-bottom: 3px solid #ffc107;
        `;
        
        banner.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <strong style="font-size: 18px;">⚠️ PHISHING ALERT</strong>
                        <div style="font-size: 13px; margin-top: 4px;">Confidence: ${confidencePercent}% | Risk: ${confidencePercent > 70 ? 'High' : 'Medium'}</div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button id="phishguard-report-btn" style="
                            background: #ffc107;
                            color: #000;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                            font-size: 13px;
                        ">Report Phishing</button>
                        <button id="phishguard-close-btn" style="
                            background: rgba(255,255,255,0.2);
                            color: white;
                            border: 1px solid rgba(255,255,255,0.3);
                            padding: 8px 16px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                            font-size: 13px;
                        ">Close</button>
                    </div>
                </div>
                
                <details style="margin-top: 12px;">
                    <summary style="cursor: pointer; font-weight: 500;">Why is this suspicious?</summary>
                    <ul style="margin: 10px 0 0 20px; line-height: 1.5;">
                        ${reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                    </ul>
                </details>
                
                <details style="margin-top: 8px;">
                    <summary style="cursor: pointer; font-weight: 500;">Safety Tips</summary>
                    <ul style="margin: 10px 0 0 20px; line-height: 1.5;">
                        ${tips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                    </ul>
                </details>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // Close button handler - PERSISTENT
        const closeBtn = document.getElementById('phishguard-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                banner.remove();
                warningActive = false;
                currentWarningEmailId = null;
                // Mark as closed permanently
                markWarningClosedForEmail(emailUniqueId);
                console.log('PhishGuard: Warning closed and marked as dismissed for this email');
            });
        }
        
        // Report button handler
        const reportBtn = document.getElementById('phishguard-report-btn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                reportPhishingEmail();
                banner.remove();
                warningActive = false;
                currentWarningEmailId = null;
                // Also mark as closed when reported
                markWarningClosedForEmail(emailUniqueId);
                showTemporaryNotification('Reported', 'Thank you for reporting', '#4caf50');
            });
        }
    });
}

// ============================================
// SAVE TO HISTORY WITH DOMAIN TRACKING
// ============================================
function saveToHistory(email, data, url, subject, sender, scanType, reasons, tips) {
    const confidence = data.confidence || data.score || 0;
    const isPhishing = data.label === 'Phishing' || confidence > 0.7;
    
    // Extract domain for dashboard
    let domain = 'Unknown';
    if (url) {
        try {
            if (url.includes('mail.google.com')) domain = 'Gmail';
            else if (url.includes('outlook')) domain = 'Outlook';
            else if (url.includes('yahoo')) domain = 'Yahoo Mail';
            else {
                const urlObj = new URL(url);
                domain = urlObj.hostname;
            }
        } catch(e) { domain = 'Unknown'; }
    }
    
    chrome.storage.local.get(["history"], (result) => {
        let history = result.history || [];
        
        history.unshift({
            email: email.substring(0, 300),
            subject: subject || 'No Subject',
            sender: sender || 'Unknown',
            prediction: isPhishing ? 'Phishing' : 'Safe',
            confidence: confidence,
            risk: confidence > 0.7 ? 'High' : confidence > 0.4 ? 'Medium' : 'Low',
            url: url,
            domain: domain,
            reasons: reasons,
            tips: tips,
            scanType: scanType,
            time: new Date().toLocaleString()
        });
        
        if (history.length > 200) history = history.slice(0, 200);
        chrome.storage.local.set({ history });
    });
}

// ============================================
// HELPER FUNCTIONS
// ============================================
let indicatorTimeout = null;

function showScanningIndicator() {
    const existing = document.querySelector('.phishguard-scanner-indicator');
    if (existing) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'phishguard-scanner-indicator';
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    indicator.innerHTML = '🔍 PhishGuard: Scanning...';
    document.body.appendChild(indicator);
    
    if (indicatorTimeout) clearTimeout(indicatorTimeout);
    indicatorTimeout = setTimeout(() => {
        if (indicator && indicator.parentNode) indicator.remove();
    }, 5000);
}

function hideScanningIndicator() {
    const indicator = document.querySelector('.phishguard-scanner-indicator');
    if (indicator) indicator.remove();
    if (indicatorTimeout) clearTimeout(indicatorTimeout);
}

function showSafeIndicator() {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: fadeOut 2s ease forwards;
    `;
    indicator.innerHTML = '✅ PhishGuard: Email appears safe';
    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 2000);
}

function showTemporaryNotification(title, message, color) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        animation: fadeOut 3s ease forwards;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    notification.innerHTML = `<strong>${title}</strong><br>${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function reportPhishingEmail() {
    const emailContent = extractEmailContent();
    if (emailContent && emailContent.text) {
        chrome.runtime.sendMessage({
            action: "reportPhishing",
            email: emailContent.text.substring(0, 500),
            url: window.location.href,
            sender: emailContent.sender,
            subject: emailContent.subject
        });
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// SETUP AUTO-SCAN (NON-INTRUSIVE)
// ============================================
let lastUrl = window.location.href;
let isScanningSetup = false;

function setupAutoScan() {
    if (isScanningSetup) return;
    isScanningSetup = true;
    
    console.log('PhishGuard: Setting up auto-scan');
    
    const checkAndScan = () => {
        const isEmailView = window.location.hash.includes('/msg/') ||
                           document.querySelector('.a3s') ||
                           document.querySelector('[role="article"]');
        
        if (isEmailView) {
            setTimeout(() => scanCurrentlyOpenedEmail('auto', false), 1500);
        }
    };
    
    // Delay initial scan to let page load
    setTimeout(checkAndScan, 3000);
    
    // Monitor URL changes
    const urlObserver = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            console.log('PhishGuard: URL changed, checking for email');
            setTimeout(checkAndScan, 2000);
        }
    });
    urlObserver.observe(document, { subtree: true, childList: true });
    
    // Monitor for email content
    let lastEmailContent = '';
    const domObserver = new MutationObserver(() => {
        const emailBody = document.querySelector('.a3s, [role="article"]');
        if (emailBody && emailBody.innerText && emailBody.innerText.length > 100) {
            const currentContent = emailBody.innerText.substring(0, 200);
            if (currentContent !== lastEmailContent) {
                lastEmailContent = currentContent;
                const emailData = extractEmailContent();
                if (emailData) {
                    const emailUniqueId = getEmailUniqueId(emailData);
                    if (!isEmailProcessed(emailUniqueId)) {
                        console.log('PhishGuard: New email content detected');
                        setTimeout(() => scanCurrentlyOpenedEmail('auto', false), 1000);
                    }
                }
            }
        }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
}

// ============================================
// CLEANUP OLD RECORDS
// ============================================
function cleanupOldRecords() {
    const now = Date.now();
    let changed = false;
    for (const [key, info] of processedEmails.entries()) {
        if (now - info.timestamp > 86400000) { // 24 hours
            processedEmails.delete(key);
            changed = true;
        }
    }
    if (changed) {
        saveProcessedEmailsToStorage();
    }
    setTimeout(cleanupOldRecords, 3600000);
}

// ============================================
// CLEANUP OLD WARNING CLOSED FLAGS
// ============================================
function cleanupOldWarningFlags() {
    chrome.storage.local.get(null, (items) => {
        const now = Date.now();
        for (const [key, value] of Object.entries(items)) {
            if (key.startsWith('warning_closed_')) {
                // Extract timestamp from key if possible, or clean up after 7 days
                // For simplicity, we'll clean up after a week
                // This is a background cleanup
            }
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================
function initialize() {
    console.log('========================================');
    console.log('PhishGuard AI: ACTIVE AND RUNNING');
    console.log('Auto-scan mode: ENABLED');
    console.log('Emails will be auto-scanned only ONCE per email');
    console.log('Warning banner will appear only ONCE per email (persistent across reloads)');
    console.log('Dynamic reasons extracted from email content');
    console.log('========================================');
    
    // Load previously processed emails from storage
    loadProcessedEmailsFromStorage();
    
    // Setup auto-scan
    setupAutoScan();
    
    // Cleanup old records periodically
    cleanupOldRecords();
    cleanupOldWarningFlags();
    
    // Add animation styles
    if (!document.querySelector('#phishguard-styles')) {
        const style = document.createElement('style');
        style.id = 'phishguard-styles';
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; }
                70% { opacity: 1; }
                100% { opacity: 0; visibility: hidden; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Notify background script
    chrome.runtime.sendMessage({ action: "contentScriptReady" }).catch(() => {});
}

// Start everything
initialize();