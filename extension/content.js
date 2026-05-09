// content.js - Complete PhishGuard AI Content Script

let autoScanInterval = null;
let isGmail = false;
let processedEmails = new Set();

// Check if we're on Gmail
if (window.location.hostname.includes('mail.google.com')) {
    isGmail = true;
    console.log('PhishGuard: Gmail detected');
}

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
        // Extract email from page
        let emailBody = extractEmailContent();
        sendResponse({
            text: emailBody ? emailBody.text : "",
            url: window.location.href,
            sender: emailBody ? emailBody.sender : ""
        });
        return true;
    }
    
    if (request.action === "reportPhishing") {
        // Report phishing email
        reportPhishingEmail();
        sendResponse({ success: true });
        return true;
    }
    
    if (request.action === "highlightEmails") {
        // Highlight suspicious emails
        highlightAllEmails();
        sendResponse({ success: true });
        return true;
    }
});

// ============================================
// EXTRACT EMAIL CONTENT
// ============================================
function extractEmailContent() {
    let emailElement = null;
    let sender = "";
    
    // Try different selectors for different email providers
    // Gmail
    if (window.location.hostname.includes('mail.google.com')) {
        emailElement = document.querySelector(".a3s, .gs, .ii.gt");
        // Extract sender from Gmail
        const senderElement = document.querySelector(".gD");
        if (senderElement) sender = senderElement.getAttribute('email') || senderElement.innerText;
    }
    // Outlook
    else if (window.location.hostname.includes('outlook')) {
        emailElement = document.querySelector("[role='article'], .message-content");
        const senderElement = document.querySelector(".ms-Persona-primaryDetail");
        if (senderElement) sender = senderElement.innerText;
    }
    // Yahoo Mail
    else if (window.location.hostname.includes('mail.yahoo')) {
        emailElement = document.querySelector(".message-body");
        const senderElement = document.querySelector(".from .value");
        if (senderElement) sender = senderElement.innerText;
    }
    // Generic fallback
    else {
        emailElement = document.querySelector('[class*="email"], [class*="message"], [role="article"]');
    }
    
    if (!emailElement) {
        console.log('PhishGuard: No email content found on this page');
        return null;
    }
    
    const emailText = emailElement.innerText;
    console.log('PhishGuard: Email extracted, length:', emailText.length);
    
    return {
        text: emailText,
        sender: sender,
        element: emailElement
    };
}

