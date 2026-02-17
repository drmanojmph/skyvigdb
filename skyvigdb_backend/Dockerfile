FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY skyvigdb_backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY skyvigdb_backend/ .

ENV PORT=8080
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD exec gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 0 app:app
