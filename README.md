# 🏙️ CityWatch — Municipal Civic Grievance Management System

> A unified, high-performance, Python-based civic complaint management system engineered with **FastAPI**, **Jinja2**, HTML5, CSS3, and vanilla JavaScript.

CityWatch is an advanced **Database Management System (DBMS)** project designed to empower citizens to report urban issues, track resolution lifecycles, and enable municipal field staff and administrators to manage civic infrastructure efficiently.

---

## 🎯 Architectural Overview

CityWatch runs entirely on **Python** without any dependencies on Node.js, npm, Vite, React, JSX/TSX, or Express. A single Python process serves:

1. **Citizen Portal** (`/`) — Civic landing page, registration, login, resident dashboard, new complaint submission with manual address validation, complaint history with keyword search and filters, complaint details with status history timeline, and 5-star citizen satisfaction feedback.
2. **Field Staff Portal** (`/staff/`) — Municipal officer login with **department selection**, active case workload monitor (enforcing the `0 <= active_cases <= 5` database constraint), assigned complaint review, authorized citizen phone privacy disclosure, and inspector status updates with mandatory remarks.
3. **Administrator Command Center** (`/admin/`) — System-wide grievance analytics, complaint registry, officer assignment modal, staff directory management, citizen registry, department administration, satisfaction reviews, and live audit trail viewer.
4. **Health & Diagnostics** (`/health`, `/api/health`, `/api/departments`) — Honest system status probe and JSON endpoints.

```text
Browser Client
      │
      │ HTTP (Forms, Cookies, Multipart Uploads)
      ▼
┌────────────────────────────────────────────────────────┐
│                   FastAPI / Uvicorn                    │
│                 http://127.0.0.1:8000                  │
├───────────────────┬───────────────────┬────────────────┤
│  Citizen Router   │   Staff Router    │  Admin Router  │
│        (/)        │     (/staff/)     │   (/admin/)    │
├───────────────────┴───────────────────┴────────────────┤
│       Session Security (Signed HttpOnly Cookies)       │
│       Role-Based Access Control & Phone Privacy        │
│     Department Validation for Field Staff Logins       │
├────────────────────────────────────────────────────────┤
│           Jinja2 Server-Rendered Templates             │
│       19 HTML Templates + Municipal CSS Tokens         │
├────────────────────────────────────────────────────────┤
│           Repositories & Account Management            │
│         auth, complaint, admin, account_manager        │
├────────────────────────────────────────────────────────┤
│           Database Layer (pyodbc / Mock)               │
│        Microsoft SQL Server (Safety Gate: Offline)     │
└────────────────────────────────────────────────────────┘
```

---

## ✨ Features & Capabilities

- 🏛️ **Unified Single-Port Delivery** — One server (`http://127.0.0.1:8000`) powers all three portals with zero cross-origin CORS overhead.
- 🏢 **Staff Department Validation** — Staff login requires selecting an assigned municipal department. The server strictly verifies that the officer belongs to the selected department; cross-department logins are blocked.
- 🆔 **Flexible Staff Identifier** — Officers can authenticate using either their numeric Staff ID (e.g. `1`) or official email address (e.g. `ahmed.staff@example.com`).
- 🔐 **Secure Salted Password Hashing** — Passwords are hashed with bcrypt (cost factor 12) using unique per-user salts. Plaintext passwords are never saved, returned, logged, or checked into Git.
- 🔒 **Citizen Privacy Enforcement** — A citizen's contact phone number is strictly guarded: revealed only to the designated officer assigned to that specific complaint or an administrator.
- 📍 **Structured Manual Address Entry** — Area/Locality, City, District, and Postal Code validation without relying on brittle third-party map APIs or fictitious geocoding.
- 📎 **Multipart Evidence Uploads** — Supports JPEG, PNG, WEBP, and PDF attachments (up to 5MB each) with UUID sanitization and secure disk storage in `uploads/`.
- 📊 **Workload & Capacity Management** — Enforces municipal staff workload limits (`active_cases <= 5`) to prevent officer burnout.
- 🛡️ **Database Safety Isolation** — Respects SQL Server identity gates (`db_enabled=False` by default) so development and presentations run safely without risking production database corruption.
- 🧪 **Comprehensive Automated Test Suite** — 63 automated tests covering routes, staff department validation, role protection, session security, privacy rules, input validation, and mock database workflows.

---

## 📁 Directory Structure

