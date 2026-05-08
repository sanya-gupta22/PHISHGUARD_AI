const API_URL = "https://phishing-detection-apia.onrender.com/predict";
    chrome.tabs.sendMessage(tab.id, { action: "extractEmail" }, async (response) => {

        if (!response || !response.text) {
            alert("No email detected");
            return;
        }

        const res = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: response.text })
        });

        const data = await res.json();

        document.getElementById("status").innerText =
            `Status: ${data.label === 'Phishing' ? '⚠ Suspicious' : '✅ Safe'}`;

        document.getElementById("confidence").innerText =
            `${Math.round(data.confidence * 100)}%`;

        document.getElementById("meter-fill").style.width =
            `${data.confidence * 100}%`;

        document.getElementById("risk-level").innerText =
            `Risk Level: ${data.risk}`;

        document.getElementById("reasons").innerHTML =
            `<h4>Reasons</h4>` +
            data.reasons.map(r => `<p>⚠ ${r}</p>`).join('');

        document.getElementById("tips").innerHTML =
            `<h4>Safety Tips</h4>` +
            data.tips.map(t => `<p>✔ ${t}</p>`).join('');

        saveHistory(response.text, data);
    });
});

function saveHistory(email, data) {

    chrome.storage.local.get(["history"], (result) => {

        let history = result.history || [];

        history.unshift({
            email: email.substring(0, 100),
            prediction: data.label,
            confidence: data.confidence,
            time: new Date().toLocaleString()
        });

        chrome.storage.local.set({ history });
    });
}

historyBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "history.html" });
});

dashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "dashboard.html" });
});

const darkToggle = document.getElementById("darkToggle");

darkToggle.addEventListener("change", () => {
    document.body.classList.toggle("dark-mode");
});