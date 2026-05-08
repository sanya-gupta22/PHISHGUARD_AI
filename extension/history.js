chrome.storage.local.get(["history"], (result) => {

    const history = result.history || [];

    const tbody = document.querySelector("tbody");

    history.forEach(item => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${item.email}</td>
            <td>${item.prediction}</td>
            <td>${Math.round(item.confidence * 100)}%</td>
            <td>${item.time}</td>
        `;

        tbody.appendChild(row);
    });
});