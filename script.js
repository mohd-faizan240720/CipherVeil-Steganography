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
  if (scanBtn) scanBtn.disabled = value;
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


// ---------------- UNIVERSAL LSB SCANNER ----------------
// Heuristic scanner for common uncompressed spatial LSB schemes.
// It cannot decode arbitrary/encrypted/compressed/custom steganography.

function printableScore(text) {
  if (!text || text.length < 3) return -1;
  let good = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) good++;
  }
  const ratio = good / text.length;
  return ratio >= 0.88 ? ratio * Math.min(text.length, 500) : -1;
}

function considerCandidate(bytes, candidates) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const add = (arr, label) => {
    if (!arr || !arr.length) return;
    try {
      const text = decoder.decode(arr).replace(/\u0000+$/g, "").trim();
      const score = printableScore(text);
      if (score > 5 && !candidates.some(c => c.text === text)) {
        candidates.push({ text, score, label });
      }
    } catch (_) {}
  };

  // Common terminators: one or three null bytes.
  for (let i = 1; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      add(bytes.slice(0, i), "null-terminated text");
      if (i >= 2 && bytes[i - 1] === 0 && bytes[i - 2] === 0) {
        add(bytes.slice(0, i - 2), "three-null terminator");
      }
      break;
    }
  }

  // Length-prefixed formats: decimal length followed by colon.
  let colon = -1;
  for (let i = 0; i < Math.min(12, bytes.length); i++) {
    if (bytes[i] === 58) { colon = i; break; }
    if (bytes[i] < 48 || bytes[i] > 57) break;
  }
  if (colon > 0) {
    const n = Number(new TextDecoder().decode(bytes.slice(0, colon)));
    if (Number.isSafeInteger(n) && n > 0 && n <= bytes.length - colon - 1) {
      add(bytes.slice(colon + 1, colon + 1 + n), "length-prefixed text");
    }
  }

  // CipherVeil CVL1 header.
  if (bytes.length >= 8 && bytes[0] === 67 && bytes[1] === 86 && bytes[2] === 76 && bytes[3] === 49) {
    const n = ((bytes[4] * 0x1000000) + (bytes[5] << 16) + (bytes[6] << 8) + bytes[7]) >>> 0;
    if (n > 0 && n <= bytes.length - 8) add(bytes.slice(8, 8 + n), "CVL1 payload");
  }

  // Some tools place readable text at the start without a terminator.
  let end = 0;
  while (end < bytes.length && bytes[end] !== 0 && (bytes[end] === 9 || bytes[end] === 10 || bytes[end] === 13 || (bytes[end] >= 32 && bytes[end] <= 126) || bytes[end] >= 194)) end++;
  if (end >= 8) add(bytes.slice(0, end), "plain text stream");
}

function extractForConfig(pixels, width, height, channels, bitPlane, reverseBits, startOffset, maxBytes) {
  const totalPixels = width * height;
  const out = new Uint8Array(maxBytes);
  let bitCount = 0;
  let byteValue = 0;
  let outIndex = 0;
  const channelOffsets = channels;
  const maxBits = Math.min(maxBytes * 8, totalPixels * channelOffsets.length);
  const readBitAt = (seqIndex) => {
    const pixelIndex = Math.floor(seqIndex / channelOffsets.length);
    const channelIndex = channelOffsets[seqIndex % channelOffsets.length];
    const pixelBase = pixelIndex * 4;
    return (pixels[pixelBase + channelIndex] >> bitPlane) & 1;
  };

  for (let seq = startOffset; seq < maxBits + startOffset && outIndex < maxBytes; seq++) {
    const bit = readBitAt(seq);
    if (reverseBits) byteValue |= bit << bitCount;
    else byteValue = (byteValue << 1) | bit;
    bitCount++;
    if (bitCount === 8) {
      out[outIndex++] = byteValue;
      bitCount = 0;
      byteValue = 0;
    }
  }
  return out.slice(0, outIndex);
}

scanBtn.addEventListener("click", () => {
  if (busy) return;
  if (!selectedImage) {
    showStatus("NO IMAGE SELECTED", "Upload a PNG image before running the universal scan.", true);
    return;
  }

  setBusy(true);
  showStatus("SCANNING IMAGE", "Checking common RGB LSB patterns. This may take a few seconds.");

  // Yield once so the scanning status can render before the work begins.
  setTimeout(() => {
    try {
      const { imageData } = getImageData();
      const { data: pixels, width, height } = imageData;
      const candidates = [];
      const permutations = [
        [0, 1, 2], [0, 2, 1], [1, 0, 2],
        [1, 2, 0], [2, 0, 1], [2, 1, 0]
      ];
      const channelSets = [...permutations, [0], [1], [2]];
      // Limit each pattern to the first 64 KB of extracted bytes for browser responsiveness.
      const maxBytes = 65536;
      const planes = [0, 1, 7];

      outer: for (const channels of channelSets) {
        for (const plane of planes) {
          for (const reverse of [false, true]) {
            for (const offset of [0, 1, 2, 3, 4, 5, 6, 7]) {
              const bytes = extractForConfig(
                pixels, width, height, channels, plane, reverse, offset, maxBytes
              );
              considerCandidate(bytes, candidates);
              if (candidates.some(c => c.score > 350)) break outer;
            }
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length) {
        const best = candidates[0];
        message.value = best.text;
        count.textContent = `${best.text.length.toLocaleString()} CHARACTERS`;
        showStatus(
          "POSSIBLE HIDDEN MESSAGE FOUND",
          `${best.text.slice(0, 700)}${best.text.length > 700 ? "…" : ""} [Detected using ${best.label}. Verify the result; heuristic scans can produce false positives.]`
        );
      } else {
        showStatus(
          "NO READABLE MESSAGE DETECTED",
          "No text was found in the common LSB patterns scanned. The image may use another channel, bit plane, key, compression, encryption, or a non-LSB method.",
          true
        );
      }
    } catch (error) {
      showStatus("SCAN FAILED", error.message || "Could not scan this image.", true);
    } finally {
      setBusy(false);
    }
  }, 50);
});
