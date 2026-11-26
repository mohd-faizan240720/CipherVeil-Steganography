# CipherVeil

**Browser-based image steganography and heuristic LSB scanner.** Built for static hosting such as GitHub Pages. No Python server, database, API key, or backend is required.

## Project files

| File | Purpose |
|---|---|
| `index.html` | Page structure and controls |
| `style.css` | Responsive visual design |
| `script.js` | PNG message embedding, extraction, and heuristic LSB scanning |
| `README.md` | Setup, usage, compatibility, and limitations |

## Features

- Hide UTF-8 text inside PNG images using RGB least-significant-bit (LSB) substitution.
- Download the encoded image as `cipherveil_hidden.png`.
- Reveal messages created by the current CipherVeil CVL2 encoder.
- Scan PNG or JPG pixel data for common LSB text patterns, including RGB channel permutations, individual channels, selected bit planes, bit orders, bit offsets, common length prefixes, null terminators, and plain text streams.
- Runs locally in the browser. Images are not uploaded to a server.

## Run locally

1. Extract the project ZIP.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, or Safari).
3. No installation or build step is needed.

## Deploy to GitHub Pages

1. Create or open a GitHub repository.
2. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the repository root (not inside an extra nested folder).
3. Commit the files to the `main` branch.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
6. Wait for GitHub Pages to publish the site, then open the URL shown on the Pages settings screen.

## How to use

### Hide a message

1. Select a PNG image.
2. Enter your message.
3. Click **Hide & Download**.
4. Keep the downloaded `cipherveil_hidden.png` unchanged.

### Reveal a CipherVeil message

1. Select the original `cipherveil_hidden.png`.
2. Click **Reveal Message**.

### Scan an external image

1. Select a PNG or JPG image.
2. Click **Universal LSB Scan**.
3. If a candidate is found, inspect the text and its reported pattern. The scanner fills the message box with the highest-scoring candidate.

## Compatibility and important limitations

- **Hide is PNG-only.** JPEG is lossy; saving or recompressing it commonly destroys LSB data.
- **Reveal** is guaranteed only for the current CipherVeil CVL2 format. It is not a universal decoder for Python Stegano or every third-party application.
- **Universal LSB Scan is heuristic, not truly universal.** It searches common uncompressed spatial LSB text patterns. It cannot reliably decode arbitrary algorithms, keyed embedding, encrypted or compressed payloads, transform-domain methods (such as DCT), metadata-based hiding, palette tricks, or custom file formats.
- Scanning can produce false positives. A detected string is a candidate, not proof of a hidden message.
- Some patterns may store data beyond the scan window or use a different channel order, bit plane, prefix, delimiter, or encoding and therefore will not be detected.
- Images are processed locally in the browser. The scanner examines the rendered pixel values; browser decoding of JPG cannot restore LSB bits already lost to JPEG compression.

## Privacy

This static website has no upload endpoint. Image processing occurs in the user's browser. If you publish the project through GitHub Pages, the site files are hosted by GitHub, but selected images are not sent to GitHub by this code.

## License

Add a license file if you intend to distribute or reuse this project publicly.
