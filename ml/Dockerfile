FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./

# Tell pip where to find the CPU-only torch build
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

# Download model at build time
RUN python -c "\
from transformers import BlipProcessor, BlipForConditionalGeneration; \
BlipProcessor.from_pretrained('Salesforce/blip-image-captioning-base'); \
BlipForConditionalGeneration.from_pretrained('Salesforce/blip-image-captioning-base')"

COPY app.py ./

CMD ["python", "app.py"]