// dashboard.js — PhishGuard AI Dashboard
// Sidebar opens on hover, overlays content without shifting

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    loadHistoryData();
});

// ============================================================
// SIDEBAR HOVER LOGIC - OVERLAY MODE (NO CONTENT SHIFT)
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
            item.addEventListener('click', () => {
                sidebar.classList.remove('open');
            });
        });
    }
}

// ============================================================
// DATA LOADING
// ============================================================

// Enhanced demo data with proper URLs and more content for keyword matching
const demoHistory = [
    { 
        id: "1", prediction: "Phishing", confidence: 0.94, risk: "High", 
        time: new Date(Date.now() - 86400000).toLocaleString(), 
        email: "URGENT: Your PayPal account will be suspended immediately! Please verify your account by clicking the link below. Failure to verify will result in account closure.", 
        senderDomain: "paypalsecurity.com", 
        url: "https://paypalsecurity.com/verify",
        reasons: ["Urgent action required", "Suspicious links", "Account verification needed"] 
    },
    { 
        id: "2", prediction: "Safe", confidence: 0.98, risk: "Low", 
        time: new Date(Date.now() - 3600000).toLocaleString(), 
        email: "Meeting notes for Q4 planning - Please find attached the agenda for tomorrow's meeting.", 
        senderDomain: "company.com", 
        url: "https://company.com/meeting" 
    },
    { 
        id: "3", prediction: "Phishing", confidence: 0.87, risk: "High", 
        time: new Date(Date.now() - 172800000).toLocaleString(), 
        email: "Your Amazon order #ORD-3847 needs verification. Click here to confirm your payment details. Your order is on hold until verification.", 
        senderDomain: "amaz0nverify.net", 
        url: "http://amaz0nverify.net/confirm",
        reasons: ["Password verification", "Suspicious link", "Payment confirmation needed"] 
    },
    { 
        id: "4", prediction: "Safe", confidence: 0.95, risk: "Low", 
        time: new Date(Date.now() - 259200000).toLocaleString(), 
        email: "Weekly newsletter: New security features available for your account.", 
        senderDomain: "newsletter.com", 
        url: "https://newsletter.com/weekly" 
    },
    { 
        id: "5", prediction: "Phishing", confidence: 0.76, risk: "Medium", 
        time: new Date(Date.now() - 43200000).toLocaleString(), 
        email: "Security Alert: Unusual login detected from new device. Please verify your bank account information immediately to prevent suspension.", 
        senderDomain: "secure-bank-alerts.com", 
        url: "http://secure-bank-alerts.com/verify",
        reasons: ["Financial references", "Threatening language", "Account verification"] 
    },
    { 
        id: "6", prediction: "Safe", confidence: 0.99, risk: "Low", 
        time: new Date(Date.now() - 7200000).toLocaleString(), 
        email: "Project update: Q4 milestones achieved successfully. Great work team!", 
        senderDomain: "internal.org", 
        url: "https://internal.org/update" 
    },
    { 
        id: "7", prediction: "Phishing", confidence: 0.92, risk: "High", 
        time: new Date(Date.now() - 604800000).toLocaleString(), 
        email: "CRITICAL: Your account has been compromised! Reset your password immediately by clicking this link. Failure to act will result in permanent account suspension.", 
        senderDomain: "verify-account.net", 
        url: "http://verify-account.net/reset",
        reasons: ["Urgent action required", "Threatening language", "Password reset scam"] 
    },
    { 
        id: "8", prediction: "Safe", confidence: 0.96, risk: "Low", 
        time: new Date(Date.now() - 120000000).toLocaleString(), 
        email: "Team sync recording - Q1 planning session available for review.", 
        senderDomain: "zoom.us", 
        url: "https://zoom.us/recording" 
    }
];

let currentHistory = [];
let pieChart, riskChart, trendChart;

function loadHistoryData() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["history", "darkMode"], (result) => {
            if (result.darkMode) document.body.classList.add("dark-mode");
            currentHistory = (result.history && result.history.length)
                ? result.history
                : [...demoHistory];
            updateDashboard();
        });

        chrome.storage.onChanged && chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.history) {
                currentHistory = changes.history.newValue || [];
                updateDashboard();
            }
        });
    } else {
        const stored = localStorage.getItem('phishguard_dashboard_data');
        currentHistory = stored ? JSON.parse(stored) : [...demoHistory];
        if (!stored) localStorage.setItem('phishguard_dashboard_data', JSON.stringify(currentHistory));
        updateDashboard();
    }
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

    document.getElementById("totalScanned").innerText  = total;
    document.getElementById("safeEmails").innerText    = safe;
    document.getElementById("phishingEmails").innerText = phishing;
    document.getElementById("detectionRate").innerText  = `${detectionRate}%`;
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
// KEYWORDS - Fixed: Proper keyword extraction from email content
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
    
    // Process all phishing emails
    const phishingEmails = currentHistory.filter(i => i.prediction === "Phishing");
    
    phishingEmails.forEach(item => {
        // Get email content or reasons
        const emailContent = (item.email || "").toLowerCase();
        const reasons = (item.reasons || []).join(' ').toLowerCase();
        const fullText = emailContent + ' ' + reasons;
        
        // Count keyword occurrences
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
// DOMAINS - Fixed: Proper domain extraction from multiple sources
// ============================================================
function updateDomainList() {
    const container = document.getElementById('domainList');
    if (!container) return;

    const domainMap = new Map();

    currentHistory.forEach(item => {
        let domain = null;
        
        // Priority 1: Use senderDomain if available
        if (item.senderDomain && item.senderDomain.trim() !== '') {
            domain = item.senderDomain;
        }
        // Priority 2: Extract from URL
        else if (item.url && item.url.trim() !== '') {
            try {
                const urlObj = new URL(item.url);
                domain = urlObj.hostname;
            } catch(e) {
                // If URL parsing fails, try to extract domain pattern
                const match = item.url.match(/https?:\/\/([^\/]+)/);
                if (match) domain = match[1];
            }
        }
        // Priority 3: Extract from email content (fallback)
        else if (item.email) {
            const fromMatch = item.email.match(/from:\s*[<\[]?([^<\[>\s@]+@([^>\]\s]+))/i);
            if (fromMatch && fromMatch[2]) domain = fromMatch[2];
        }
        
        if (domain && domain !== '') {
            // Clean up domain (remove www. prefix)
            domain = domain.replace(/^www\./, '');
            domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
        }
    });

    // If still no domains found, use demo domains from phishing emails
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

// Auto-refresh every 30 seconds
setInterval(loadHistoryData, 30000);