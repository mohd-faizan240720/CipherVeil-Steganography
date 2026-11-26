// CIPHERVEIL - IMAGE STEGANOGRAPHY
// Supports CipherVeil + Python Stegano LSB formats.

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

const MAGIC = [67, 86, 76, 49]; // CVL1
const HEADER_SIZE = 8;

let selectedImage = null;
let currentImageUrl = null;
let busy = false;


// ---------------- MESSAGE COUNTER ----------------

message.addEventListener("input", () => {
    count.textContent =
        `${message.value.length.toLocaleString()} CHARACTERS`;
});


// ---------------- IMAGE UPLOAD ----------------

document.getElementById("changeFile").addEventListener("click", () => {
    imageInput.click();
});

imageInput.addEventListener("change", event => {
    const file = event.target.files[0];

    if (file) loadImage(file);

    event.target.value = "";
});

["dragenter", "dragover"].forEach(name => {
    dropzone.addEventListener(name, event => {
        event.preventDefault();
        dropzone.classList.add("dragover");
    });
});

["dragleave", "drop"].forEach(name => {
    dropzone.addEventListener(name, event => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
    });
});

dropzone.addEventListener("drop", event => {
    const file = event.dataTransfer.files[0];

    if (file) loadImage(file);
});


// ---------------- STATUS ----------------

function showStatus(title, text, isError = false) {
    document.getElementById("resultTitle").textContent = title;
    document.getElementById("resultText").textContent = text;

    const mark = document.getElementById("resultMark");

    mark.textContent = isError ? "!" : "✦";
    mark.style.color = isError ? "#ff758b" : "var(--cyan)";
}


// ---------------- LOAD IMAGE ----------------

function loadImage(file) {
    if (
        file.type !== "image/png" &&
        !file.name.toLowerCase().endsWith(".png")
    ) {
        showStatus("PNG REQUIRED", "Please select a PNG image.", true);
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        showStatus("FILE TOO LARGE", "Maximum size is 20 MB.", true);
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
            "Image loaded successfully. Enter a message or reveal an existing one."
        );
    };

    img.onerror = () => {
        URL.revokeObjectURL(url);

        showStatus(
            "IMAGE ERROR",
            "Unable to open this PNG image.",
            true
        );
    };

    img.src = url;
}


// ---------------- CANVAS ----------------

function getImageData() {
    if (!selectedImage) {
        throw new Error("Please select a PNG image first.");
    }

    const canvas = document.createElement("canvas");

    canvas.width = selectedImage.naturalWidth;
    canvas.height = selectedImage.naturalHeight;

    const context = canvas.getContext("2d", {
        willReadFrequently: true
    });

    context.drawImage(selectedImage, 0, 0);

    const imageData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    return {
        canvas,
        context,
        imageData
    };
}


// ---------------- LSB FUNCTIONS ----------------

// RGB channels only. Alpha channel is ignored.

function channelOffset(bitIndex) {
    return (
        Math.floor(bitIndex / 3) * 4 +
        (bitIndex % 3)
    );
}

function readBit(pixels, bitIndex) {
    return pixels[channelOffset(bitIndex)] & 1;
}

function writeBit(pixels, bitIndex, bit) {
    const offset = channelOffset(bitIndex);

    pixels[offset] =
        (pixels[offset] & 254) | bit;
}


function bytesToBits(bytes) {
    const bits = new Uint8Array(bytes.length * 8);

    for (let i = 0; i < bytes.length; i++) {
        for (let b = 0; b < 8; b++) {
            bits[i * 8 + b] =
                (bytes[i] >> (7 - b)) & 1;
        }
    }

    return bits;
}


function readEmbeddedBytes(pixels, totalBits) {
    const totalBytes = Math.floor(totalBits / 8);
    const bytes = new Uint8Array(totalBytes);

    for (let i = 0; i < totalBytes; i++) {
        let value = 0;

        for (let b = 0; b < 8; b++) {
            value =
                (value << 1) |
                readBit(pixels, i * 8 + b);
        }

        bytes[i] = value;
    }

    return bytes;
}


// ---------------- CIPHERVEIL FORMAT ----------------

function makePayload(text) {
    const textBytes = new TextEncoder().encode(text);

    const payload = new Uint8Array(
        HEADER_SIZE + textBytes.length
    );

    payload.set(MAGIC, 0);

    new DataView(payload.buffer).setUint32(
        4,
        textBytes.length,
        false
    );

    payload.set(textBytes, HEADER_SIZE);

    return payload;
}


function revealCipherVeil(bytes) {
    if (bytes.length < HEADER_SIZE) return null;

    for (let i = 0; i < MAGIC.length; i++) {
        if (bytes[i] !== MAGIC[i]) {
            return null;
        }
    }

    const headerBuffer = bytes.slice(0, HEADER_SIZE);

    const length = new DataView(
        headerBuffer.buffer,
        headerBuffer.byteOffset,
        headerBuffer.byteLength
    ).getUint32(4, false);

    if (
        length === 0 ||
        length > bytes.length - HEADER_SIZE
    ) {
        throw new Error("Hidden message is incomplete or damaged.");
    }

    const textBytes = bytes.slice(
        HEADER_SIZE,
        HEADER_SIZE + length
    );

    return new TextDecoder("utf-8", {
        fatal: true
    }).decode(textBytes);
}


