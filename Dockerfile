# Dockerfile for metrics_api.py
# Based on Python 3.11 slim
FROM python:3.11-slim

# Create appdir
WORKDIR /app

# Install system deps for MySQL client and build tools (minimal)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libmysqlclient-dev default-libmysqlclient-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY . /app

# Install Python deps
RUN pip install --no-cache-dir -r requirements.txt

# Make run script executable
RUN chmod +x /app/run_metrics.sh

# Default port expected by hosts (Render provides $PORT)
ENV PORT=8080

EXPOSE 8080

# Run the wrapper which sets API_HOST and API_PORT then starts the app
CMD ["/app/run_metrics.sh"]
