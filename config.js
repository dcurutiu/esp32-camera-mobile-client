// Default settings. Edit them in config.html (saved in this browser's localStorage).
// mqttToken and cloudName have no default: you must enter them once in config.html.
const DEFAULT_CONFIG = {
    mqttUrl: "wss://mqtt.flespi.io:443",
    mqttToken: "",
    statusTopic: "camera/status",
    commandTopic: "camera/command",
    eventTopic: "camera/event",
    uploadStatusTopic: "camera/upload-status",
    errorTopic: "camera/error",
    cloudName: "",
    publicId: "plopilor",
};

const CONFIG_STORAGE_KEY = "esp32_view_config";

const CONFIG = { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || "{}") };

// Without a token and a cloud name the page cannot work, so go and ask for them
if (!CONFIG.mqttToken || !CONFIG.cloudName) {
    if (!location.pathname.endsWith("config.html")) {
        location.replace("config.html");
    }
}