```text
CityWatch/
├── python_app/
│   ├── app/
│   │   ├── core/
│   │   │   ├── account_manager.py # Safe CLI & admin account provisioning
│   │   │   ├── config.py          # Pydantic environment configuration
│   │   │   ├── demo_accounts.py   # Development-only offline demo accounts
│   │   │   ├── security.py        # Bcrypt hashing & signed session cookies
│   │   │   └── templates.py       # Starlette-compatible Jinja2 template engine
│   │   ├── db/
│   │   │   ├── connection.py      # pyodbc SQL Server connection & safety gate
│   │   │   └── mock_driver.py     # Offline mock driver for isolated testing
│   │   ├── repositories/
│   │   │   ├── auth_repository.py       # Citizen & staff credential queries
│   │   │   ├── complaint_repository.py  # Complaint lifecycle & ACID queries
│   │   │   └── admin_repository.py      # Admin metrics, staff, & audit logs
│   │   ├── routers/
│   │   │   ├── citizen.py         # Citizen portal routes (/)
│   │   │   ├── staff.py           # Field staff portal routes (/staff/)
│   │   │   └── admin.py           # Administrator routes (/admin/)
│   │   ├── static/
│   │   │   ├── css/               # citizen.css, staff.css, admin.css
│   │   │   └── images/            # Civic imagery & icons
│   │   ├── templates/             # 19 Jinja2 templates (citizen, staff, admin, shared)
│   │   └── main.py                # FastAPI application definition & mounting
│   └── tests/                     # 63 automated pytest test cases
├── Database/                      # Preserved Microsoft SQL Server schema scripts
├── docs/
│   ├── python-migration-plan.md   # Migration checklist & completion audit
│   └── presentation-guide.md      # Presentation walkthrough & viva Q&A
├── scripts/
│   └── manage_accounts.py         # Secure CLI for Admin and Staff provisioning
├── uploads/                       # Uploaded complaint evidence attachments
├── .env                           # Local environment settings
├── .env.example                   # Environment configuration template
├── .gitignore                     # Standard Python gitignore rules
├── pytest.ini                     # Pytest configuration
├── requirements.txt               # Python package dependencies
└── run.py                         # Unified application launcher
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+** (Tested on Python 3.12)
- **pip** (Python package manager)
- *(Optional)* Microsoft SQL Server & ODBC Driver 17 or 18 for SQL Server (when database connection is approved)

> **Note:** Node.js, npm, Vite, and React are **not required**.

### Installation

1. **Clone or open the repository:**
   ```powershell
   cd e:\Work\Project\CityWatch
   ```

2. **Create and activate a Python virtual environment:**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. **Install dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

### Running the Application

Start the unified server with a single command:

```powershell
python run.py
```

Open your browser to:
- **Citizen Portal:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Staff Portal:** [http://127.0.0.1:8000/staff/login](http://127.0.0.1:8000/staff/login)
- **Admin Portal:** [http://127.0.0.1:8000/admin/login](http://127.0.0.1:8000/admin/login)
- **System Health:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## 🔑 Login Workflow & Credentials

### A. Local Development Demo Mode (Offline / Default)

When `DB_ENABLED=false`, CityWatch provides clearly labelled demo accounts loaded strictly through a local development-only configuration. **These accounts are never saved to SQL Server or presented as real database records.**

#### 1. Field Staff Portal (`http://127.0.0.1:8000/staff/login`)

Staff members must select their **Assigned Department** and provide their Staff ID or Email:

| Department in Dropdown | Staff ID | Email | Password | Assigned Officer |
| :--- | :--- | :--- | :--- | :--- |
| **[Demo] Sanitation Department** | `1` | `ahmed.staff@example.com` | `StaffPass123!` | Ahmed Khan |
| **[Demo] Roads & Infrastructure** | `2` | `usman.staff@example.com` | `StaffPass123!` | Usman Tariq |
| **[Demo] Water Supply & Sewerage** | `3` | `hassan.staff@example.com` | `StaffPass123!` | Hassan Raza |
| **[Demo] Electricity & Public Lighting** | `4` | `bilal.staff@example.com` | `StaffPass123!` | Bilal Farooq |

> **Department Validation Rule:** If Ahmed Khan (`staff_id: 1`) selects "Roads & Infrastructure", the login is rejected with `"Invalid credentials or department selection."` Cross-department access is strictly prohibited.

