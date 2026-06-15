// dashboard.js — PhishGuard AI Dashboard
// Loads data from Chrome local storage (same as history page) with demo fallback
// Sidebar opens on hover (desktop) or click (mobile)

// ============================================================
// GLOBAL STATE
// ============================================================
let currentHistory = [];
let pieChart, riskChart, trendChart;

// Fallback demo data (same structure as saved scans)
const demoHistory = [
    { id: "demo1", prediction: "Phishing", confidence: 0.94, risk: "High", 
      time: new Date(Date.now() - 86400000).toLocaleString(), 
      email: "URGENT: Your PayPal account will be suspended immediately! Please verify your account by clicking the link below.", 
      senderDomain: "paypalsecurity.com", url: "https://paypalsecurity.com/verify",
      reasons: ["Urgent action required", "Suspicious links"] },
    { id: "demo2", prediction: "Safe", confidence: 0.98, risk: "Low", 
      time: new Date(Date.now() - 3600000).toLocaleString(), 
      email: "Meeting notes for Q4 planning - Please find attached the agenda for tomorrow's meeting.", 
      senderDomain: "company.com", url: "https://company.com/meeting" },
    { id: "demo3", prediction: "Phishing", confidence: 0.87, risk: "High", 
      time: new Date(Date.now() - 172800000).toLocaleString(), 
      email: "Your Amazon order #ORD-3847 needs verification. Click here to confirm your payment details.", 
      senderDomain: "amaz0nverify.net", url: "http://amaz0nverify.net/confirm",
      reasons: ["Password verification", "Suspicious link"] },
    { id: "demo4", prediction: "Safe", confidence: 0.95, risk: "Low", 
      time: new Date(Date.now() - 259200000).toLocaleString(), 
      email: "Weekly newsletter: New security features available for your account.", 
      senderDomain: "newsletter.com", url: "https://newsletter.com/weekly" },
    { id: "demo5", prediction: "Phishing", confidence: 0.76, risk: "Medium", 
      time: new Date(Date.now() - 43200000).toLocaleString(), 
      email: "Security Alert: Unusual login detected. Please verify your bank account information immediately.", 
      senderDomain: "secure-bank-alerts.com", url: "http://secure-bank-alerts.com/verify",
      reasons: ["Financial references", "Threatening language"] },
    { id: "demo6", prediction: "Safe", confidence: 0.99, risk: "Low", 
      time: new Date(Date.now() - 7200000).toLocaleString(), 
      email: "Project update: Q4 milestones achieved successfully.", 
      senderDomain: "internal.org", url: "https://internal.org/update" },
    { id: "demo7", prediction: "Phishing", confidence: 0.92, risk: "High", 
      time: new Date(Date.now() - 604800000).toLocaleString(), 
      email: "CRITICAL: Your account has been compromised! Reset your password immediately.", 
      senderDomain: "verify-account.net", url: "http://verify-account.net/reset",
      reasons: ["Urgent action required", "Password reset scam"] },
    { id: "demo8", prediction: "Safe", confidence: 0.96, risk: "Low", 
      time: new Date(Date.now() - 120000000).toLocaleString(), 
      email: "Team sync recording - Q1 planning session available.", 
      senderDomain: "zoom.us", url: "https://zoom.us/recording" }
];

// ============================================================
// DOCUMENT READY
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    loadHistoryData();

    // Load dark mode preference
    chrome.storage.local.get(["darkMode"], (result) => {
        if (result.darkMode) document.body.classList.add("dark-mode");
    });
});

// ============================================================
// SIDEBAR HOVER LOGIC (same as history.js)
// ============================================================
function initSidebar() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar    = document.getElementById('sidebar');
    let hoverTimeout;

    function openSidebar() {
        clearTimeout(hoverTimeout);
        sidebar.classList.add('open');
    }

    function closeSidebarDelayed() {
        hoverTimeout = setTimeout(() => {
            if (!sidebar.matches(':hover') && !menuToggle.matches(':hover')) {
                sidebar.classList.remove('open');
            }
        }, 200);
    }

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('mouseenter', openSidebar);
        menuToggle.addEventListener('mouseleave', closeSidebarDelayed);
        sidebar.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
        sidebar.addEventListener('mouseleave', closeSidebarDelayed);

        sidebar.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => sidebar.classList.remove('open'));
        });
    }
}

