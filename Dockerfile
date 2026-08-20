FROM python:3.11-slim

WORKDIR /app

# Keep image slim: no compiler needed for these pure-Python/wheel deps.
ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# Run as a non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

# gunicorn serves app:app in production (the dev app.run() block in app.py
# only fires under `python app.py`, so it's skipped here).
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "60", "app:app"]
