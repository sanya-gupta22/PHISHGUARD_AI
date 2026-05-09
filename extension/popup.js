const API_URL = "https://phishing-detection-apia.onrender.com/predict";

// Get current tab
let currentTabId = null;

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup loaded');
    
    // Get current active tab
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTabId = tab.id;
        console.log('Current tab ID:', currentTabId);
    } catch (error) {
        console.error('Error getting tab:', error);
    }
    
    // Add scan button event listener
    const scanBtn = document.getElementById('scanBtn');
    if (scanBtn) {
        scanBtn.addEventListener('click', scanEmail);
    }
    
    // Load dark mode preference
    chrome.storage.local.get(["darkMode"], (result) => {
        const darkToggle = document.getElementById("darkToggle");
        if (darkToggle && result.darkMode) {
            darkToggle.checked = true;
            document.body.classList.add("dark-mode");
        }
    });
});

async function scanEmail() {
    console.log('Scan button clicked');
    
    if (!currentTabId) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTabId = tab.id;
        } catch (error) {
            console.error('Error getting current tab:', error);
            alert('Could not get current tab. Please refresh and try again.');
            return;
        }
    }
    
    // Show loading state
    showLoading();
    
    try {
        // First, ensure content script is injected
        await ensureContentScriptInjected();
        
        // Send message to content script
        chrome.tabs.sendMessage(currentTabId, { action: "extractEmail" }, async (response) => {
            console.log('Response from content script:', response);
            
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
                hideLoading();
                alert('Error: Could not connect to the page. Please refresh the page and try again.\n\nMake sure you are on an email page (Gmail, Outlook, etc.)');
                return;
            }
            
            if (!response || !response.text) {
                hideLoading();
                alert('No email detected on this page.\n\nPlease open an email and try again.');
                return;
            }
            
            if (response.text.length < 50) {
                hideLoading();
                alert('Email content is too short. Please open a complete email and try again.');
                return;
            }
            
            console.log('Email extracted, length:', response.text.length);
            
            // Send to API
            try {
                const res = await fetch(API_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ text: response.text })
                });
                
                if (!res.ok) {
                    throw new Error(`API returned ${res.status}: ${res.statusText}`);
                }
                
                const data = await res.json();
                console.log('API Response:', data);
                
                // Check if data has expected structure
                if (!data) {
                    throw new Error('Empty response from API');
                }
                
                updateUI(data);
                saveHistory(response.text, data, response.url);
                hideLoading();
                
            } catch (error) {
                console.error('API Error:', error);
                hideLoading();
                alert(`Error analyzing email: ${error.message}\n\nPlease check if the API is running.`);
            }
        });
    } catch (error) {
        console.error('Error in scanEmail:', error);
        hideLoading();
        alert(`Error: ${error.message}`);
    }
}

async function ensureContentScriptInjected() {
    try {
        // Try to ping the content script
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
        console.log('Content script not injected, injecting now...');
        // Inject content script
        await chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            files: ['content.js']
        });
        await chrome.scripting.insertCSS({
            target: { tabId: currentTabId },
            files: ['popup.css']
        });
        // Wait a bit for injection to complete
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

function updateUI(data) {
    console.log('Updating UI with data:', data);
    
    const statusElement = document.getElementById("status");
    const confidenceElement = document.getElementById("confidence");
    const meterFill = document.getElementById("meter-fill");
    const riskLevel = document.getElementById("risk-level");
    const reasonsElement = document.getElementById("reasons");
    const tipsElement = document.getElementById("tips");
    
    // Handle different API response formats
    let label = data.label || data.prediction || (data.phishing ? 'Phishing' : 'Safe');
    let confidence = data.confidence || data.score || 0;
    let risk = data.risk || data.risk_level || (confidence > 0.7 ? 'High' : confidence > 0.4 ? 'Medium' : 'Low');
    let reasons = data.reasons || data.indicators || [];
    let tips = data.tips || data.recommendations || getDefaultTips(risk);
    
    // If reasons is empty, add default reasons based on analysis
    if (reasons.length === 0 && label === 'Phishing') {
        reasons = generateReasonsFromText();
    }
    
    // Update status
    const isPhishing = label === 'Phishing' || label === 'phishing' || label === true;
    statusElement.innerText = `Status: ${isPhishing ? ' SUSPICIOUS' : ' SAFE'}`;
    statusElement.style.animation = 'none';
    statusElement.offsetHeight;
    statusElement.style.animation = 'pulse 0.5s ease';
    
    // Update confidence
    const confidencePercent = Math.round(confidence * 100);
    confidenceElement.innerText = `${confidencePercent}%`;
    
    // Animate meter fill
    meterFill.style.width = '0%';
    setTimeout(() => {
        meterFill.style.width = `${confidencePercent}%`;
    }, 100);
    
    // Update risk level with color coding
    riskLevel.innerText = `Risk Level: ${risk}`;
    let riskColor = '#00ff88';
    let riskBg = 'rgba(0, 255, 136, 0.1)';
    if (risk === 'High' || risk === 'high' || confidence > 0.7) {
        riskColor = '#ff4444';
        riskBg = 'rgba(255, 68, 68, 0.1)';
    } else if (risk === 'Medium' || risk === 'medium' || confidence > 0.4) {
        riskColor = '#ffaa00';
        riskBg = 'rgba(255, 170, 0, 0.1)';
    }
    riskLevel.style.borderLeft = `4px solid ${riskColor}`;
    riskLevel.style.background = riskBg;
    
    // Update reasons
    if (reasons && reasons.length > 0) {
        reasonsElement.innerHTML = `<h4> Analysis Results</h4>` +
            reasons.map(r => `<p> ${r}</p>`).join('');
    } else if (isPhishing) {
        reasonsElement.innerHTML = `<h4> Analysis Results</h4>
            <p> Suspicious patterns detected</p>
            <p> Email contains potential phishing indicators</p>
            <p> Recommendation: Do not click any links or download attachments</p>`;
    } else {
        reasonsElement.innerHTML = `<h4> Analysis Results</h4>
            <p> No phishing indicators detected</p>
            <p> Email appears legitimate</p>`;
    }
    
    // Update tips
    if (tips && tips.length > 0) {
        tipsElement.innerHTML = `<h4> Safety Tips</h4>` +
            tips.map(t => `<p> ${t}</p>`).join('');
    } else {
        tipsElement.innerHTML = `<h4> Safety Tips</h4>
            <p> Always verify sender email addresses</p>
            <p> Don't click suspicious links</p>
            <p> Never share passwords or sensitive information</p>
            <p> Enable two-factor authentication</p>`;
    }
}

