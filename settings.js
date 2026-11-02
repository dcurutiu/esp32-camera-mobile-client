const form = document.getElementById("configForm");
const resetBtn = document.getElementById("resetBtn");
const clearBtn = document.getElementById("clearBtn");
const toast = document.getElementById("toast");

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 1500);
}

function fillForm(values) {
    for (const key of Object.keys(DEFAULT_CONFIG)) {
        form.elements[key].value = values[key];
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = {};
    for (const key of Object.keys(DEFAULT_CONFIG)) {
        values[key] = form.elements[key].value.trim();
    }
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(values));
    showToast("Saved");
});

// Puts the default values in the form; the token and cloud name are kept as typed
resetBtn.addEventListener("click", () => {
    fillForm({
        ...DEFAULT_CONFIG,
        mqttToken: form.elements.mqttToken.value,
        cloudName: form.elements.cloudName.value,
    });
});

// Deletes the saved settings (including the token) and shows the empty defaults
clearBtn.addEventListener("click", () => {
    if (!confirm("Delete all saved settings, including the token?")) {
        return;
    }
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    fillForm(DEFAULT_CONFIG);
    showToast("Cleared");
});

fillForm(CONFIG);
