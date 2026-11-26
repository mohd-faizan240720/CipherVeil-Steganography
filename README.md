# CipherVeil - GitHub Pages

Browser-only PNG steganography project. No backend or server is required.

## Files
- `index.html` - page structure
- `style.css` - visual design
- `script.js` - hide, reveal, and heuristic universal LSB scan

## Deploy
1. Extract this ZIP.
2. Upload all three files to the root of a GitHub repository.
3. In GitHub, open Settings -> Pages.
4. Select Deploy from a branch, choose `main` and `/ (root)`, then Save.

## Universal scan limitations
The Universal LSB Scan is a heuristic scanner for common uncompressed spatial LSB text patterns. It tries common RGB channel orders, bit orders, offsets, and selected bit planes. It is not a true universal decoder and cannot guarantee recovery from arbitrary tools, encrypted/compressed payloads, keyed algorithms, JPEG images, or custom steganography formats. PNG is strongly recommended because JPEG compression can destroy hidden LSB data; JPG files can be scanned, but successful recovery is less likely. A scan result should be verified because false positives are possible.

The regular Hide and Reveal buttons use the CipherVeil CVL1 format. They are not guaranteed to interoperate with every external steganography application.