function generateReasonsFromText() {
    // Default reasons when API doesn't provide specific ones
    return [
        'Email contains suspicious elements',
        'Potential phishing indicators detected',
        'Exercise caution with this email'
    ];
}

function getDefaultTips(riskLevel) {
    const tips = [
        'Always verify the sender\'s email address',
        'Hover over links to see actual URL before clicking',
        'Never share passwords or personal information via email'
    ];
    
    if (riskLevel === 'High' || riskLevel === 'high') {
        tips.unshift(' URGENT: Do not interact with this email!');
        tips.push('Report this email as phishing immediately');
        tips.push('Do not reply or click any links');
    }
    
    return tips;
}

function showLoading() {
    const statusElement = document.getElementById("status");
    const reasonsElement = document.getElementById("reasons");
    const tipsElement = document.getElementById("tips");
    
    if (statusElement) {
        statusElement.innerText = " Scanning Email...";
        statusElement.classList.add('loading');
    }
    
    if (reasonsElement) {
        reasonsElement.innerHTML = `<h4> Analysis Results</h4>
            <p> Analyzing email content...</p>`;
    }
    
    if (tipsElement) {
        tipsElement.innerHTML = `<h4> Safety Tips</h4>
            <p> Please wait while we analyze...</p>`;
    }
    
    const confidenceElement = document.getElementById("confidence");
    if (confidenceElement) {
        confidenceElement.innerText = "Analyzing...";
    }
}

function hideLoading() {
    const statusElement = document.getElementById("status");
    if (statusElement) {
        statusElement.classList.remove('loading');
    }
}

function saveHistory(email, data, url) {
    const label = data.label || data.prediction || (data.phishing ? 'Phishing' : 'Safe');
    const confidence = data.confidence || data.score || 0;
    const risk = data.risk || data.risk_level || (confidence > 0.7 ? 'High' : confidence > 0.4 ? 'Medium' : 'Low');
    
    chrome.storage.local.get(["history"], (result) => {
        let history = result.history || [];
        
        history.unshift({
            email: email.substring(0, 100),
            prediction: label,
            confidence: confidence,
            risk: risk,
            url: url || '',
            reasons: data.reasons || [],
            time: new Date().toLocaleString()
        });
        
        // Keep only last 100 history items
        if (history.length > 100) history = history.slice(0, 100);
        
        chrome.storage.local.set({ history }, () => {
            console.log('History saved');
        });
    });
}

// Event listeners for buttons
const historyBtn = document.getElementById("historyBtn");
const dashboardBtn = document.getElementById("dashboardBtn");
const darkToggle = document.getElementById("darkToggle");

if (historyBtn) {
    historyBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: "history.html" });
    });
}

if (dashboardBtn) {
    dashboardBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: "dashboard.html" });
    });
}

if (darkToggle) {
    darkToggle.addEventListener("change", (e) => {
        document.body.classList.toggle("dark-mode", e.target.checked);
        chrome.storage.local.set({ darkMode: e.target.checked });
    });
    
    // Load dark mode preference
    chrome.storage.local.get(["darkMode"], (result) => {
        if (result.darkMode) {
            darkToggle.checked = true;
            document.body.classList.add("dark-mode");
        }
    });
}