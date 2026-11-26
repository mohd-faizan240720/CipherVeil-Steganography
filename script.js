
const imageInput = document.getElementById("imageInput");
const dropzone = document.getElementById("dropzone");
const preview = document.getElementById("preview");
const previewImg = document.getElementById("previewImg");
const fileStatus = document.getElementById("fileStatus");
const fileName = document.getElementById("fileName");
const message = document.getElementById("message");
const count = document.getElementById("count");
const hideBtn = document.getElementById("hideBtn");
const revealBtn = document.getElementById("revealBtn");
const downloadLink = document.getElementById("downloadLink");

const MAGIC = new Uint8Array([67, 86, 76, 49]);
const HEADER_SIZE = 8;

let selectedImage = null;
let currentImageUrl = null;
let busy = false;

message.addEventListener("input", () => {
    count.textContent = `${message.value.length.toLocaleString()} CHARACTERS`;
});

document.getElementById("changeFile").addEventListener("click", () => {
    imageInput.click();
});

imageInput.addEventListener("change", event => {
    const file = event.target.files[0];
    if (file) loadImage(file);
    event.target.value = "";
});

["dragenter", "dragover"].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.add("dragover");
    });
});

["dragleave", "drop"].forEach(eventName => {
    dropzone.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
    });
});

dropzone.addEventListener("drop", event => {
    const file = event.dataTransfer.files[0];
    if (file) loadImage(file);
});

function showStatus(title, text, isError = false) {
    document.getElementById("resultTitle").textContent = title;
    document.getElementById("resultText").textContent = text;

    const mark = document.getElementById("resultMark");
    mark.textContent = isError ? "!" : "✦";
    mark.style.color = isError ? "#ff758b" : "var(--cyan)";
}

function loadImage(file) {
    if (file.type !== "image/png" &&
        !file.name.toLowerCase().endsWith(".png")) {
        showStatus("PNG REQUIRED", "Please select a PNG image file.", true);
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        showStatus("FILE TOO LARGE", "Maximum image size is 20 MB.", true);
        return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
        selectedImage = img;

        if (currentImageUrl) {
            URL.revokeObjectURL(currentImageUrl);
        }

        currentImageUrl = url;
        previewImg.src = url;
        fileName.textContent = file.name;

        dropzone.classList.add("hidden");
        preview.classList.remove("hidden");

        fileStatus.textContent =
            `${img.naturalWidth} × ${img.naturalHeight}`;

        fileStatus.style.color = "var(--cyan)";
        downloadLink.classList.add("hidden");

        showStatus(
            "IMAGE LOADED",
            "PNG loaded. Enter a message to hide or reveal a hidden message."
        );
    };

    img.onerror = () => {
        URL.revokeObjectURL(url);
        showStatus("IMAGE ERROR", "The selected PNG could not be opened.", true);
    };

    img.src = url;
}

function getImageData() {
    if (!selectedImage) {
        throw new Error("Please load a PNG image first.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = selectedImage.naturalWidth;
    canvas.height = selectedImage.naturalHeight;

    const context = canvas.getContext("2d", {
        willReadFrequently: true
    });

    context.drawImage(selectedImage, 0, 0);

    return {
        canvas,
        context,
        imageData: context.getImageData(
            0, 0, canvas.width, canvas.height
        )
    };
}

function channelOffset(bitIndex) {
    return Math.floor(bitIndex / 3) * 4 + (bitIndex % 3);
}

function readBit(pixels, bitIndex) {
    return pixels[channelOffset(bitIndex)] & 1;
}

function writeBit(pixels, bitIndex, bit) {
    const offset = channelOffset(bitIndex);
    pixels[offset] = (pixels[offset] & 0xFE) | bit;
}

function bytesToBits(bytes) {
    const bits = new Uint8Array(bytes.length * 8);

    for (let i = 0; i < bytes.length; i++) {
        for (let b = 0; b < 8; b++) {
            bits[i * 8 + b] = (bytes[i] >> (7 - b)) & 1;
        }
    }

    return bits;
}

function makePayload(text) {
    const textBytes = new TextEncoder().encode(text);

    const payload = new Uint8Array(
        HEADER_SIZE + textBytes.length
    );

    payload.set(MAGIC, 0);

    new DataView(payload.buffer).setUint32(
        4, textBytes.length, false
    );

    payload.set(textBytes, HEADER_SIZE);

    return payload;
}

function setBusy(value) {
    busy = value;

    hideBtn.disabled = value;
    revealBtn.disabled = value;

    hideBtn.innerHTML = value
        ? "PROCESSING..."
        : "<span>↳</span> HIDE &amp; DOWNLOAD";

    revealBtn.innerHTML = value
        ? "PLEASE WAIT..."
        : "<span>⌕</span> REVEAL MESSAGE";
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.classList.remove("hidden");

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    const encodedImage = new Image();

    encodedImage.onload = () => {
        selectedImage = encodedImage;

        if (currentImageUrl) {
            URL.revokeObjectURL(currentImageUrl);
        }

        currentImageUrl = url;
        previewImg.src = url;
        fileName.textContent = filename;

        fileStatus.textContent =
            `${encodedImage.naturalWidth} × ${encodedImage.naturalHeight} · ENCODED`;

        dropzone.classList.add("hidden");
        preview.classList.remove("hidden");

        showStatus(
            "MESSAGE HIDDEN SUCCESSFULLY",
            "PNG downloaded. You can now reveal the message."
        );
    };

    encodedImage.onerror = () => {
        showStatus("IMAGE ERROR", "Encoded PNG could not be reloaded.", true);
    };

    encodedImage.src = url;
}

// HIDE MESSAGE
hideBtn.addEventListener("click", async () => {
    if (busy) return;

    if (!selectedImage) {
        return showStatus("NO IMAGE SELECTED", "Please load an image first.", true);
    }

    if (!message.value.length) {
        return showStatus("MESSAGE REQUIRED", "Please enter a secret message.", true);
    }

    setBusy(true);

    try {
        const { canvas, context, imageData } = getImageData();

        const payload = makePayload(message.value);

        const capacityBytes = Math.floor(
            (imageData.data.length / 4) * 3 / 8
        );

        if (payload.length > capacityBytes) {
            throw new Error("Message is too large for this image.");
        }

        const bits = bytesToBits(payload);

        for (let i = 0; i < bits.length; i++) {
            writeBit(imageData.data, i, bits[i]);
        }

        context.putImageData(imageData, 0, 0);

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(result => {
                if (result) resolve(result);
                else reject(new Error("Could not export PNG."));
            }, "image/png");
        });

        downloadBlob(blob, "cipherveil_hidden.png");

    } catch (error) {
        showStatus("HIDE FAILED", error.message, true);
    } finally {
        setBusy(false);
    }
});