// ============================================================
// DATA LOADING (from Chrome local storage with demo fallback)
// ============================================================
function loadHistoryData() {
    chrome.storage.local.get(["history"], (result) => {
        const storedHistory = result.history;
        if (storedHistory && storedHistory.length > 0) {
            currentHistory = storedHistory;
            console.log('Loaded history for dashboard:', currentHistory.length, 'entries');
        } else {
            // Use demo data if nothing stored
            currentHistory = [...demoHistory];
            console.log('Using demo data for dashboard (no history found)');
            // Optionally save demo data to storage so it appears elsewhere
            chrome.storage.local.set({ history: currentHistory });
        }
        updateDashboard();
    });
}

// ============================================================
// DASHBOARD UPDATE ORCHESTRATOR
// ============================================================
function updateDashboard() {
    updateStats();
    updateCharts();
    updateKeywordList();
    updateDomainList();
}

// ============================================================
// STATS
// ============================================================
function updateStats() {
    const total        = currentHistory.length;
    const safe         = currentHistory.filter(i => i.prediction === "Safe").length;
    const phishing     = currentHistory.filter(i => i.prediction === "Phishing").length;
    const detectionRate = total > 0 ? Math.round((phishing / total) * 100) : 0;

    document.getElementById("totalScanned").innerText = total;
    document.getElementById("safeEmails").innerText = safe;
    document.getElementById("phishingEmails").innerText = phishing;
    document.getElementById("detectionRate").innerText = `${detectionRate}%`;
}

