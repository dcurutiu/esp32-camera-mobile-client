const dot = document.getElementById("dot");
const statusText = document.getElementById("statusText");
const photo = document.getElementById("photo");
const downloadLink = document.getElementById("downloadLink");
const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");
const toast = document.getElementById("toast");

const TOAST_MS = 1500;
let toastTimer = null;

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), TOAST_MS);
}

// Each operation: command -> start event -> end event ("*ed"), all within timeoutMs.
// The board is busy from the click (or the start event) until the end event.
const OPERATIONS = [
    {
        command: "acquire",
        button: document.getElementById("acquireBtn"),
        label: "Acquire image",
        startEvent: "uploading",
        endEvent: "uploaded",
        timeoutMs: 90 * 1000,
        startToast: "Board is uploading...",
        failStart: "The ESP never reported 'uploading'. It may be busy, or the camera capture failed.",
        failEnd: "The upload started but the ESP never reported 'uploaded'. The upload may have failed.",
    },
    {
        command: "calibrate",
        button: document.getElementById("calibrateBtn"),
        label: "Calibrate camera",
        startEvent: "calibrating",
        endEvent: "calibrated",
        timeoutMs: 2 * 60 * 1000,
        startToast: "Board is calibrating...",
        failStart: "The ESP never reported 'calibrating'. It may be busy.",
        failEnd: "The calibration started but the ESP never reported 'calibrated'. It may have failed.",
    },
];

let espOnline = false;
let current = null;      // the operation in progress, or null when idle
let waitingFor = "";     // the event we expect next
let timeoutTimer = null;

function updateButtons() {
    for (const op of OPERATIONS) {
        op.button.disabled = !espOnline || current !== null;
        op.button.textContent = current === op ? "Working..." : op.label;
    }
}

function showStatus(status) {
    espOnline = status === "online";
    dot.className = "dot " + status;
    statusText.textContent = "Board is " + status;
    updateButtons();
}

function showError(message) {
    errorText.textContent = message;
    errorBox.classList.remove("hidden");
    photo.classList.add("hidden");
    downloadLink.classList.add("hidden");
}

function hideError() {
    errorBox.classList.add("hidden");
    photo.classList.remove("hidden");
    downloadLink.classList.remove("hidden");
}

function onTimeout() {
    showError(waitingFor === current.startEvent ? current.failStart : current.failEnd);
    setIdle();
}

function setBusy(op, expecting) {
    current = op;
    waitingFor = expecting;
    if (!timeoutTimer) {
        timeoutTimer = setTimeout(onTimeout, op.timeoutMs);
    }
    updateButtons();
}

function setIdle() {
    current = null;
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
    updateButtons();
}

// Progress means the board is alive, so the timeout starts over
function resetTimeout() {
    if (!current) {
        return;
    }
    clearTimeout(timeoutTimer);
    timeoutTimer = setTimeout(onTimeout, current.timeoutMs);
}

function reloadImage() {
    // The changing "t" in the file name makes the browser fetch the image again instead of using its cache
    const base = `https://res.cloudinary.com/${CONFIG.cloudName}/image/upload`;
    const file = `${CONFIG.publicId}.jpg?t=${Date.now()}`;
    photo.src = `${base}/${file}`;
    // The displayed image is the original upload; fl_attachment makes Cloudinary send it as a download
    downloadLink.href = `${base}/fl_attachment:esp32_view/${file}`;
}

function start(op) {
    hideError();
    setBusy(op, op.startEvent);
    client.publish(CONFIG.commandTopic, op.command, { qos: 1 });
}

function onEvent(text) {
    for (const op of OPERATIONS) {
        if (text === op.startEvent) {
            showToast(op.startToast);
            setBusy(op, op.endEvent);
        } else if (text === op.endEvent) {
            setIdle();
            if (op.command === "acquire") {
                // The page reloads right away, so the toast is shown again after the reload
                sessionStorage.setItem("showUploaded", "1");
                location.reload();
            } else {
                showToast("Board " + op.endEvent);
            }
        }
    }
}

// The board answers "ping" with "pong". No answer within PONG_WAIT_MS means it is offline.
const PONG_WAIT_MS = 5 * 1000;
const reloadBtn = document.getElementById("reloadBtn");
let pongTimer = null;

function stopSpinning() {
    clearTimeout(pongTimer);
    reloadBtn.classList.remove("spinning");
}

// Only runs when the reload button is pressed
function sendPing() {
    if (!client.connected || reloadBtn.classList.contains("spinning")) {
        return;
    }
    reloadBtn.classList.add("spinning");
    client.publish(CONFIG.commandTopic, "ping", { qos: 0 });
    pongTimer = setTimeout(() => {
        stopSpinning();
        showStatus("offline");
    }, PONG_WAIT_MS);
}

function onPong() {
    stopSpinning();
    showStatus("online");
}

const client = mqtt.connect(CONFIG.mqttUrl, {
    username: CONFIG.mqttToken,
    password: "",
});

client.on("connect", () => {
    client.subscribe([CONFIG.statusTopic, CONFIG.eventTopic, CONFIG.uploadStatusTopic], { qos: 1 });
});

reloadBtn.addEventListener("click", sendPing);

client.on("message", (topic, message) => {
    const text = message.toString();
    console.log("MQTT message:", topic, text);
    if (topic === CONFIG.statusTopic) {
        if (text !== "online") {
            showStatus(text);
        }
    } else if (topic === CONFIG.eventTopic) {
        if (text === "pong") {
            onPong();
        } else {
            onEvent(text);
        }
    } else if (topic === CONFIG.uploadStatusTopic) {
        // After a page reload we may have missed "uploading", so progress also marks the board busy
        if (!current) {
            setBusy(OPERATIONS[0], OPERATIONS[0].endEvent);
        }
        resetTimeout();
        showToast("Uploading " + text);
    }
});

client.on("error", () => {
    statusText.textContent = "MQTT error";
});

client.on("offline", () => {
    espOnline = false;
    dot.className = "dot";
    statusText.textContent = "connecting...";
    updateButtons();
});

for (const op of OPERATIONS) {
    op.button.addEventListener("click", () => start(op));
}

updateButtons();
showStatus("offline");
reloadImage();

if (sessionStorage.getItem("showUploaded")) {
    sessionStorage.removeItem("showUploaded");
    showToast("Board uploaded");
}