// REVEAL CIPHERVEIL FORMAT
function revealCipherVeil(pixels, totalBits) {
    if (totalBits < HEADER_SIZE * 8) return null;

    const header = new Uint8Array(HEADER_SIZE);

    for (let i = 0; i < HEADER_SIZE * 8; i++) {
        if (readBit(pixels, i)) {
            header[i >> 3] |= 1 << (7 - (i & 7));
        }
    }

    for (let i = 0; i < MAGIC.length; i++) {
        if (header[i] !== MAGIC[i]) return null;
    }

    const length = new DataView(header.buffer).getUint32(4, false);

    const availableBytes = Math.floor(
        (totalBits - HEADER_SIZE * 8) / 8
    );

    if (length === 0 || length > availableBytes) {
        throw new Error("Hidden message data is incomplete or damaged.");
    }

    const payload = new Uint8Array(length);
    const startBit = HEADER_SIZE * 8;

    for (let i = 0; i < length * 8; i++) {
        if (readBit(pixels, startBit + i)) {
            payload[i >> 3] |= 1 << (7 - (i & 7));
        }
    }

    return new TextDecoder("utf-8", {
        fatal: true
    }).decode(payload);
}

// REVEAL LEGACY STEGANO FORMAT
function revealLegacyStegano(pixels, totalBits) {
    const bytes = [];
    const completeBytes = Math.floor(totalBits / 8);

    for (let byteIndex = 0; byteIndex < completeBytes; byteIndex++) {
        let value = 0;

        for (let bit = 0; bit < 8; bit++) {
            value = (value << 1) |
                readBit(pixels, byteIndex * 8 + bit);
        }

        bytes.push(value);

        const n = bytes.length;

        if (
            n >= 3 &&
            bytes[n - 1] === 0 &&
            bytes[n - 2] === 0 &&
            bytes[n - 3] === 0
        ) {
            const messageBytes = new Uint8Array(
                bytes.slice(0, n - 3)
            );

            if (messageBytes.length === 0) return null;

            try {
                return new TextDecoder("utf-8", {
                    fatal: true
                }).decode(messageBytes);
            } catch {
                return null;
            }
        }
    }

    return null;
}

// REVEAL MESSAGE
revealBtn.addEventListener("click", () => {
    if (busy) return;

    if (!selectedImage) {
        return showStatus(
            "NO IMAGE SELECTED",
            "Please select the PNG containing the hidden message.",
            true
        );
    }

    setBusy(true);

    try {
        const { imageData } = getImageData();

        const pixels = imageData.data;

        const totalBits = Math.floor(
            (pixels.length / 4) * 3
        );

        let recovered = revealCipherVeil(pixels, totalBits);

        if (recovered === null) {
            recovered = revealLegacyStegano(pixels, totalBits);
        }

        if (recovered === null) {
            throw new Error(
                "No hidden message found. Please select the original PNG downloaded after hiding the message."
            );
        }

        message.value = recovered;

        count.textContent =
            `${recovered.length.toLocaleString()} CHARACTERS`;

        showStatus(
            "MESSAGE REVEALED SUCCESSFULLY",
            `Recovered message: ${recovered}`
        );

    } catch (error) {
        showStatus(
            "REVEAL FAILED",
            error.message || "Could not read the hidden message.",
            true
        );
    } finally {
        setBusy(false);
    }
});
