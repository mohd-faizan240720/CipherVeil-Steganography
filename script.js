/*
 * CipherVeil | Browser-only image steganography
 * Hide/Reveal: CipherVeil CVL2 format (RGB LSB, MSB-first, UTF-8, length header).
 * Universal Scan: heuristic search for common uncompressed spatial LSB text formats.
 * No browser-only scanner can decode every steganography algorithm.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    input: $("imageInput"), dropzone: $("dropzone"), preview: $("preview"),
    previewImg: $("previewImg"), fileStatus: $("fileStatus"), fileName: $("fileName"),
    message: $("message"), count: $("count"), hide: $("hideBtn"),
    reveal: $("revealBtn"), scan: $("scanBtn"), download: $("downloadLink"),
    change: $("changeFile"), resultTitle: $("resultTitle"),
    resultText: $("resultText"), resultMark: $("resultMark")
  };

  const MAGIC = new Uint8Array([67, 86, 76, 50]); // CVL2
  const HEADER_BYTES = 8;
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  const SCAN_BYTES = 8192;
  const encoder = new TextEncoder();
  let selectedImage = null;
  let selectedFile = null;
  let objectUrl = null;
  let busy = false;

  function status(title, text, error = false) {
    el.resultTitle.textContent = title;
    el.resultText.textContent = text;
    el.resultMark.textContent = error ? "!" : "✦";
    el.resultMark.style.color = error ? "#ff758b" : "var(--cyan)";
  }

  function setBusy(value, action = "") {
    busy = value;
    [el.hide, el.reveal, el.scan, el.change].forEach((b) => { if (b) b.disabled = value; });
    el.hide.innerHTML = value && action === "hide" ? "PROCESSING..." : "<span>↳</span> HIDE &amp; DOWNLOAD";
    el.reveal.innerHTML = value && action === "reveal" ? "PLEASE WAIT..." : "<span>⌕</span> REVEAL MESSAGE";
    el.scan.textContent = value && action === "scan" ? "SCANNING IMAGE..." : "⌕  UNIVERSAL LSB SCAN";
  }

  function loadImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      status("INVALID FILE", "Choose a PNG or JPG image.", true); return;
    }
    if (file.size > MAX_FILE_BYTES) {
      status("FILE TOO LARGE", "Maximum supported file size is 25 MB.", true); return;
    }
    const nextUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = nextUrl;
      selectedImage = img;
      selectedFile = file;
      el.previewImg.src = objectUrl;
      el.fileName.textContent = file.name;
      el.fileStatus.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
      el.fileStatus.style.color = "var(--cyan)";
      el.dropzone.classList.add("hidden");
      el.preview.classList.remove("hidden");
      el.download.classList.add("hidden");
      status("IMAGE LOADED", `${file.name} is ready. Hide works with PNG; Universal Scan can inspect PNG or JPG.`);
    };
    img.onerror = () => {
      URL.revokeObjectURL(nextUrl);
      status("IMAGE ERROR", "The selected image could not be decoded by this browser.", true);
    };
    img.src = nextUrl;
  }

  function canvasSnapshot() {
    if (!selectedImage) throw new Error("Upload an image first.");
    const canvas = document.createElement("canvas");
    canvas.width = selectedImage.naturalWidth;
    canvas.height = selectedImage.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    ctx.drawImage(selectedImage, 0, 0);
    return { canvas, ctx, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) };
  }

  // CipherVeil payload: CVL2 + 32-bit big-endian byte length + UTF-8 bytes.
  function makePayload(text) {
    const body = encoder.encode(text);
    const payload = new Uint8Array(HEADER_BYTES + body.length);
    payload.set(MAGIC, 0);
    new DataView(payload.buffer).setUint32(4, body.length, false);
    payload.set(body, HEADER_BYTES);
    return payload;
  }

  function channelOffset(bitIndex) {
    const pixel = Math.floor(bitIndex / 3);
    const channel = bitIndex % 3;
    return pixel * 4 + channel;
  }

  function embedPayload(rgba, payload) {
    let bitIndex = 0;
    for (const byte of payload) {
      for (let bit = 7; bit >= 0; bit--) {
        const offset = channelOffset(bitIndex++);
        rgba[offset] = (rgba[offset] & 0xfe) | ((byte >> bit) & 1);
      }
    }
  }

  function readBytes(rgba, byteCount) {
    const result = new Uint8Array(byteCount);
    let bitIndex = 0;
    for (let i = 0; i < byteCount; i++) {
      let value = 0;
      for (let b = 0; b < 8; b++) {
        value = (value << 1) | (rgba[channelOffset(bitIndex++)] & 1);
      }
      result[i] = value;
    }
    return result;
  }

  function decodeOwnFormat(rgba, pixelCount) {
    const capacity = Math.floor(pixelCount * 3 / 8);
    if (capacity < HEADER_BYTES) return null;
    const header = readBytes(rgba, HEADER_BYTES);
    if (!MAGIC.every((v, i) => header[i] === v)) return null;
    const length = new DataView(header.buffer).getUint32(4, false);
    if (!length || length > capacity - HEADER_BYTES) throw new Error("The hidden payload is incomplete or damaged.");
    const bytes = readBytes(rgba, HEADER_BYTES + length).slice(HEADER_BYTES);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    el.download.href = url;
    el.download.download = filename;
    el.download.classList.remove("hidden");
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = url;
    const img = new Image();
    img.onload = () => {
      selectedImage = img;
      selectedFile = new File([blob], filename, { type: "image/png" });
      el.previewImg.src = url;
      el.fileName.textContent = filename;
      el.fileStatus.textContent = `${img.naturalWidth} × ${img.naturalHeight} · ENCODED PNG`;
      el.dropzone.classList.add("hidden");
      el.preview.classList.remove("hidden");
    };
    img.src = url;
  }

  async function hideMessage() {
    if (busy) return;
    if (!selectedImage) return status("NO IMAGE", "Select an image first.", true);
    if (!selectedFile || selectedFile.type !== "image/png") {
      return status("PNG REQUIRED FOR HIDING", "Choose a PNG image. JPG compression can destroy hidden LSB data.", true);
    }
    if (!el.message.value.length) return status("MESSAGE REQUIRED", "Enter a message to hide.", true);
    setBusy(true, "hide");
    try {
      const { canvas, ctx, imageData } = canvasSnapshot();
      const payload = makePayload(el.message.value);
      const capacity = Math.floor(imageData.width * imageData.height * 3 / 8);
      if (payload.length > capacity) throw new Error(`Message is too large for this image. Approximate maximum: ${Math.max(0, capacity - HEADER_BYTES)} bytes.`);
      embedPayload(imageData.data, payload);
      ctx.putImageData(imageData, 0, 0);
      const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("PNG export failed.")), "image/png"));
      downloadBlob(blob, "cipherveil_hidden.png");
      status("MESSAGE HIDDEN", "Downloaded cipherveil_hidden.png. It is selected and ready to reveal.");
    } catch (err) { status("HIDE FAILED", err.message, true); }
    finally { setBusy(false); }
  }

  function revealMessage() {
    if (busy) return;
    if (!selectedImage) return status("NO IMAGE", "Select the image containing the hidden message.", true);
    setBusy(true, "reveal");
    try {
      const { imageData } = canvasSnapshot();
      const text = decodeOwnFormat(imageData.data, imageData.width * imageData.height);
      if (text === null) throw new Error("No CipherVeil message found. For external formats, use Universal LSB Scan.");
      el.message.value = text;
      updateCounter();
      status("MESSAGE REVEALED", `Recovered ${encoder.encode(text).length} bytes successfully.`);
    } catch (err) { status("REVEAL FAILED", err.message, true); }
    finally { setBusy(false); }
  }

  function updateCounter() { el.count.textContent = `${el.message.value.length.toLocaleString()} CHARACTERS`; }

  // Universal scan helpers. Candidate text is heuristic and must be verified by the user.
  function textScore(text) {
    if (!text || text.length < 4) return -1;
    let printable = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === 9 || cp === 10 || cp === 13 || (cp >= 32 && cp !== 127 && !(cp >= 0x80 && cp <= 0x9f))) printable++;
    }
    const ratio = printable / text.length;
    return ratio >= 0.9 ? ratio * Math.min(text.length, 1000) : -1;
  }

  function addCandidate(raw, label, results) {
    if (!raw || raw.length < 4) return;
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(raw).replace(/\u0000+$/g, "").trim();
      const score = textScore(text);
      if (score > 5 && !results.some((r) => r.text === text)) results.push({ text, score, label });
    } catch (_) { /* Not valid UTF-8 text. */ }
  }

  function inspectStream(bytes, label, results) {
    // CipherVeil signature + length header.
    if (bytes.length >= 8 && bytes[0] === 67 && bytes[1] === 86 && bytes[2] === 76 && (bytes[3] === 49 || bytes[3] === 50)) {
      const n = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, false);
      if (n > 0 && n <= bytes.length - 8) addCandidate(bytes.slice(8, 8 + n), `${label}: CVL payload`, results);
    }
    // Decimal length prefix followed by colon.
    let colon = -1;
    for (let i = 0; i < Math.min(12, bytes.length); i++) {
      if (bytes[i] === 58) { colon = i; break; }
      if (bytes[i] < 48 || bytes[i] > 57) break;
    }
    if (colon > 0) {
      const n = Number(new TextDecoder().decode(bytes.slice(0, colon)));
      if (Number.isSafeInteger(n) && n > 0 && n <= bytes.length - colon - 1) addCandidate(bytes.slice(colon + 1, colon + 1 + n), `${label}: length-prefixed`, results);
    }
    // Null-terminated streams (single or triple null).
    const zero = bytes.indexOf(0);
    if (zero >= 4) addCandidate(bytes.slice(0, zero), `${label}: null-terminated`, results);
    // Plain printable stream, useful for simple LSB text tools.
    let end = 0;
    while (end < bytes.length && bytes[end] !== 0) end++;
    if (end >= 8) addCandidate(bytes.slice(0, end), `${label}: plain text`, results);
  }

  function extractBits(rgba, pixelCount, channelOrder, plane, reverse, offset, maxBytes) {
    const out = new Uint8Array(maxBytes);
    const channelsPerPixel = channelOrder.length;
    const maxSequenceBits = pixelCount * channelsPerPixel;
    const totalBits = Math.min(maxBytes * 8, Math.max(0, maxSequenceBits - offset));
    let byte = 0, bitCount = 0, outAt = 0;
    for (let seq = offset; seq < offset + totalBits; seq++) {
      const pixel = Math.floor(seq / channelsPerPixel);
      const channel = channelOrder[seq % channelsPerPixel];
      const bit = (rgba[pixel * 4 + channel] >> plane) & 1;
      if (reverse) byte |= bit << bitCount;
      else byte = (byte << 1) | bit;
      if (++bitCount === 8) { out[outAt++] = byte; bitCount = 0; byte = 0; }
    }
    return out.slice(0, outAt);
  }

  async function universalScan() {
    if (busy) return;
    if (!selectedImage) return status("NO IMAGE", "Upload a PNG or JPG before scanning.", true);
    setBusy(true, "scan");
    status("SCANNING IMAGE", "Checking common LSB channel patterns. Large images may take a few seconds.");
    // Let the browser paint the status before CPU work.
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const { imageData } = canvasSnapshot();
      const { data: rgba, width, height } = imageData;
      const pixels = width * height;
      const results = [];
      const orders = [
        [0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0],
        [0], [1], [2], [3], [0,1], [0,2], [1,2], [3,0,1,2]
      ];
      const planes = [0, 1, 2, 7];
      const maxBytes = SCAN_BYTES;
      let tested = 0;
      for (const order of orders) {
        for (const plane of planes) {
          for (const reverse of [false, true]) {
            for (let offset = 0; offset < 8; offset++) {
              const stream = extractBits(rgba, pixels, order, plane, reverse, offset, maxBytes);
              inspectStream(stream, `channels ${order.join("")}, bit ${plane}, ${reverse ? "LSB-first" : "MSB-first"}, offset ${offset}`, results);
              tested++;
              if (results.some((r) => r.score > 800)) break;
            }
            if (results.some((r) => r.score > 800)) break;
          }
          if (results.some((r) => r.score > 800)) break;
        }
        if (results.some((r) => r.score > 800)) break;
      }
      results.sort((a, b) => b.score - a.score);
      if (!results.length) {
        status("NO READABLE TEXT DETECTED", `Scanned ${tested} common patterns. The image may use encryption, compression, a key, a different algorithm, or no hidden text.`, true);
        return;
      }
      const best = results[0];
      el.message.value = best.text;
      updateCounter();
      status("POSSIBLE MESSAGE FOUND", `${best.text.slice(0, 650)}${best.text.length > 650 ? "…" : ""} | Pattern: ${best.label}. Verify the result; false positives are possible.`);
    } catch (err) { status("SCAN FAILED", err.message || "The image could not be scanned.", true); }
    finally { setBusy(false); }
  }

  // UI wiring
  el.message.addEventListener("input", updateCounter);
  el.change.addEventListener("click", () => el.input.click());
  el.input.addEventListener("change", (event) => { const file = event.target.files && event.target.files[0]; if (file) loadImage(file); event.target.value = ""; });
  ["dragenter", "dragover"].forEach((name) => el.dropzone.addEventListener(name, (event) => { event.preventDefault(); el.dropzone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((name) => el.dropzone.addEventListener(name, (event) => { event.preventDefault(); el.dropzone.classList.remove("dragover"); }));
  el.dropzone.addEventListener("drop", (event) => { const file = event.dataTransfer.files && event.dataTransfer.files[0]; if (file) loadImage(file); });
  el.hide.addEventListener("click", hideMessage);
  el.reveal.addEventListener("click", revealMessage);
  el.scan.addEventListener("click", universalScan);
})();
