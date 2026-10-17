#!/usr/bin/env python3
"""
CityWatch Account Management CLI

Secure command-line utility for creating and managing Administrator and Staff accounts.

Usage:
  python scripts/manage_accounts.py create-admin
  python scripts/manage_accounts.py create-staff
  python scripts/manage_accounts.py list

Security:
  - Passwords entered via secure masked prompts (getpass).
  - Passwords are validated for complexity and hashed with bcrypt (cost factor 12).
  - Plaintext passwords are NEVER stored, printed, logged, or saved to Git.
  - Database persistence occurs ONLY when DB_ENABLED=true in .env.
  - When offline, informs the operator of database prerequisites without false claims.
"""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

# Ensure python_app is in the import path
_root = Path(__file__).resolve().parents[1]
_python_app = _root / "python_app"
if str(_python_app) not in sys.path:
    sys.path.insert(0, str(_python_app))

from app.core.config import settings
from app.core.account_manager import (
    create_admin_account_safe,
    create_staff_account_safe,
    list_accounts_safe,
    validate_password_strength,
)


def cmd_create_admin(args: argparse.Namespace) -> None:
    print("\n" + "=" * 60)
    print("  CityWatch — Provision Municipal Administrator Account")
    print("=" * 60)

    if not settings.db_enabled:
        print("\n⚠️  NOTICE: Database connection is disabled (DB_ENABLED=false).")
        print("   Real database accounts can only be saved when SQL Server is configured.")
        print("   Checking input validation only...\n")

    full_name = input("Administrator Full Name: ").strip()
    email = input("Official Email Address: ").strip()
    phone = input("Contact Phone Number: ").strip()
    designation = input("Designation [Chief Administrative Officer]: ").strip() or "Chief Administrative Officer"

    # Secure masked password entry
    password = getpass.getpass("Account Password (min 8 chars): ")
    confirm_pw = getpass.getpass("Confirm Password: ")

    if password != confirm_pw:
        print("\n❌ Error: Passwords do not match.")
        sys.exit(1)

    try:
        validate_password_strength(password)
    except ValueError as exc:
        print(f"\n❌ Password Error: {exc}")
        sys.exit(1)

    try:
        result = create_admin_account_safe(
            full_name=full_name,
            email=email,
            phone=phone,
            designation=designation,
            password=password,
        )
        print("\n✅ Administrator account provisioned successfully in SQL Server!")
        print(f"   Account ID: {result.get('account_id')}")
        print(f"   Staff ID:   {result.get('staff_id')}")
        print(f"   Name:       {result.get('full_name')}")
        print(f"   Email:      {result.get('email')}")
        print(f"   Role:       {result.get('role_name')}")
    except RuntimeError as exc:
        print(f"\nℹ️  {exc}")
    except Exception as exc:
        print(f"\n❌ Error creating administrator: {exc}")
        sys.exit(1)


def cmd_create_staff(args: argparse.Namespace) -> None:
    print("\n" + "=" * 60)
    print("  CityWatch — Provision Municipal Field Staff Account")
    print("=" * 60)

    if not settings.db_enabled:
        print("\n⚠️  NOTICE: Database connection is disabled (DB_ENABLED=false).")
        print("   Real database accounts can only be saved when SQL Server is configured.")

    full_name = input("Staff Member Full Name: ").strip()
    email = input("Official Email Address: ").strip()
    phone = input("Contact Phone Number: ").strip()
    designation = input("Designation [Field Officer]: ").strip() or "Field Officer"

    dept_id_str = input("Assigned Department ID (e.g. 1): ").strip()
    try:
        dept_id = int(dept_id_str)
    except ValueError:
        print("\n❌ Error: Department ID must be an integer.")
        sys.exit(1)

    password = getpass.getpass("Account Password (min 8 chars): ")
    confirm_pw = getpass.getpass("Confirm Password: ")

    if password != confirm_pw:
        print("\n❌ Error: Passwords do not match.")
        sys.exit(1)

    try:
        validate_password_strength(password)
    except ValueError as exc:
        print(f"\n❌ Password Error: {exc}")
        sys.exit(1)

    try:
        result = create_staff_account_safe(
            full_name=full_name,
            email=email,
            phone=phone,
            designation=designation,
            dept_id=dept_id,
            password=password,
        )
        print("\n✅ Staff account provisioned successfully in SQL Server!")
        print(f"   Staff ID:   {result.get('staff_id')}")
        print(f"   Name:       {result.get('full_name')}")
        print(f"   Email:      {result.get('email')}")
        print(f"   Role:       {result.get('role_name')}")
        print(f"   Department: #{result.get('dept_id')}")
    except RuntimeError as exc:
        print(f"\nℹ️  {exc}")
    except Exception as exc:
        print(f"\n❌ Error creating staff account: {exc}")
        sys.exit(1)


def cmd_list(args: argparse.Namespace) -> None:
    print("\n" + "=" * 70)
    print("  CityWatch — Registered Accounts Directory")
    print("=" * 70)

    info = list_accounts_safe()
    print(f"\nData Source: {info['source']}\n")

    accounts = info["accounts"]
    if not accounts:
        print("No accounts found.")
        return

    header = f"{'Role':<10} {'ID':<6} {'Name':<24} {'Email':<26} {'Department'}"
    print(header)
    print("-" * len(header))
    for a in accounts:
        role = a.get("role_name", "Unknown")
        sid = str(a.get("staff_id", "-"))
        name = a.get("full_name", "-")[:23]
        email = a.get("email", "-")[:25]
        dept = a.get("dept_name") or f"Dept #{a.get('dept_id', '-')}"
        print(f"{role:<10} {sid:<6} {name:<24} {email:<26} {dept}")
    print("\n" + "=" * 70 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CityWatch Municipal Account Management CLI",
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    subparsers.add_parser("create-admin", help="Create a municipal administrator account")
    subparsers.add_parser("create-staff", help="Create a field staff account")
    subparsers.add_parser("list", help="List registered accounts (without exposing passwords)")

    args = parser.parse_args()

    if args.command == "create-admin":
        cmd_create_admin(args)
    elif args.command == "create-staff":
        cmd_create_staff(args)
    elif args.command == "list":
        cmd_list(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
