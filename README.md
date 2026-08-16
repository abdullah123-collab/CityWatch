# 🏙️ CityWatch — Citizen Complaint Management System

> A web-based civic complaint management system designed to help citizens report urban issues and track the status of their complaints.

CityWatch is a university **Database Management System (DBMS)** project that demonstrates how a civic complaint workflow can be designed using a simple web interface, structured complaint data, validation, and an SQL database schema.

---

## 🎯 Project Overview

Citizens need a simple way to report common civic issues such as:

- 🛣️ Road and infrastructure problems
- 💡 Street light issues
- 🗑️ Waste and sanitation problems
- 💧 Water-related issues
- 🚦 Traffic and public-area problems

CityWatch provides a simple interface where users can submit complaints, view their complaint history, and monitor complaint status.

The current frontend uses **localStorage** for demonstration purposes, while an SQL database schema is also included for future backend integration.

---

## ✨ Features

- 📝 **Complaint Reporting** — Submit new civic complaints with category and description
- 📋 **Complaint History** — View previously submitted complaints
- 📊 **Dashboard** — View complaint statistics and recent complaints
- 🔐 **Login Interface** — Basic login workflow
- ✅ **Form Validation** — Client-side validation for complaint forms
- 💾 **Local Storage** — Store demonstration data using browser `localStorage`
- 🗄️ **SQL Schema** — Database schema included for future backend integration

---

## 🔄 Complaint Workflow

```text
Citizen
   │
   ▼
Login
   │
   ▼
Dashboard
   │
   ▼
Submit Complaint
   │
   ▼
Form Validation
   │
   ▼
Store Complaint
   │
   ▼
Complaint History
   │
   ▼
Track Status
````

---

## 📁 Project Structure

```text
CityWatch/
│
├── index.html
├── login.html
├── dashboard.html
├── newComplaint.html
├── history.html
│
├── css/
│   └── style.css
│
├── js/
│   └── script.js
│
├── images/
│   └── ...
│
└── database/
    └── citywatch.sql
```

---

## 🖥️ Main Pages

### 🏠 Home Page

The main entry point of the CityWatch application.

### 🔐 Login

Provides a basic login interface for the citizen workflow.

### 📊 Dashboard

Displays:

* Complaint statistics
* Recent complaints
* Quick access to major actions

### 📝 New Complaint

Allows citizens to submit a new complaint by selecting a category and providing a description.

### 📋 Complaint History

Displays previously submitted complaints and their current status.

---

## 🗄️ Database

The project includes an SQL schema:

```text
database/citywatch.sql
```

The database component was developed as part of the university DBMS project.

The schema can be extended to manage:

* Users
* Complaints
* Complaint categories
* Complaint status
* Complaint history
* Administrative actions

### Current Data Flow

The current frontend uses browser storage:

```text
Frontend
   ↓
JavaScript
   ↓
localStorage
```

### Future Architecture

The intended full-stack architecture is:

```text
Frontend
   ↓
Backend API
   ↓
Relational Database
   ↓
SQL Queries
```

> The current version does **not** include a live backend/database connection.

---

## 🛠️ Technologies Used

| Technology       | Purpose            |
| ---------------- | ------------------ |
| HTML5            | Page structure     |
| CSS3             | Styling and layout |
| JavaScript (ES6) | Application logic  |
| localStorage     | Demo data storage  |
| SQL              | Database schema    |
| Git & GitHub     | Version control    |

---

## 🚀 How to Run

### 1. Clone the Repository

```bash
git clone https://github.com/abdullah123-collab/CityWatch.git
cd CityWatch
```

### 2. Open the Project

Open:

```text
index.html
```

directly in your browser.

### Or use VS Code Live Server

1. Open the project in VS Code.
2. Right-click `index.html`.
3. Select **Open with Live Server**.

No backend server is currently required.

---

## 📌 Current Status

| Component              | Status     |
| ---------------------- | ---------- |
| Home Page              | ✅ Complete |
| Login Interface        | ✅ Complete |
| Dashboard              | ✅ Complete |
| Complaint Submission   | ✅ Complete |
| Complaint History      | ✅ Complete |
| Client-side Validation | ✅ Complete |
| localStorage           | ✅ Complete |
| SQL Schema             | ✅ Included |
| Backend API            | 🔜 Planned |
| Live Database          | 🔜 Planned |
| Real Authentication    | 🔜 Planned |

---

## 📚 DBMS Concepts

This project was created to practice fundamental DBMS concepts including:

* Relational database design
* SQL
* Database schema
* Tables and relationships
* CRUD operations
* Data organization
* Data validation

---

## 🔮 Future Improvements

* 🔐 Real user authentication
* 🗄️ MySQL/PostgreSQL database integration
* ⚡ REST API backend
* 👨‍💼 Admin dashboard
* 🔎 Complaint search and filtering
* 📄 Pagination
* 📍 Location-based complaints
* 📷 Image/file attachments
* 📧 Complaint notifications
* 📊 Complaint analytics
* 🔄 Real-time complaint status updates

---

## 🎓 Academic Project

CityWatch was developed as a **university DBMS project** to demonstrate the design of a citizen complaint management system.

The current version focuses on the frontend workflow and database design, providing a foundation for future full-stack development.

---

## 👨‍💻 Author

**Muhammad Abdullah**

BSCS Student | C++ | Python | Data Science | Machine Learning

GitHub: [@abdullah123-collab](https://github.com/abdullah123-collab)

---

## 📄 License

This project is intended for educational and portfolio purposes.

```

