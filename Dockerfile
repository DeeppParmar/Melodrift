# Use an official Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies (for yt-dlp via git)
RUN apt-get update && apt-get install -y git

# Copy requirements first to leverage Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project files
COPY . .

# Start the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

