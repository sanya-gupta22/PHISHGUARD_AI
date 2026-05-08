async function scanEmail(emailText) {

    const response = await fetch("https://phishing-detection-apia.onrender.com/predict", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: emailText })
    });

    const data = await response.json();

    if (data.label === "Phishing") {

        showWarningBanner(data);
    }
}

function showWarningBanner(data) {

    if (document.querySelector(".phishing-warning")) return;

    const warning = document.createElement("div");

    warning.className = "phishing-warning";

    warning.innerHTML = `
        ⚠ Warning: This email may be phishing.<br><br>
        Confidence: ${Math.round(data.confidence * 100)}%<br>
        Risk: ${data.risk}<br><br>
        Reasons:<br>
        ${data.reasons.map(r => `• ${r}<br>`).join('')}
    `;

    document.body.prepend(warning);
}

setInterval(() => {

    const emailBody = document.querySelector(".a3s");

    if (emailBody) {

        const text = emailBody.innerText;

        scanEmail(text);
    }

}, 7000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === "extractEmail") {

        const emailBody = document.querySelector(".a3s");

        sendResponse({
            text: emailBody ? emailBody.innerText : ""
        });
    }
});