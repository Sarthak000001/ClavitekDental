# ClavitekDental

A comprehensive dental clinic management system originally built with PHP/MySQL and now being migrated to a MERN stack. This repository contains the current codebase, which includes the legacy PHP implementation, assets, and the ongoing migration work.

## Tech Stack Overview

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla HTML, CSS, JavaScript (single‑page app) |
| **Backend** | PHP 7+ (procedural) with PDO for MySQL |
| **Database** | MySQL |
| **Server** | Apache (XAMPP) |
| **Icons** | Lucide Icons (CDN) |
| **Charts** | Chart.js |
| **Notifications** | Meta WhatsApp Cloud API |

## Project Structure

```
ClavitekDental/
├── index.html                # Main SPA entry point
├── css/
│   └── style.css            # Global styles
├── js/
│   └── app.js               # Frontend logic
├── api/
│   ├── auth.php             # Authentication endpoints
│   ├── appointments.php     # Appointment CRUD
│   ├── doctors.php          # Doctor management
│   ├── patients.php         # Patient lookup/create
│   ├── slots.php            # Slot handling
│   ├── followups.php        # Follow‑up plans
│   └── ...
├── db/
│   ├── schema.sql           # Database schema
│   └── *.sql                # Migration scripts
├── cron/
│   └── cron_generate_slots.php  # Monthly slot generation
├── assets/images/            # Logos and avatars
└── project_walkthrough.md   # Detailed architecture documentation
```

## Setup Instructions

1. **Clone the repository** (once it’s pushed to GitHub) or copy the folder to your local machine.
2. **Install dependencies** (only Node.js dev dependencies are listed in `package.json` for tooling):
   ```bash
   npm install
   ```
3. **Configure the environment**:
   - Create a `.env` file (or edit `api/config.php`) with your MySQL credentials and WhatsApp API token.
   - Ensure Apache points to the project directory (e.g., `c:/xampp/htdocs/ClavitekDental`).
4. **Import the database**:
   - Open phpMyAdmin or use the MySQL CLI to import `db/schema.sql`.
5. **Run the application**:
   - Start Apache via XAMPP.
   - Navigate to `http://localhost/ClavitekDental/` in your browser.

## Development Workflow

- **Frontend**: Edit `index.html`, `css/style.css`, or `js/app.js`. The app uses plain JavaScript with DOM manipulation.
- **Backend**: Modify PHP files under `api/`. All endpoints return JSON and expect sessions for authentication.
- **Database**: Use the migration scripts in `db/` for schema changes.
- **Cron Jobs**: The `cron_generate_slots.php` script should be scheduled to run monthly (via Windows Task Scheduler or cron on Linux).

## Contributing

Feel free to open issues or submit pull requests. When contributing:
1. Fork the repository.
2. Create a feature branch.
3. Ensure code follows existing style (PHP procedural, vanilla JS).
4. Submit a PR targeting the `main` branch.

## License

This project is provided for educational purposes. Add an appropriate license file if you wish to open‑source it.
