FROM python:3.11-slim

# 1. Install dependencies with clean up
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# 2. Create and use non-root user
RUN useradd -m appuser && \
    mkdir -p /app/static && \
    chown appuser:appuser /app
WORKDIR /app
USER appuser

# 3. Copy requirements first for better caching
COPY --chown=appuser:appuser requirements.txt .

# 4. Install dependencies with virtualenv
RUN python -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of the application
COPY --chown=appuser:appuser . .

# 6. Use the virtualenv and PORT variable
ENV PATH="/app/venv/bin:$PATH"
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