#### 2. Administrator Command Center (`http://127.0.0.1:8000/admin/login`)

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@citywatch.gov` | `AdminPass123!` | Full municipal command oversight |

> **Role Separation:** Staff accounts cannot log into the Admin portal. There is no public registration page for Admin accounts.

#### 3. Citizen Portal (`http://127.0.0.1:8000/login`)

| Role | Email | Password | Registration |
| :--- | :--- | :--- | :--- |
| **Citizen (Demo)** | `ali.ahmed@example.com` | `Citizen123!` | Pre-configured demo citizen |
| **New Citizen** | Self-registered | User-defined | Accessible at `/register` when DB enabled |

---

### B. Real Database Accounts & Provisioning (Production / SQL Server)

When database access is approved and `DB_ENABLED=true`, real accounts are stored in `dbo.Staff` and `dbo.Auth_Account`.

#### Creating the First Administrator Account
To securely provision the initial administrator without exposing credentials in code, shell history, or Git:

```powershell
python scripts/manage_accounts.py create-admin
```
The CLI tool prompts for:
1. Administrator Full Name
2. Official Email Address
3. Contact Phone Number
4. Designation (defaults to *Chief Administrative Officer*)
5. Password (entered securely with **masked input** via `getpass`, minimum 8 characters with complexity verification)

The tool hashes the password using **bcrypt** (cost factor 12) with a unique cryptographic salt and inserts the records into `dbo.Staff` and `dbo.Auth_Account` with `role_name='Admin'`.

#### Creating Staff Accounts
Staff accounts can be created either:
1. **Via CLI:**
   ```powershell
   python scripts/manage_accounts.py create-staff
   ```
2. **Via Administrator Portal:** Log in as an Administrator, navigate to **Staff Management** (`/admin/staff`), and fill out the "Provision New Staff Member" form.

#### Listing Registered Accounts
To view all accounts without exposing passwords or hashes:
```powershell
python scripts/manage_accounts.py list
```

---

## 🧪 Running the Test Suite

Run all 65 automated unit and regression tests with `pytest`:

```powershell
pytest -v
```

Output:
```text
============================= test session starts =============================
collected 65 items

python_app/tests/test_auth_and_session.py .........                      [ 13%]
python_app/tests/test_authenticated_pages.py ........                    [ 26%]
python_app/tests/test_forms_and_validation.py ........                   [ 38%]
python_app/tests/test_mock_driver_workflows.py .....                     [ 46%]
python_app/tests/test_privacy_and_authorization.py ..                    [ 49%]
python_app/tests/test_routes_render.py ..............                    [ 70%]
python_app/tests/test_staff_and_admin_auth.py ...................        [100%]

======================== 65 passed, 1 warning in 4.84s ========================
```

---

## ⚙️ Environment Configuration

Configuration is managed via `.env` (configured for live Microsoft SQL Server connectivity):

```env
# Server
PORT=8000
HOST=127.0.0.1
ENVIRONMENT=development
DEBUG=true

# Session Security
SECRET_KEY=change-this-secret-key-to-a-random-32-char-string-in-production

# Offline Development & Demo Mode (Set false for live DB operations)
DEMO_MODE=false

# Database Settings (Microsoft SQL Server)
DB_ENABLED=true
DB_SERVER=.\SQLEXPRESS
DB_DATABASE=CityWatch
DB_AUTH=windows
DB_ODBC_DRIVER=ODBC Driver 18 for SQL Server
DB_TRUST_SERVER_CERTIFICATE=true
DB_ENCRYPT=true
```

> **Live Database Status:** `DB_ENABLED=true` connects directly to the local Microsoft SQL Server `CityWatch` database instance via Windows Authentication. All panels (Citizen, Staff, Admin) persist and query real database records in `dbo.Citizen`, `dbo.Staff`, `dbo.Department`, `dbo.Complaint`, `dbo.Location`, `dbo.Feedback`, and `dbo.Audit_Log`. If SQL Server is stopped or offline, setting `DB_ENABLED=false` safely falls back to local demo mode.

---

## 📚 Documentation Reference

- **[Python Migration Plan & Checklist](docs/python-migration-plan.md)**: Detailed page-by-page feature parity matrix, audit logs, and phased migration records.
- **[Presentation Guide & Viva Q&A](docs/presentation-guide.md)**: Step-by-step viva demo sequence, architectural justifications, and technical interview questions with model answers.
