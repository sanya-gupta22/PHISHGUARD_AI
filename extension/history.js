let currentHistory = [];
let currentFilter = "all";

function loadHistory() {
    chrome.storage.local.get(["history"], (result) => {
        currentHistory = result.history || [];
        displayHistory(currentHistory, currentFilter);
    });
}

function displayHistory(history, filter) {
    const tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML = "";
    
    let filteredHistory = history;
    if (filter === "Phishing") {
        filteredHistory = history.filter(item => item.prediction === "Phishing");
    } else if (filter === "Safe") {
        filteredHistory = history.filter(item => item.prediction === "Safe");
    } else if (filter === "High") {
        filteredHistory = history.filter(item => item.risk === "High");
    }
    
    if (filteredHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No history found</td></tr>';
        return;
    }
    
    filteredHistory.forEach((item, index) => {
        const row = tbody.insertRow();
        const confidencePercent = Math.round(item.confidence * 100);
        
        row.innerHTML = `
            <td title="${item.email}">${item.email.substring(0, 50)}...</td>
            <td class="${item.prediction.toLowerCase()}">${item.prediction === 'Phishing' ? ' Phishing' : ' Safe'}</td>
            <td>${confidencePercent}%</td>
            <td style="color: ${item.risk === 'High' ? '#ff1744' : item.risk === 'Medium' ? '#ff9100' : '#00e676'}">${item.risk || 'Low'}</td>
            <td>${item.time}</td>
            <td><button class="delete-btn" data-index="${index}">Delete</button></td>
        `;
    });
    
    // Add delete functionality
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            deleteHistoryItem(index);
        });
    });
}

function deleteHistoryItem(index) {
    const updatedHistory = [...currentHistory];
    updatedHistory.splice(index, 1);
    chrome.storage.local.set({ history: updatedHistory }, () => {
        loadHistory();
    });
}

function exportToCSV() {
    if (currentHistory.length === 0) {
        alert("No history to export");
        return;
    }
    
    const headers = ["Email Preview", "Prediction", "Confidence", "Risk Level", "Time"];
    const csvRows = [headers];
    
    currentHistory.forEach(item => {
        csvRows.push([
            `"${item.email.replace(/"/g, '""')}"`,
            item.prediction,
            Math.round(item.confidence * 100) + "%",
            item.risk || "Low",
            item.time
        ]);
    });
    
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phishguard_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Event listeners
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        displayHistory(currentHistory, currentFilter);
    });
});

document.getElementById('exportBtn')?.addEventListener('click', exportToCSV);
document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
    if (confirm(' Are you sure you want to clear all history? This action cannot be undone.')) {
        chrome.storage.local.set({ history: [] }, () => {
            loadHistory();
        });
    }
});

// Load history on page load
loadHistory();