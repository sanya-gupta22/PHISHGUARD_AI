// Load settings
chrome.storage.local.get(["autoScan", "detectionSensitivity", "darkMode", "showNotifications"], (result) => {
    document.getElementById('autoScanToggle').checked = result.autoScan !== false;
    document.getElementById('sensitivity').value = result.detectionSensitivity || "medium";
    document.getElementById('themeToggle').checked = result.darkMode || false;
    document.getElementById('showNotifications').checked = result.showNotifications !== false;
});

// Save settings
document.getElementById('saveSettings')?.addEventListener('click', () => {
    const settings = {
        autoScan: document.getElementById('autoScanToggle').checked,
        detectionSensitivity: document.getElementById('sensitivity').value,
        darkMode: document.getElementById('themeToggle').checked,
        showNotifications: document.getElementById('showNotifications').checked
    };
    
    chrome.storage.local.set(settings, () => {
        alert('Settings saved!');
        if (settings.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    });
});

// Reset settings
document.getElementById('resetSettings')?.addEventListener('click', () => {
    chrome.storage.local.set({
        autoScan: true,
        detectionSensitivity: "medium",
        darkMode: false,
        showNotifications: true
    }, () => {
        alert('Settings reset to default!');
        location.reload();
    });
});