from flask import Flask, render_template, request, jsonify, send_file
from stegano import lsb
from PIL import Image
from io import BytesIO
import os
import tempfile

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB upload limit
ALLOWED_EXTENSIONS = {".png"}

def is_png_upload(file):
    return bool(file and file.filename and os.path.splitext(file.filename.lower())[1] in ALLOWED_EXTENSIONS)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/hide", methods=["POST"])
def hide_message():
    image_file = request.files.get("image")
    secret_text = request.form.get("message", "").strip()

    if not image_file:
        return jsonify(success=False, message="Please load an image first."), 400
    if not is_png_upload(image_file):
        return jsonify(success=False, message="Only PNG images are supported."), 400
    if not secret_text:
        return jsonify(success=False, message="Please enter a secret message."), 400

    temp_path = None
    try:
        # Use the actual Stegano library function from the original Tkinter project.
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp:
            image_file.save(temp)
            temp_path = temp.name

        # Validate that the uploaded file is a readable PNG.
        with Image.open(temp_path) as img:
            if img.format != "PNG":
                return jsonify(success=False, message="The selected file is not a valid PNG image."), 400

        secret_img = lsb.hide(temp_path, secret_text)
        output = BytesIO()
        secret_img.save(output, format="PNG")
        output.seek(0)

        return send_file(
            output,
            mimetype="image/png",
            as_attachment=True,
            download_name="cipherveil_hidden.png"
        )
    except Exception as exc:
        return jsonify(success=False, message=f"Unable to hide message: {str(exc)}"), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

@app.route("/reveal", methods=["POST"])
def reveal_message():
    image_file = request.files.get("image")
    if not image_file:
        return jsonify(success=False, message="Please load an image first."), 400
    if not is_png_upload(image_file):
        return jsonify(success=False, message="Only PNG images are supported."), 400

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp:
            image_file.save(temp)
            temp_path = temp.name

        with Image.open(temp_path) as img:
            if img.format != "PNG":
                return jsonify(success=False, message="The selected file is not a valid PNG image."), 400

        # Same extraction function used in the original Python desktop application.
        hidden_text = lsb.reveal(temp_path)
        if hidden_text is None:
            return jsonify(success=False, message="No hidden message found."), 404

        return jsonify(success=True, message="Message revealed successfully!", hidden_text=hidden_text)
    except Exception as exc:
        # Stegano may raise an exception when no valid hidden payload is present.
        return jsonify(success=False, message="No hidden message found. Make sure you selected the PNG created by Hide Message."), 404
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

@app.errorhandler(413)
def too_large(_error):
    return jsonify(success=False, message="Image is too large. Maximum upload size is 20 MB."), 413

if __name__ == "__main__":
    app.run(debug=True)
