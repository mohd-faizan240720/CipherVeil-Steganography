/* CipherVeil - GitHub Pages Steganography
   Uses the same default LSB byte format as Python Stegano:
   ASCII byte-length + ':' + UTF-8 message bytes, one bit per RGB channel.
*/

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const imageInput = $("imageInput");
  const dropzone = $("dropzone");
  const preview = $("preview");
  const previewImg = $("previewImg");
  const fileStatus = $("fileStatus");
  const fileName = $("fileName");
  const message = $("message");
  const count = $("count");
  const hideBtn = $("hideBtn");
  const revealBtn = $("revealBtn");
  const downloadLink = $("downloadLink");

  let selectedImage = null;
  let selectedFileName = "image.png";
  let activeObjectUrl = null;
  let busy = false;

  const encoder = new TextEncoder();

  function status(title, text, error = false) {
    $("resultTitle").textContent = title;
    $("resultText").textContent = text;
    const mark = $("resultMark");
    mark.textContent = error ? "!" : "✦";
    mark.style.color = error ? "#ff758b" : "var(--cyan)";
  }

  function setBusy(value) {
    busy = value;
    hideBtn.disabled = value;
    revealBtn.disabled = value;
    hideBtn.innerHTML = value ? "PROCESSING..." : "<span>↳</span> HIDE &amp; DOWNLOAD";
    revealBtn.innerHTML = value ? "PLEASE WAIT..." : "<span>⌕</span> REVEAL MESSAGE";
  }

  message.addEventListener("input", () => {
    count.textContent = `${message.value.length.toLocaleString()} CHARACTERS`;
  });

  $("changeFile").addEventListener("click", () => imageInput.click());

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) loadImage(file);
    event.target.value = "";
  });

  ["dragenter", "dragover"].forEach((name) => {
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((name) => {
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) loadImage(file);
  });

  function loadImage(file) {
    if (!file.type.startsWith("image/") && !/\.png$/i.test(file.name)) {
      status("PNG REQUIRED", "Please select a PNG image.", true);
      return;
    }
    if (!/\.png$/i.test(file.name) && file.type !== "image/png") {
      status("PNG REQUIRED", "Only PNG images are supported to preserve hidden data.", true);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      status("FILE TOO LARGE", "Maximum image size is 25 MB.", true);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = url;
      selectedImage = img;
      selectedFileName = file.name;
      previewImg.src = url;
      fileName.textContent = file.name;
      fileStatus.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
      fileStatus.style.color = "var(--cyan)";
      dropzone.classList.add("hidden");
      preview.classList.remove("hidden");
      downloadLink.classList.add("hidden");
      status("IMAGE LOADED", "PNG loaded. Enter a message to hide or reveal a message.");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      status("IMAGE ERROR", "The selected image could not be opened.", true);
    };
    img.src = url;
  }

  function getCanvasData() {
    if (!selectedImage) throw new Error("Please select a PNG image first.");
    const canvas = document.createElement("canvas");
    canvas.width = selectedImage.naturalWidth;
    canvas.height = selectedImage.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(selectedImage, 0, 0);
    return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height) };
  }

  // Bit order matches Stegano: R, G, B for each pixel, most-significant bit first.
  function channelOffset(bitIndex) {
    const pixel = Math.floor(bitIndex / 3);
    const channel = bitIndex % 3;
    return pixel * 4 + channel;
  }

  function writeBytesToPixels(pixelData, bytes) {
    let bitIndex = 0;
    for (let i = 0; i < bytes.length; i++) {
      for (let bit = 7; bit >= 0; bit--) {
        const offset = channelOffset(bitIndex++);
        pixelData[offset] = (pixelData[offset] & 0xFE) | ((bytes[i] >> bit) & 1);
      }
    }
  }

  function readBytesFromPixels(pixelData, byteCount) {
    const result = new Uint8Array(byteCount);
    let bitIndex = 0;
    for (let i = 0; i < byteCount; i++) {
      let value = 0;
      for (let bit = 0; bit < 8; bit++) {
        value = (value << 1) | (pixelData[channelOffset(bitIndex++)] & 1);
      }
      result[i] = value;
    }
    return result;
  }

  function makeSteganoPayload(text) {
    const messageBytes = encoder.encode(text);
    const prefix = encoder.encode(`${messageBytes.length}:`);
    const payload = new Uint8Array(prefix.length + messageBytes.length);
    payload.set(prefix, 0);
    payload.set(messageBytes, prefix.length);
    return payload;
  }

  function decodeSteganoPayload(pixelData) {
    const totalChannels = (pixelData.length / 4) * 3;
    const maxBytes = Math.floor(totalChannels / 8);
    const prefixBytes = [];
    let prefixLength = -1;

    // Read only the decimal byte-count prefix, ending at ':'.
    for (let i = 0; i < Math.min(12, maxBytes); i++) {
      const byte = readBytesFromPixels(pixelData, i + 1)[i];
      if (byte === 58) {
        prefixLength = i + 1;
        break;
      }
      if (byte < 48 || byte > 57) return null;
      prefixBytes.push(byte);
    }

    if (prefixLength < 2) return null;
    const lengthText = String.fromCharCode(...prefixBytes);
    const messageLength = Number(lengthText);
    if (!Number.isSafeInteger(messageLength) || messageLength < 1) return null;

    const totalPayloadBytes = prefixLength + messageLength;
    if (totalPayloadBytes > maxBytes) {
      throw new Error("The hidden message is incomplete or the PNG was modified.");
    }

    const payload = readBytesFromPixels(pixelData, totalPayloadBytes);
    const colon = payload[prefixLength - 1];
    if (colon !== 58) return null;

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        payload.slice(prefixLength, totalPayloadBytes)
      );
    } catch {
      return null;
    }
  }

  function decodeCipherVeilLegacy(pixelData) {
    const header = readBytesFromPixels(pixelData, 8);
    if (header[0] !== 67 || header[1] !== 86 || header[2] !== 76 || header[3] !== 49) return null;
    const length = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(4, false);
    const maxBytes = Math.floor(((pixelData.length / 4) * 3) / 8);
    if (!length || length > maxBytes - 8) throw new Error("The old CipherVeil message is incomplete.");
    const bytes = readBytesFromPixels(pixelData, 8 + length).slice(8);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  async function downloadEncodedImage(blob, filename) {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("The generated PNG could not be loaded."));
      img.src = url;
    });

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = url;
    selectedImage = img;
    selectedFileName = filename;
    previewImg.src = url;
    fileName.textContent = filename;
    fileStatus.textContent = `${img.naturalWidth} × ${img.naturalHeight} · ENCODED`;
    dropzone.classList.add("hidden");
    preview.classList.remove("hidden");
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.classList.remove("hidden");
  }

  hideBtn.addEventListener("click", async () => {
    if (busy) return;
    if (!selectedImage) return status("NO IMAGE", "Please select a PNG first.", true);
    if (!message.value.length) return status("MESSAGE REQUIRED", "Enter your secret message.", true);

    setBusy(true);
    try {
      const { canvas, ctx, data } = getCanvasData();
      const payload = makeSteganoPayload(message.value);
      const capacityBytes = Math.floor((data.width * data.height * 3) / 8);
      if (payload.length > capacityBytes) {
        throw new Error(`Message is too large. Maximum available payload is about ${capacityBytes - 4} bytes.`);
      }

      writeBytesToPixels(data.data, payload);
      ctx.putImageData(data, 0, 0);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNG export failed.")), "image/png");
      });

      await downloadEncodedImage(blob, "cipherveil_hidden.png");
      status("MESSAGE HIDDEN SUCCESSFULLY", "Downloaded cipherveil_hidden.png. It is selected and ready to reveal.");
    } catch (error) {
      status("HIDE FAILED", error.message || "Could not hide the message.", true);
    } finally {
      setBusy(false);
    }
  });

  revealBtn.addEventListener("click", () => {
    if (busy) return;
    if (!selectedImage) return status("NO IMAGE", "Select the PNG containing the hidden message.", true);

    setBusy(true);
    try {
      const { data } = getCanvasData();
      let recovered = decodeSteganoPayload(data.data);
      if (recovered === null) recovered = decodeCipherVeilLegacy(data.data);
      if (recovered === null) {
        throw new Error("No supported hidden message found. Hide a new message with this website, then reveal the downloaded PNG.");
      }

      message.value = recovered;
      count.textContent = `${recovered.length.toLocaleString()} CHARACTERS`;
      status("MESSAGE REVEALED SUCCESSFULLY", `Recovered message: ${recovered}`);
    } catch (error) {
      status("REVEAL FAILED", error.message || "Could not reveal the message.", true);
    } finally {
      setBusy(false);
    }
  });
})();
