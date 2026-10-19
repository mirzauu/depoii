# Depoii Data Engine

Decision intelligence and commercial roofing data platform for owners and operators.

## Overview

The repository hosts the **Depoii FastAPI Data Engine** microservice located in [depoii-data-engine/](file:///d:/projects/Roofx/depoii-data-engine).

Key capabilities:
- Municipal permit ingestion and normalisation across municipal portals (Accela, EnerGov, Socrata).
- County Appraisal District (CAD) property matching (DCAD, TAD, PLUTO, etc.).
- NOAA severe weather and hail storm swath tracking.
- Proximity scoring, roof age analysis, and commercial contractor dossier generation.
- Supabase PostgreSQL persistence and REST APIs.

## Getting Started

Navigate to the FastAPI project directory:

```bash
cd depoii-data-engine
```

Create / activate virtual environment:

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the development server:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).
