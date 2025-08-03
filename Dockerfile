FROM python:3.11-slim

# Install FFmpeg (required for audio processing)
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# First copy requirements to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Use exec form for CMD
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
