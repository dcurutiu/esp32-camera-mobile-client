const dot = document.getElementById("dot");
const statusText = document.getElementById("statusText");
const photo = document.getElementById("photo");
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
}

function hideError() {
    errorBox.classList.add("hidden");
    photo.classList.remove("hidden");
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
    photo.src = `https://res.cloudinary.com/${CONFIG.cloudName}/image/upload/${CONFIG.publicId}.jpg?t=${Date.now()}`;
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

const client = mqtt.connect(CONFIG.mqttUrl, {
    username: CONFIG.mqttToken,
    password: "",
});

client.on("connect", () => {
    client.subscribe([CONFIG.statusTopic, CONFIG.eventTopic, CONFIG.uploadStatusTopic], { qos: 1 });
});

client.on("message", (topic, message) => {
    const text = message.toString();
    console.log("MQTT message:", topic, text);
    if (topic === CONFIG.statusTopic) {
        showStatus(text);
    } else if (topic === CONFIG.eventTopic) {
        onEvent(text);
    } else if (topic === CONFIG.uploadStatusTopic) {
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
reloadImage();

if (sessionStorage.getItem("showUploaded")) {
    sessionStorage.removeItem("showUploaded");
    showToast("Board uploaded");
}