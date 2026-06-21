from flask import Flask, request, jsonify
import os
import base64
import requests

app = Flask(__name__)

GOOGLE_VISION_API_KEY = os.environ.get("GOOGLE_VISION_API_KEY")

print("[ml] system initialized using Google Vision API...")

def annotate(image_bytes):
    base64_image = base64.b64encode(image_bytes).decode('utf-8')

    # FIX 1: Correct Vision API URL with proper path and key as query param
    url = f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_VISION_API_KEY}"

    payload = {
        "requests": [{
            "image": {"content": base64_image},
            "features": [
                {"type": "LABEL_DETECTION", "maxResults": 8},
                {"type": "SAFE_SEARCH_DETECTION"}
            ]
        }]
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()  # surface HTTP errors clearly
        data = response.json()
        return data.get("responses", [{}])[0]
    except Exception as e:
        print(f"[ERROR] Google Vision request failed: {e}")
        return {}


# FIX 2: All routes now accept JSON body { "path": "..." } matching what worker sends
def read_image_from_request():
    """Read image bytes from either JSON path or multipart file."""
    if request.is_json:
        path = request.get_json().get("path")
        if not path or not os.path.exists(path):
            return None, f"file not found: {path}"
        with open(path, "rb") as f:
            return f.read(), None
    elif "image" in request.files:
        return request.files["image"].read(), None
    return None, "no image provided"


@app.route("/caption", methods=["POST"])
def caption():
    image_bytes, err = read_image_from_request()
    if err:
        return jsonify({"error": err}), 400

    response_data = annotate(image_bytes)
    annotations = response_data.get("labelAnnotations", [])

    labels = [l.get("description", "").lower() for l in annotations[:3]]
    caption_str = "an image of " + ", ".join(labels) if labels else "unknown image"
    return jsonify({"caption": caption_str})


@app.route("/labels", methods=["POST"])
def labels():
    image_bytes, err = read_image_from_request()
    if err:
        return jsonify({"error": err}), 400

    response_data = annotate(image_bytes)
    annotations = response_data.get("labelAnnotations", [])

    labels_list = [
        {"name": l.get("description", "").lower(), "confidence": round(l.get("score", 0), 2)}
        for l in annotations
    ]
    return jsonify({"labels": labels_list})


@app.route("/safety", methods=["POST"])
def safety():
    image_bytes, err = read_image_from_request()
    if err:
        return jsonify({"error": err}), 400

    response_data = annotate(image_bytes)
    safe = response_data.get("safeSearchAnnotation", {})

    LIKELIHOOD = {"UNKNOWN", "VERY_UNLIKELY", "UNLIKELY", "POSSIBLE", "LIKELY", "VERY_LIKELY"}
    details = {
        "adult":    safe.get("adult", "UNKNOWN"),
        "violence": safe.get("violence", "UNKNOWN"),
        "racy":     safe.get("racy", "UNKNOWN"),
    }

    unsafe_flags = {"POSSIBLE", "LIKELY", "VERY_LIKELY"}
    flagged = any(v in unsafe_flags for v in details.values())

    return jsonify({"flagged": flagged, "details": details})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)