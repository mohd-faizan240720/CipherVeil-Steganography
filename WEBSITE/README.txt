CIPHERVEIL WEB PROJECT

This website uses the SAME Python Stegano library calls as the original Tkinter project:
- lsb.hide(temp_path, secret_text)
- lsb.reveal(temp_path)

Requirements:
- Python 3.9+
- Flask
- Pillow
- Stegano

Install:
    py -m pip install flask pillow stegano

Run:
    py app.py

Open:
    http://127.0.0.1:5000

How to test:
1. Load a PNG.
2. Enter a secret message and click HIDE MESSAGE.
3. The generated cipherveil_hidden.png downloads and is also kept selected in the page.
4. Click REVEAL MESSAGE. It should recover the text using stegano.lsb.reveal().
5. To test later, refresh or reopen the page, select cipherveil_hidden.png and click REVEAL MESSAGE.

Important:
- This is a local Flask website, not a static HTML-only site. The Python backend is needed because the project relies on the Stegano package.
- Keep the output as PNG. Do not resize, crop, edit, or convert it to JPEG.
- Uploaded images are processed locally by the Flask server running on your computer. Temporary upload files are deleted after each operation.
