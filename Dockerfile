FROM python:3.11-slim

# Install system packages (for yt-dlp or Rust-based tools)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    cargo \
    ffmpeg \
    libffi-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install Python dependencies
RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt

# Expose the port
EXPOSE 10000

# Start the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
