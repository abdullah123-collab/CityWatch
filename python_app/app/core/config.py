"""
Configuration settings for the CityWatch Python web application.

All settings are read from environment variables or a .env file.
Credentials are never stored in source code.
"""
from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    CityWatch application settings.

    Variables can be set in python_app/.env (or the project root .env).
    All variable names are case-insensitive.
    """

    # ── Application ────────────────────────────────────────────────────────────
    app_name: str = "CityWatch"
    environment: str = "development"
    host: str = "127.0.0.1"
    port: int = 8080
    debug: bool = False
    demo_mode: bool = True            # Enables local demo accounts when db_enabled is False

    # ── Session ────────────────────────────────────────────────────────────────
    # Must be set in production; a dev fallback is provided for offline testing.
    secret_key: str = "dev-secret-key-change-in-production-do-not-use-as-is"
    session_cookie_name: str = "citywatch_session"
    session_max_age_seconds: int = 8 * 60 * 60  # 8 hours

    # ── Database ───────────────────────────────────────────────────────────────
    # SQL Server integration is disabled by default.  Set the flag only after
    # the six administrator confirmations documented in the migration plan.
    db_enabled: bool = False
    db_server: str = ""
    db_database: str = ""
    db_port: int = 1433
    db_auth: str = "windows"          # "windows" or "sql"
    db_user: str = ""
    db_password: str = ""
    db_odbc_driver: str = "ODBC Driver 18 for SQL Server"
    db_trust_server_certificate: bool = True
    db_encrypt: bool = True
    db_connection_timeout: int = 15
    db_request_timeout: int = 30

    # ── File Uploads ───────────────────────────────────────────────────────────
    upload_dir: str = ""              # defaults to project root uploads/ if empty
    max_upload_size_bytes: int = 5 * 1024 * 1024  # 5 MB

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def upload_path(self) -> Path:
        if self.upload_dir:
            return Path(self.upload_dir)
        # Default: project root uploads/ directory (same location Express uses)
        return Path(__file__).resolve().parents[3] / "uploads"

    @property
    def db_connection_string(self) -> str:
        """Build pyodbc connection string. Only called when db_enabled is True."""
        parts = [
            f"DRIVER={{{self.db_odbc_driver}}}",
            f"SERVER={self.db_server},{self.db_port}" if self.db_port != 1433
                else f"SERVER={self.db_server}",
            f"DATABASE={self.db_database}",
            f"TrustServerCertificate={'yes' if self.db_trust_server_certificate else 'no'}",
            f"Encrypt={'yes' if self.db_encrypt else 'no'}",
        ]
        if self.db_auth == "sql":
            parts += [f"UID={self.db_user}", f"PWD={self.db_password}"]
        else:
            parts.append("Trusted_Connection=yes")
        return ";".join(parts)


# Singleton – import this object everywhere
settings = Settings()