// ============================================================
// CHARTS
// ============================================================
function updateCharts() {
    const safe     = currentHistory.filter(i => i.prediction === "Safe").length;
    const phishing = currentHistory.filter(i => i.prediction === "Phishing").length;
    const total    = currentHistory.length;

    const highRisk   = currentHistory.filter(i => i.risk === "High"   || (i.prediction === "Phishing" && i.confidence > 0.7)).length;
    const mediumRisk = currentHistory.filter(i => i.risk === "Medium" || (i.prediction === "Phishing" && i.confidence <= 0.7 && i.confidence > 0.4)).length;
    const lowRisk    = currentHistory.filter(i => i.risk === "Low"    || i.prediction === "Safe").length;

    const isDark    = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e0e0e0' : '#333';
    const gridColor = "rgba(102, 126, 234, 0.2)";

    // ---- Pie chart ----
    const pieCanvas = document.getElementById('pieChart');
    if (pieCanvas) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieCanvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['Safe Emails', 'Phishing Emails'],
                datasets: [{
                    data: [safe, phishing],
                    backgroundColor: ['#00e676', '#ff1744'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor, font: { size: 12, weight: 'bold' } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                                return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ---- Doughnut / risk chart ----
    const riskCanvas = document.getElementById('riskChart');
    if (riskCanvas) {
        if (riskChart) riskChart.destroy();
        riskChart = new Chart(riskCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['High Risk', 'Medium Risk', 'Low Risk'],
                datasets: [{
                    data: [highRisk, mediumRisk, lowRisk],
                    backgroundColor: ['#ff1744', '#ff9100', '#00e676'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor, font: { size: 12, weight: 'bold' } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
                                return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ---- Trend line chart ----
    const trendCanvas = document.getElementById('trendChart');
    if (trendCanvas) {
        if (trendChart) trendChart.destroy();

        const last7Days    = getLast7Days();
        const dailyPhishing = Array(7).fill(0);
        const dailySafe     = Array(7).fill(0);

        currentHistory.forEach(item => {
            const daysAgo = Math.floor((Date.now() - new Date(item.time)) / (1000 * 60 * 60 * 24));
            if (daysAgo >= 0 && daysAgo < 7) {
                const idx = 6 - daysAgo;
                if (item.prediction === "Phishing") dailyPhishing[idx]++;
                else if (item.prediction === "Safe") dailySafe[idx]++;
            }
        });

        trendChart = new Chart(trendCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [
                    {
                        label: 'Phishing Detected',
                        data: dailyPhishing,
                        borderColor: '#ff1744',
                        backgroundColor: 'rgba(255,23,68,0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#ff1744',
                        pointBorderColor: '#fff'
                    },
                    {
                        label: 'Safe Emails',
                        data: dailySafe,
                        borderColor: '#00e676',
                        backgroundColor: 'rgba(0,230,118,0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#00e676',
                        pointBorderColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: textColor, font: { size: 12, weight: 'bold' }, usePointStyle: true }
                    },
                    tooltip: {
                        callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} emails` }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor, stepSize: 1, precision: 0 },
                        grid: { color: gridColor },
                        title: { display: true, text: 'Number of Emails', color: textColor, font: { weight: 'bold' } }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { color: gridColor },
                        title: { display: true, text: 'Date', color: textColor, font: { weight: 'bold' } }
                    }
                }
            }
        });
    }
}

function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    }
    return days;
}

// ============================================================
// KEYWORDS - Keyword extraction from email content
// ============================================================
function updateKeywordList() {
    const container = document.getElementById('keywordList');
    if (!container) return;

    const phishingKeywords = [
        'urgent', 'verify', 'suspended', 'account', 'password', 'click', 'bank', 'payment',
        'security', 'alert', 'confirm', 'update', 'limited', 'access', 'risk', 'deactivate',
        'immediately', 'paypal', 'amazon', 'invoice', 'refund', 'crypto', 'wallet', 'login',
        'credential', 'unauthorized', 'suspicious', 'locked', 'compromised', 'reset', 'critical'
    ];

    const keywordMap = new Map();
    
    const phishingEmails = currentHistory.filter(i => i.prediction === "Phishing");
    
    phishingEmails.forEach(item => {
        const emailContent = (item.email || "").toLowerCase();
        const reasons = (item.reasons || []).join(' ').toLowerCase();
        const fullText = emailContent + ' ' + reasons;
        
        phishingKeywords.forEach(keyword => {
            if (fullText.includes(keyword)) {
                keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
            }
        });
    });

    const sorted = [...keywordMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="loading">No phishing keywords detected yet</div>';
        return;
    }

    container.innerHTML = sorted.map(([kw, count]) => `
        <div class="keyword-item">
            <span class="keyword-name">${escapeHtml(kw)}</span>
            <span class="keyword-count">${count} times</span>
        </div>
    `).join('');
}

// ============================================================
// DOMAINS - Domain extraction from multiple sources
// ============================================================
function updateDomainList() {
    const container = document.getElementById('domainList');
    if (!container) return;

    const domainMap = new Map();

    currentHistory.forEach(item => {
        let domain = null;
        
        if (item.senderDomain && item.senderDomain.trim() !== '') {
            domain = item.senderDomain;
        }
        else if (item.url && item.url.trim() !== '') {
            try {
                const urlObj = new URL(item.url);
                domain = urlObj.hostname;
            } catch(e) {
                const match = item.url.match(/https?:\/\/([^\/]+)/);
                if (match) domain = match[1];
            }
        }
        else if (item.email) {
            const fromMatch = item.email.match(/from:\s*[<\[]?([^<\[>\s@]+@([^>\]\s]+))/i);
            if (fromMatch && fromMatch[2]) domain = fromMatch[2];
        }
        
        if (domain && domain !== '') {
            domain = domain.replace(/^www\./, '');
            domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
        }
    });

    if (domainMap.size === 0) {
        const phishingItems = currentHistory.filter(i => i.prediction === "Phishing");
        phishingItems.forEach(item => {
            if (item.senderDomain) {
                domainMap.set(item.senderDomain, (domainMap.get(item.senderDomain) || 0) + 1);
            }
        });
    }

    const sorted = [...domainMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="loading">No domains detected yet</div>';
        return;
    }

    container.innerHTML = sorted.map(([domain, count]) => `
        <div class="domain-item">
            <span class="domain-name">${escapeHtml(domain)}</span>
            <span class="domain-count">${count} emails</span>
        </div>
    `).join('');
}

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    const colors = { success: '#4caf50', error: '#ff1744', warning: '#ff9100', info: '#667eea' };
    const bgColor = colors[type] || colors.info;
    
    notification.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; background: ${bgColor};
        color: white; padding: 12px 20px; border-radius: 8px;
        z-index: 10001; animation: slideUp 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px;
    `;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Add CSS animation if not present
if (!document.querySelector('#notification-style')) {
    const style = document.createElement('style');
    style.id = 'notification-style';
    style.textContent = `
        @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// Auto-refresh every 30 seconds
setInterval(() => {
    loadHistoryData();
}, 30000);