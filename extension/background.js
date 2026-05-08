chrome.runtime.onInstalled.addListener(() => {

    chrome.contextMenus.create({
        id: "scanSelectedText",
        title: "Scan for Phishing",
        contexts: ["selection"]
    });
});

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
            title: "PhishGuard AI",
            message: `${data.label} (${Math.round(data.confidence * 100)}%)`
        });
    }
});