// ============================================
// SCAN EMAIL FUNCTION
// ============================================
async function scanEmail(emailText, emailElement = null) {
    // Check if already scanned to avoid duplicate scans
    const emailHash = btoa(emailText.substring(0, 100));
    if (processedEmails.has(emailHash)) {
        console.log('PhishGuard: Email already scanned, skipping');
        return;
    }
    
    console.log('PhishGuard: Scanning email, length:', emailText.length);
    
    try {
        const response = await fetch("https://phishing-detection-apia.onrender.com/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: emailText })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        console.log('PhishGuard: Scan result:', data);
        
        // Mark as processed
        processedEmails.add(emailHash);
        
        // Save to history
        saveToHistory(emailText, data, window.location.href);
        
        // If phishing detected, show warning
        const isPhishing = data.label === 'Phishing' || data.prediction === 'Phishing' || data.phishing === true;
        
        if (isPhishing) {
            showWarningBanner(data, emailElement);
            if (emailElement) {
                highlightSuspiciousEmail(emailElement, data);
            }
        }
        
        return data;
        
    } catch (error) {
        console.error('PhishGuard: Scan error:', error);
        return null;
    }
}

// ============================================
// HIGHLIGHT SUSPICIOUS EMAIL
// ============================================
function highlightSuspiciousEmail(emailElement, data) {
    if (!emailElement) return;
    
    // Find the email row/card container
    let container = emailElement;
    if (window.location.hostname.includes('mail.google.com')) {
        container = emailElement.closest('.zA, .adn');
    } else if (window.location.hostname.includes('outlook')) {
        container = emailElement.closest('.ms-message-list-item');
    }
    
    if (!container) container = emailElement;
    
    // Apply highlighting
    container.style.border = '2px solid #ff4444';
    container.style.borderRadius = '8px';
    container.style.backgroundColor = 'rgba(255, 68, 68, 0.1)';
    container.style.transition = 'all 0.3s ease';
    container.style.position = 'relative';
    
    // Add warning badge if not exists
    let badge = container.querySelector('.phishguard-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'phishguard-badge';
        const confidencePercent = Math.round((data.confidence || data.score || 0) * 100);
        badge.innerHTML = `
            <div style="
                position: absolute;
                top: 5px;
                right: 5px;
                background: linear-gradient(135deg, #ff4444, #cc0000);
                color: white;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: bold;
                z-index: 9999;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">
                 ${confidencePercent}% Phishing Risk
            </div>
        `;
        container.style.position = 'relative';
        container.appendChild(badge);
    }
}

// ============================================
// HIGHLIGHT ALL EMAILS IN INBOX
// ============================================
function highlightAllEmails() {
    console.log('PhishGuard: Highlighting all emails in inbox');
    
    let emailRows = [];
    
    if (window.location.hostname.includes('mail.google.com')) {
        emailRows = document.querySelectorAll('.zA');
    } else if (window.location.hostname.includes('outlook')) {
        emailRows = document.querySelectorAll('.ms-message-list-item');
    } else {
        emailRows = document.querySelectorAll('[class*="email-row"], [class*="message-item"]');
    }
    
    emailRows.forEach(row => {
        const emailPreview = row.innerText;
        if (emailPreview && emailPreview.length > 50) {
            scanEmail(emailPreview, row);
        }
    });
}

// ============================================
// SHOW WARNING BANNER
// ============================================
function showWarningBanner(data, emailElement = null) {
    // Remove existing warning if any
    const existingWarning = document.querySelector(".phishing-warning");
    if (existingWarning) {
        existingWarning.remove();
    }
    
    const confidence = Math.round((data.confidence || data.score || 0) * 100);
    const risk = data.risk || data.risk_level || (confidence > 70 ? 'High' : confidence > 40 ? 'Medium' : 'Low');
    const reasons = data.reasons || data.indicators || [
        'Suspicious sender address detected',
        'Urgent action required language',
        'Suspicious links or attachments'
    ];
    
    const warning = document.createElement("div");
    warning.className = "phishing-warning";
    warning.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #ff4444, #cc0000);
        color: white;
        padding: 15px 20px;
        z-index: 1000000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideDown 0.5s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    warning.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; position: relative;">
            <strong style="font-size: 16px;"> PHISHING ALERT DETECTED! </strong><br>
            <span style="font-size: 14px;">This email appears to be a phishing attempt.</span><br>
            <span style="font-size: 13px; opacity: 0.9;">Confidence: ${confidence}% | Risk Level: ${risk}</span>
            
            <details style="margin-top: 10px;">
                <summary style="cursor: pointer; font-weight: bold;">🔍 Why is this suspicious?</summary>
                <ul style="margin: 10px 0 0 20px;">
                    ${reasons.slice(0, 5).map(r => `<li>${r}</li>`).join('')}
                </ul>
            </details>
            
            <div style="margin-top: 10px;">
                <strong>✅ What you should do:</strong>
                <ul style="margin: 5px 0 0 20px;">
                    <li>Do NOT click any links in this email</li>
                    <li>Do NOT reply or forward this email</li>
                    <li>Report this email as phishing</li>
                    <li>Delete the email immediately</li>
                </ul>
            </div>
            
            <div style="margin-top: 12px; display: flex; gap: 10px;">
                <button id="closeWarningBtn" style="
                    background: white;
                    color: #cc0000;
                    border: none;
                    padding: 6px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">Close</button>
                <button id="reportPhishingBtn" style="
                    background: #ffcc00;
                    color: #cc0000;
                    border: none;
                    padding: 6px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">Report Phishing</button>
            </div>
        </div>
    `;
    
    document.body.prepend(warning);
    
    // Add animation style if not exists
    if (!document.querySelector('#phishguard-animation')) {
        const style = document.createElement('style');
        style.id = 'phishguard-animation';
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Close button handler
    document.getElementById('closeWarningBtn')?.addEventListener('click', () => {
        warning.remove();
    });
    
    // Report button handler
    document.getElementById('reportPhishingBtn')?.addEventListener('click', () => {
        reportPhishingEmail();
        warning.remove();
    });
}

// ============================================
// REPORT PHISHING EMAIL
// ============================================
function reportPhishingEmail() {
    const emailContent = extractEmailContent();
    
    if (emailContent && emailContent.text) {
        chrome.runtime.sendMessage({
            action: "reportPhishing",
            email: emailContent.text.substring(0, 500),
            url: window.location.href,
            sender: emailContent.sender
        });
        
        // Show confirmation notification
        showNotification('Thank you for reporting!', 'You\'re helping protect others from phishing.');
    } else {
        alert('No email found to report. Please open the email you want to report.');
    }
}

// ============================================
// SHOW NOTIFICATION
// ============================================
function showNotification(title, message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 1000000;
        animation: slideUp 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    notification.innerHTML = `<strong>${title}</strong><br>${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// AUTO-SCAN SETUP
// ============================================
function setupAutoScan() {
    chrome.storage.local.get(["autoScan"], (result) => {
        if (result.autoScan !== false) {
            console.log('PhishGuard: Auto-scan enabled');
            
            // Clear existing interval
            if (autoScanInterval) {
                clearInterval(autoScanInterval);
            }
            
            // Set new interval
            autoScanInterval = setInterval(() => {
                // For Gmail
                if (window.location.hostname.includes('mail.google.com')) {
                    const emailBodies = document.querySelectorAll(".a3s, .gs, .ii.gt");
                    emailBodies.forEach(emailBody => {
                        if (emailBody && emailBody.innerText && emailBody.innerText.length > 100) {
                            const emailElement = emailBody.closest('.adn, .zA');
                            scanEmail(emailBody.innerText, emailElement);
                        }
                    });
                }
                
                // For other email clients
                const genericEmails = document.querySelectorAll('[class*="email"], [class*="message"]');
                genericEmails.forEach(email => {
                    if (email.innerText && email.innerText.length > 100) {
                        scanEmail(email.innerText, email);
                    }
                });
            }, 10000); // Scan every 10 seconds
        } else {
            console.log('PhishGuard: Auto-scan disabled');
        }
    });
}

// ============================================
// SAVE TO HISTORY
// ============================================
function saveToHistory(email, data, url) {
    const label = data.label || data.prediction || (data.phishing ? 'Phishing' : 'Safe');
    const confidence = data.confidence || data.score || 0;
    const risk = data.risk || data.risk_level || (confidence > 0.7 ? 'High' : confidence > 0.4 ? 'Medium' : 'Low');
    const reasons = data.reasons || data.indicators || [];
    
    chrome.storage.local.get(["history"], (result) => {
        let history = result.history || [];
        
        history.unshift({
            email: email.substring(0, 100),
            prediction: label,
            confidence: confidence,
            risk: risk,
            url: url,
            reasons: reasons,
            time: new Date().toLocaleString()
        });
        
        // Keep only last 200 history items
        if (history.length > 200) history = history.slice(0, 200);
        
        chrome.storage.local.set({ history });
    });
}

// ============================================
// SCAN SELECTED TEXT
// ============================================
document.addEventListener('mouseup', async () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText && selectedText.length > 50) {
        chrome.storage.local.get(["autoScanSelected"], (result) => {
            if (result.autoScanSelected) {
                console.log('PhishGuard: Scanning selected text');
                scanEmail(selectedText);
            }
        });
    }
});

// ============================================
// INITIALIZATION
// ============================================
function initialize() {
    console.log('PhishGuard AI: Content script initialized');
    setupAutoScan();
    
    // Notify background script that content script is ready
    chrome.runtime.sendMessage({ action: "contentScriptReady" });
}

// Start the extension
initialize();

// Re-initialize on page navigation (for single-page apps like Gmail)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('PhishGuard: Page navigation detected');
        setTimeout(initialize, 1000);
    }
}).observe(document, { subtree: true, childList: true });

console.log('PhishGuard AI: Content script loaded successfully');