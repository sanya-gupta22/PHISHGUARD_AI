// Context menu for selected text
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "scanSelectedText",
        title: " Scan for Phishing",
        contexts: ["selection"]
    });
    
    // Initialize storage
    chrome.storage.local.set({ 
        autoScan: true,
        detectionSensitivity: "medium"
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "scanSelectedText") {
        const response = await fetch("https://phishing-detection-apia.onrender.com/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: info.selectionText })
        });

        const data = await response.json();

        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: " PhishGuard AI",
            message: `${data.label === 'Phishing' ? 'Phishing' : 'Safe'} ${data.label} (${Math.round(data.confidence * 100)}% confidence)`,
            priority: 1
        });
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "reportPhishing") {
        // Save reported phishing email
        chrome.storage.local.get(["reportedPhishing"], (result) => {
            let reports = result.reportedPhishing || [];
            reports.push({
                email: request.email.substring(0, 200),
                url: request.url,
                time: new Date().toLocaleString(),
                reportedBy: "user"
            });
            chrome.storage.local.set({ reportedPhishing: reports });
            
            // Show confirmation
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icons/icon48.png",
                title: "Thank You!",
                message: "Phishing email reported. You're helping keep others safe!",
                priority: 1
            });
        });
        sendResponse({ success: true });
    }
    return true;
});