FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    cargo \
    ffmpeg \
    libffi-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt

EXPOSE 10000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
