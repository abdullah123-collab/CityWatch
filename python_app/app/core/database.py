"""
Database adapter for the CityWatch Python web application.

Wraps pyodbc so the rest of the application receives plain Python dicts/lists
and never sees raw cursor objects.  When db_enabled is False, every method
raises RuntimeError immediately so callers cannot silently use mock data.
"""
from __future__ import annotations

import contextlib
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class DatabaseNotEnabled(RuntimeError):
    """Raised when a database call is attempted while DB is disabled."""


def _get_connection():
    """Open a fresh pyodbc connection.  Raises if DB is not configured."""
    if not settings.db_enabled:
        raise DatabaseNotEnabled(
            "SQL Server integration is disabled (db_enabled=false). "
            "Set db_enabled=true only after administrator approval per the migration plan."
        )
    try:
        import pyodbc  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError("pyodbc is not installed. Add it to requirements.txt.") from exc

    conn = pyodbc.connect(settings.db_connection_string, timeout=settings.db_connection_timeout)
    conn.autocommit = False
    return conn


@contextlib.contextmanager
def get_cursor():
    """
    Context manager that yields an open cursor inside a transaction.
    Commits on clean exit; rolls back and re-raises on any exception.
    """
    conn = _get_connection()
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def fetchall(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    """Execute a SELECT and return all rows as plain dicts."""
    with get_cursor() as cur:
        cur.execute(sql, params)
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetchone(sql: str, params: tuple = ()) -> dict[str, Any] | None:
    """Execute a SELECT and return the first row as a dict, or None."""
    with get_cursor() as cur:
        cur.execute(sql, params)
        cols = [desc[0] for desc in cur.description]
        row = cur.fetchone()
        return dict(zip(cols, row)) if row else None


def execute(sql: str, params: tuple = ()) -> None:
    """Execute a non-SELECT statement (INSERT/UPDATE/DELETE)."""
    with get_cursor() as cur:
        cur.execute(sql, params)


def execute_scalar(sql: str, params: tuple = ()) -> Any:
    """Execute a statement and return the value of the first column of the first row."""
    with get_cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return row[0] if row else None


@contextlib.contextmanager
def transaction():
    """
    Context manager for multi-statement transactions.
    Yields a cursor; commits on clean exit, rolls back on exception.
    """
    conn = _get_connection()
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
