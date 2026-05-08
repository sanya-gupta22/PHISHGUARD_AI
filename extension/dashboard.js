chrome.storage.local.get(["history"], (result) => {

    const history = result.history || [];

    // =========================
    // BASIC STATS
    // =========================

    const phishing = history.filter(
        h => h.prediction === "Phishing"
    ).length;

    const safe = history.filter(
        h => h.prediction === "Safe"
    ).length;

    const high = history.filter(
        h => h.confidence > 0.7
    ).length;

    const medium = history.filter(
        h => h.confidence > 0.4 && h.confidence <= 0.7
    ).length;

    const low = history.filter(
        h => h.confidence <= 0.4
    ).length;

    // =========================
    // UPDATE UI
    // =========================

    document.getElementById("total").innerText =
        history.length;

    document.getElementById("phishing").innerText =
        phishing;

    document.getElementById("safe").innerText =
        safe;

    if(document.getElementById("highRisk")){
        document.getElementById("highRisk").innerText =
            high;
    }

    if(document.getElementById("mediumRisk")){
        document.getElementById("mediumRisk").innerText =
            medium;
    }

    if(document.getElementById("lowRisk")){
        document.getElementById("lowRisk").innerText =
            low;
    }

    // =========================
    // PIE CHART
    // =========================

    const pieCtx = document
        .getElementById("pieChart")
        .getContext("2d");

    new Chart(pieCtx, {
        type: "pie",
        data: {
            labels: ["Safe", "Phishing"],
            datasets: [{
                label: "Detection Results",
                data: [safe, phishing],
                backgroundColor: [
                    "#00e676",
                    "#ff1744"
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: "white"
                    }
                }
            }
        }
    });

    // =========================
    // LINE CHART
    // =========================

    const lineCanvas =
        document.getElementById("lineChart");

    if(lineCanvas){

        const lineCtx =
            lineCanvas.getContext("2d");

        new Chart(lineCtx, {

            type: "line",

            data: {
                labels: history.map(
                    (_, i) => `Scan ${i + 1}`
                ),

                datasets: [{
                    label: "Confidence %",
                    data: history.map(
                        h => Math.round(h.confidence * 100)
                    ),

                    borderColor: "#00b0ff",
                    backgroundColor: "rgba(0,176,255,0.2)",
                    tension: 0.4,
                    fill: true
                }]
            },

            options: {
                responsive: true,

                scales: {

                    y: {
                        beginAtZero: true,
                        max: 100,

                        ticks: {
                            color: "white"
                        },

                        grid: {
                            color: "rgba(255,255,255,0.1)"
                        }
                    },

                    x: {

                        ticks: {
                            color: "white"
                        },

                        grid: {
                            color: "rgba(255,255,255,0.1)"
                        }
                    }
                },

                plugins: {

                    legend: {
                        labels: {
                            color: "white"
                        }
                    }
                }
            }
        });
    }

    // =========================
    // WEEKLY REPORT
    // =========================

    const weekly = {};

    history.forEach(item => {

        const date = new Date(item.time)
            .toLocaleDateString();

        weekly[date] =
            (weekly[date] || 0) + 1;
    });

    console.log("Weekly Report:", weekly);

});