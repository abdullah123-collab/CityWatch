"""
CityWatch — Municipal Civic Grievance Management System
Python Application Launcher

Starts the unified FastAPI + Jinja2 web application serving:
  - Citizen Portal:      http://127.0.0.1:8000/
  - Staff Portal:        http://127.0.0.1:8000/staff/
  - Admin Portal:        http://127.0.0.1:8000/admin/
  - Health & Readiness:  http://127.0.0.1:8000/health

Usage:
  python run.py
  (or: uvicorn app.main:app --app-dir python_app --port 8000)
"""
import os
import sys
from pathlib import Path

# Add python_app directory to Python module search path
_root = Path(__file__).resolve().parent
_python_app = _root / "python_app"
if str(_python_app) not in sys.path:
    sys.path.insert(0, str(_python_app))

import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    host = os.environ.get("HOST", settings.host or "127.0.0.1")
    port = int(os.environ.get("PORT", str(settings.port if settings.port != 8080 else 8000)))

    print("=" * 70)
    print("  CityWatch — Municipal Civic Grievance Management System")
    print(f"  Starting on http://{host}:{port}")
    print(f"  Citizen Portal:  http://{host}:{port}/")
    print(f"  Staff Portal:    http://{host}:{port}/staff/")
    print(f"  Admin Portal:    http://{host}:{port}/admin/")
    print("=" * 70)

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=settings.debug,
        app_dir=str(_python_app),
    )
