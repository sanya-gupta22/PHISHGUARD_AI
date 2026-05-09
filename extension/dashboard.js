// Load and display dashboard data
chrome.storage.local.get(["history"], (result) => {
    const history = result.history || [];
    
    // Calculate statistics
    const phishing = history.filter(h => h.prediction === "Phishing").length;
    const safe = history.filter(h => h.prediction === "Safe").length;
    const total = history.length;
    
    // Risk levels
    const highRisk = history.filter(h => h.risk === "High").length;
    const mediumRisk = history.filter(h => h.risk === "Medium").length;
    const lowRisk = history.filter(h => h.risk === "Low" || h.risk === "Safe").length;
    
    // Calculate accuracy (based on confidence)
    const avgConfidence = history.reduce((sum, h) => sum + h.confidence, 0) / (total || 1);
    const accuracy = Math.round((1 - (phishing / (total || 1))) * 100);
    
    // Update stats
    document.getElementById("totalScanned").innerText = total;
    document.getElementById("safeEmails").innerText = safe;
    document.getElementById("phishingEmails").innerText = phishing;
    document.getElementById("accuracyRate").innerText = `${accuracy}%`;
    
    // Pie Chart
    const pieCtx = document.getElementById("pieChart").getContext("2d");
    new Chart(pieCtx, {
        type: "pie",
        data: {
            labels: ["Safe Emails", "Phishing Emails"],
            datasets: [{
                data: [safe, phishing],
                backgroundColor: ["#00e676", "#ff1744"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: "#e0e0e0" } }
            }
        }
    });
    
    // Risk Levels Chart
    const riskCtx = document.getElementById("riskChart").getContext("2d");
    new Chart(riskCtx, {
        type: "doughnut",
        data: {
            labels: ["High Risk", "Medium Risk", "Low Risk"],
            datasets: [{
                data: [highRisk, mediumRisk, lowRisk],
                backgroundColor: ["#ff1744", "#ff9100", "#00e676"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: "#e0e0e0" } }
            }
        }
    });
    
    // Trend Chart (Last 7 days)
    const last7Days = getLast7Days();
    const dailyData = getDailyData(history, last7Days);
    
    const trendCtx = document.getElementById("trendChart").getContext("2d");
    new Chart(trendCtx, {
        type: "line",
        data: {
            labels: last7Days,
            datasets: [
                {
                    label: "Phishing Detected",
                    data: dailyData.phishing,
                    borderColor: "#ff1744",
                    backgroundColor: "rgba(255, 23, 68, 0.1)",
                    tension: 0.4,
                    fill: true
                },
                {
                    label: "Safe Emails",
                    data: dailyData.safe,
                    borderColor: "#00e676",
                    backgroundColor: "rgba(0, 230, 118, 0.1)",
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, ticks: { color: "#e0e0e0" }, grid: { color: "rgba(255,255,255,0.1)" } },
                x: { ticks: { color: "#e0e0e0" }, grid: { color: "rgba(255,255,255,0.1)" } }
            },
            plugins: { legend: { labels: { color: "#e0e0e0" } } }
        }
    });
    
    // Extract keywords from reasons
    const keywords = extractKeywords(history);
    displayKeywords(keywords);
    
    // Extract domains
    const domains = extractDomains(history);
    displayDomains(domains);
});

function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toLocaleDateString());
    }
    return days;
}

function getDailyData(history, days) {
    const phishing = new Array(7).fill(0);
    const safe = new Array(7).fill(0);
    
    history.forEach(item => {
        const itemDate = new Date(item.time).toLocaleDateString();
        const dayIndex = days.indexOf(itemDate);
        if (dayIndex !== -1) {
            if (item.prediction === "Phishing") {
                phishing[dayIndex]++;
            } else {
                safe[dayIndex]++;
            }
        }
    });
    
    return { phishing, safe };
}

function extractKeywords(history) {
    const keywordMap = new Map();
    const commonKeywords = [
        "urgent", "verify", "account", "password", "click", "link", 
        "suspended", "security", "update", "bank", "payment", "verify",
        "confirm", "login", "credential", "alert", "immediate", "action"
    ];
    
    history.forEach(item => {
        if (item.prediction === "Phishing" && item.reasons) {
            item.reasons.forEach(reason => {
                const lowerReason = reason.toLowerCase();
                commonKeywords.forEach(keyword => {
                    if (lowerReason.includes(keyword)) {
                        keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
                    }
                });
            });
        }
    });
    
    return Array.from(keywordMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
}

function displayKeywords(keywords) {
    const container = document.getElementById("keywordList");
    if (keywords.length === 0) {
        container.innerHTML = '<p style="color: #999;">No phishing keywords detected yet</p>';
        return;
    }
    
    container.innerHTML = keywords.map(([keyword, count]) => `
        <div class="keyword-item">
            <span> ${keyword}</span>
            <span style="color: #667eea; font-weight: bold;">${count} times</span>
        </div>
    `).join('');
}

function extractDomains(history) {
    const domainMap = new Map();
    
    history.forEach(item => {
        if (item.url) {
            try {
                const url = new URL(item.url);
                const domain = url.hostname;
                domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
            } catch(e) {}
        }
    });
    
    return Array.from(domainMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
}

function displayDomains(domains) {
    const container = document.getElementById("domainList");
    if (domains.length === 0) {
        container.innerHTML = '<p style="color: #999;">No domains tracked yet</p>';
        return;
    }
    
    container.innerHTML = domains.map(([domain, count]) => `
        <div class="keyword-item">
            <span> ${domain}</span>
            <span style="color: #667eea; font-weight: bold;">${count} emails</span>
        </div>
    `).join('');
}