from flask import Flask, request, jsonify
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image

app = Flask(__name__)

print("[ml] loading model...")
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
print("[ml] model ready")

def get_caption(image):
    inputs = processor(image, return_tensors="pt")
    output = model.generate(**inputs)
    return processor.decode(output[0], skip_special_tokens=True)

@app.route("/caption", methods=["POST"])
def caption():
    if "image" not in request.files:
        return jsonify({"error": "no image file"}), 400
    image = Image.open(request.files["image"].stream).convert("RGB")
    result = get_caption(image)
    return jsonify({"caption": result})

@app.route("/labels", methods=["POST"])
def labels():
    if "image" not in request.files:
        return jsonify({"error": "no image file"}), 400
    image = Image.open(request.files["image"].stream).convert("RGB")
    # Use BLIP with prompts to extract label-like descriptions
    words = get_caption(image).lower().split()
    # Filter out common stop words to get meaningful labels
    stopwords = {"a","an","the","is","in","on","at","of","and","with","to","it","its","this","that"}
    labels = [w.strip(".,") for w in words if w not in stopwords and len(w) > 2][:5]
    return jsonify({"labels": labels})

@app.route("/safety", methods=["POST"])
def safety():
    if "image" not in request.files:
        return jsonify({"error": "no image file"}), 400
    image = Image.open(request.files["image"].stream).convert("RGB")
    caption = get_caption(image).lower()
    unsafe_keywords = ["gun","weapon","knife","nude","naked","blood","violence","rifle","pistol","nsfw"]
    flagged = any(kw in caption for kw in unsafe_keywords)
    return jsonify({
        "flagged": flagged,
        "details": {
            "adult": "POSSIBLE" if flagged else "UNLIKELY",
            "violence": "POSSIBLE" if flagged else "UNLIKELY",
            "racy": "UNLIKELY"
        }
    })

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)