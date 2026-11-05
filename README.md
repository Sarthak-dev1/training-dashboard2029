# TrainingHub — Enterprise Learning & Development Dashboard

**TrainingHub** is a production-grade enterprise employee training management, scheduling, and learning analytics platform. It features complete training program tracking, curriculum syllabi, employee directory management, instructor profiles, multi-employee broadcast session scheduling with timeline calendar views, attendee feedback metrics, Excel/PDF report generation, an in-app notification center, and an intelligent grounded AI assistant.

---

## 1. Prerequisites

Before running the application locally on Windows, macOS, or Linux, ensure you have:
- **Node.js**: Version 18.x, 20.x, or 22.x LTS ([Download from Node.js official site](https://nodejs.org/))
- **npm**: Version 9.x or higher (included with Node.js)
- *(Optional)* **MySQL**: Version 8.0+ (Only if you wish to run with a live MySQL instance; otherwise, the built-in high-speed in-memory demo mode runs immediately with zero setup).

---

## 2. Installation Steps

1. Clone or download this repository to your computer:
   ```bash
   git clone https://github.com/Sarthak-dev1/training-dashboard.git
   cd training-dashboard
   ```

2. Install all required dependencies:
   ```bash
   npm install
   ```

---

## 3. Environment Setup

1. Copy the sample environment file:
   - On Windows (Command Prompt):
     ```cmd
     copy .env.example .env
     ```
   - On macOS / Linux:
     ```bash
     cp .env.example .env
     ```

2. Review `.env` parameters:
   - `PORT=3000`: Port the local web server binds to.
   - `SESSION_SECRET`: Secret used to sign session cookies (also supports `FLASK_SECRET_KEY` fallback).
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: Optional MySQL connection details.
   - `GEMINI_API_KEY`: Optional API key for Google Gemini AI assistant (if omitted, the built-in local grounded rule engine answers accurately using live data).

---

## 4. Database Setup & Modes

TrainingHub features **dual-mode database resilience**:

### Mode A: Zero-Setup High-Speed Demo Mode (Default)
- No database installation or setup required.
- Automatically initializes with realistic enterprise sample data: 7 training programs across 6 departments, 6 employees, 3 specialized trainers, scheduled broadcast sessions, and verified feedback reviews.
- All CRUD actions (adding trainings, employees, trainers, scheduling sessions, submitting feedback) work in-memory during execution.

### Mode B: MySQL Connection (Optional)
- If you have MySQL installed locally (e.g. XAMPP, WAMP, MySQL Workbench):
  1. Create a database: `CREATE DATABASE training_hub_db;`
  2. In `.env`, set:
     ```env
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=your_mysql_password
     DB_NAME=training_hub_db
     ```
  3. When started, TrainingHub detects MySQL and establishes a pooled connection automatically.

---

## 5. How to Start the Application

### On Windows (One-Click Launch):
Double-click the included `start.bat` file, or run in Command Prompt:
```cmd
start.bat
```
*This script automatically validates Node.js, sets up `.env`, installs dependencies if missing, opens your default browser, and starts the server.*

### On macOS / Linux / Manual Windows:
```bash
npm run dev
```

To stop the server at any time, press `Ctrl + C` in your terminal.

---

## 6. Localhost URL

Open your web browser and navigate to:
```
http://localhost:3000
```

---

## 7. Demo Login Credentials

The application is pre-configured with secure credentials for testing:

| Role | User ID / Username | Password | Department |
| :--- | :--- | :--- | :--- |
| **HR Administrator** | `admin` | `Admin@123` | Human Resources |
| **Employee** | `EMP001` | `Employee@123` | Finance |
| **Lead Trainer** | `michael.scott@dunder.com` | `Trainer@123` | Human Resources |

---

## 8. Modules & Key Capabilities

1. **Overview Dashboard**: High-level KPI statistics, active department breakdown percentage bars, recent course activity, quick shortcuts.
2. **Trainings & Curricula**: Catalog of programs with status tags, live search, department filters, and an interactive **View Syllabus** modal detailing week-by-week curriculum modules, learning outcomes, and prerequisites.
3. **Employee Directory**: Staff directory with unique Employee IDs, department assignments, live search, and automated employee user generation.
4. **Trainer Directory**: Specialized instructors with expertise tags, contact channels, live search, and interactive **Trainer Profile** modal.
5. **Broadcast Sessions & Calendar**: Instructor-led session scheduling with multi-employee enrollment. Features a toggle between **Table View** and **Calendar / Timeline Card View**.
6. **Feedback Management**: Executive rating scorecard (e.g. 4.8 / 5.0 stars) with star distribution progress bars, qualitative comments, and attendee rating submission.
7. **Reports & Exports**: Real-time generation of:
   - **Excel Workbook (`.xlsx`)**: 6 corporate-styled sheets with frozen header panes (Summary, Trainings, Employees, Trainers, Sessions, Feedback).
   - **Landscape PDF Brief (`.pdf`)**: Formatted executive report with data tables, page counters, and compliance footers.
8. **Settings & Diagnostics**: Profile update, password change, Light/Dark theme toggle (saved in `localStorage`), and live database telemetry status.
9. **In-App Notification Center**: Bell icon with unread badge counter, contextual alerts for scheduled sessions and new feedback, mark-as-read, and clear functionality.
10. **Floating AI Advisor**: Interactive floating assistant with quick prompt chips that answers questions about dashboard navigation, course schedules, trainers, and metrics grounded in real live data.

---

## 9. Common Troubleshooting Steps

- **Port 3000 already in use**:
  If port 3000 is occupied by another process, change `PORT=3001` in your `.env` file and restart.
- **Node.js command not found**:
  Ensure Node.js is installed and added to your system `PATH` environment variable. Open a new terminal window after installing.
- **Session invalid or logged out**:
  Clear browser cookies for `localhost:3000` or open in an incognito window, then log in using `admin` / `Admin@123`.
- **Excel/PDF export download issue**:
  Ensure popups are allowed for `localhost:3000` if your browser blocks automatic file downloads.
