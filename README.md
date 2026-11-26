# CipherVeil - GitHub Pages Version

A static, browser-only image steganography website. No Python, Flask, server, or package installation is required.

## Run locally
Open `index.html` in a browser, or use VS Code Live Server.

## Publish with GitHub Pages
1. Create a public GitHub repository.
2. Upload `index.html`, `style.css`, and `script.js` to the repository root.
3. Open repository Settings -> Pages.
4. Under Build and deployment, choose `Deploy from a branch`.
5. Select branch `main` and folder `/ (root)`, then Save.
6. Wait for the Pages URL to appear in the Pages section.

## How it works
The page embeds UTF-8 text into the least significant bits of RGB pixel channels and stores a small signature and byte-length header. Reveal reads that same format. Processing happens locally in the browser; images are not uploaded to a server.

## Important compatibility note
This static version is self-contained and its Hide/Reveal functions are compatible with each other. It uses an LSB format implemented in JavaScript, not the Python `stegano` package's internal file format. Use this website to hide and reveal messages within this website. It is not guaranteed to reveal images produced by the original Tkinter/Stegano application, or vice versa. Keep the output as PNG; resizing, editing, or JPEG conversion can destroy the hidden data.