// ---------------- PYTHON STEGANO NEW FORMAT ----------------

// Current Stegano format:
// Message length + ":" + UTF-8 message bytes.

function revealPythonStegano(bytes) {
    let colonPosition = -1;

    const maxPrefixLength = Math.min(bytes.length, 12);

    for (let i = 0; i < maxPrefixLength; i++) {
        if (bytes[i] === 58) {
            colonPosition = i;
            break;
        }

        if (bytes[i] < 48 || bytes[i] > 57) {
            return null;
        }
    }

    if (colonPosition <= 0) return null;

    const lengthText = new TextDecoder().decode(
        bytes.slice(0, colonPosition)
    );

    const length = Number(lengthText);

    if (
        !Number.isSafeInteger(length) ||
        length <= 0 ||
        length > bytes.length - colonPosition - 1
    ) {
        return null;
    }

    const textBytes = bytes.slice(
        colonPosition + 1,
        colonPosition + 1 + length
    );

    try {
        return new TextDecoder("utf-8", {
            fatal: true
        }).decode(textBytes);
    } catch {
        return null;
    }
}


// ---------------- PYTHON STEGANO OLD FORMAT ----------------

// Older versions used a null-byte terminator.

function revealOldStegano(bytes) {
    for (let i = 2; i < bytes.length; i++) {

        if (
            bytes[i] === 0 &&
            bytes[i - 1] === 0 &&
            bytes[i - 2] === 0
        ) {
            const textBytes = bytes.slice(0, i - 2);

            if (textBytes.length === 0) return null;

            try {
                return new TextDecoder("utf-8", {
                    fatal: true
                }).decode(textBytes);
            } catch {
                return null;
            }
        }
    }

    // Also check a single null-byte ending.
    const end = bytes.indexOf(0);

    if (end > 0) {
        try {
            return new TextDecoder("utf-8", {
                fatal: true
            }).decode(bytes.slice(0, end));
        } catch {
            return null;
        }
    }

    return null;
}


// ---------------- BUTTON STATE ----------------

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


// ---------------- DOWNLOAD IMAGE ----------------

async function downloadBlob(blob, filename) {
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

    await new Promise((resolve, reject) => {
        encodedImage.onload = resolve;
        encodedImage.onerror = reject;
        encodedImage.src = url;
    });

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
}


// ---------------- HIDE MESSAGE ----------------

hideBtn.addEventListener("click", async () => {
    if (busy) return;

    if (!selectedImage) {
        showStatus("NO IMAGE", "Please select an image first.", true);
        return;
    }

    if (!message.value.length) {
        showStatus("MESSAGE REQUIRED", "Enter your secret message.", true);
        return;
    }

    setBusy(true);

    try {
        const {
            canvas,
            context,
            imageData
        } = getImageData();

        const payload = makePayload(message.value);

        const capacityBits =
            (imageData.width * imageData.height) * 3;

        const capacityBytes =
            Math.floor(capacityBits / 8);

        if (payload.length > capacityBytes) {
            throw new Error(
                "Message is too large for this image."
            );
        }

        const bits = bytesToBits(payload);

        for (let i = 0; i < bits.length; i++) {
            writeBit(imageData.data, i, bits[i]);
        }

        context.putImageData(imageData, 0, 0);

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(result => {
                if (result) {
                    resolve(result);
                } else {
                    reject(new Error("PNG export failed."));
                }
            }, "image/png");
        });

        await downloadBlob(blob, "cipherveil_hidden.png");

        showStatus(
            "MESSAGE HIDDEN SUCCESSFULLY",
            "Your hidden PNG has been downloaded. Select it again anytime to reveal the message."
        );

    } catch (error) {
        showStatus(
            "HIDE FAILED",
            error.message,
            true
        );
    } finally {
        setBusy(false);
    }
});


// ---------------- REVEAL MESSAGE ----------------

revealBtn.addEventListener("click", () => {
    if (busy) return;

    if (!selectedImage) {
        showStatus(
            "NO IMAGE SELECTED",
            "Please select the PNG containing the hidden message.",
            true
        );
        return;
    }

    setBusy(true);

    try {
        const { imageData } = getImageData();

        const pixels = imageData.data;

        const totalBits =
            imageData.width * imageData.height * 3;

        const bytes = readEmbeddedBytes(
            pixels,
            totalBits
        );

        let recovered = null;

        // 1. CipherVeil format
        recovered = revealCipherVeil(bytes);

        // 2. Current Python Stegano format
        if (recovered === null) {
            recovered = revealPythonStegano(bytes);
        }

        // 3. Older Python Stegano format
        if (recovered === null) {
            recovered = revealOldStegano(bytes);
        }

        if (recovered === null) {
            throw new Error(
                "No hidden message found. Make sure you selected the original PNG downloaded after hiding the message."
            );
        }

        message.value = recovered;

        count.textContent =
            `${recovered.length.toLocaleString()} CHARACTERS`;

        showStatus(
            "MESSAGE REVEALED SUCCESSFULLY",
            "Recovered message: " + recovered
        );

    } catch (error) {
        showStatus(
            "REVEAL FAILED",
            error.message || "Unable to reveal the hidden message.",
            true
        );
    } finally {
        setBusy(false);
    }
});
