# ProjectFlow

ProjectFlow is a lightweight internal project management web application designed for managing DX / Software Development projects.

## Features

- Dashboard with project and work overview
- Project Management
- Feature Management
- Function Management
- PBI (Product Backlog Item) Management
- Sprint Management
- Developer Management
- Team & Responsibility
- Project member assignment
- Project roles:
  - Project Owner
  - Tech Lead
  - Developer
  - Reviewer
  - Support
- Automatic status roll-up
- Automatic ID generation
- Responsive modern UI
- Kanit font support
- SQLite database
- Docker / Docker Compose support

## Project Hierarchy

ProjectFlow uses the following hierarchy:

Project
→ Feature
→ Function
→ PBI
→ Sprint

Example:

DX-001
└── Feature
    └── Function
        └── PBI
            └── Sprint

## Automatic ID

The system automatically generates IDs for users.

| Object | Format | Example |
|---|---|---|
| Project | DX-### | DX-001 |
| Feature | F### | F001 |
| Function | FN### | FN001 |
| PBI | PBI-### | PBI-001 |
| Sprint | SPR-### | SPR-001 |

Users do not need to manually enter IDs for these objects.

Project ID is also automatically generated.

## Automatic Status Roll-up

ProjectFlow can calculate higher-level status from child items.

### Function

A Function becomes `Done` when all PBIs under the Function are Done.

### Feature

A Feature becomes `Done` when all Functions under the Feature are Done.

### Project

A Project becomes `Completed` when all Features under the Project are Done.

Status priority:

1. Blocked
2. In Progress
3. Review
4. To Do
5. Backlog

If all child items are Done, the parent is automatically marked as Done / Completed.

## Team & Responsibility

Developers can be managed separately and assigned to multiple projects.

Each project can have multiple members with different roles.

Example:

| Developer | Project | Role |
|---|---|---|
| Developer A | DX-001 | Tech Lead |
| Developer B | DX-001 | Developer |
| Developer A | DX-002 | Reviewer |

## Sprint Management

Sprint Management supports:

- Sprint creation
- Sprint name
- Sprint type
- Week / Month sprint
- Start date
- End date
- Sprint status
- Assigning PBIs to a Sprint
- Active Sprint selection

Sprint IDs are generated automatically.

## Technology Stack

### Backend

- Python
- FastAPI
- SQLAlchemy
- SQLite

### Frontend

- HTML5
- CSS3
- JavaScript
- Bootstrap
- Kanit Google Font

### Deployment

- Docker
- Docker Compose

## Project Structure

```text
ProjectFlow/
├── app/
│   ├── main.py
│   └── static/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── data/
│   └── projectflow.db
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## Run with Docker

### 1. Extract the project

Extract the ProjectFlow ZIP file.

### 2. Open Terminal

Open PowerShell / CMD / Terminal inside the project folder.

### 3. Build and start

```bash
docker compose up -d --build
```

### 4. Check container

```bash
docker compose ps
```

### 5. View logs

```bash
docker compose logs -f
```

### 6. Stop the application

```bash
docker compose down
```

## Access the Application

After starting the application, open:

```text
http://localhost:8000
```

If ProjectFlow is running on a server, use:

```text
http://SERVER-IP:8000
```

Example:

```text
http://10.44.20.100:8000
```

## Database

ProjectFlow uses SQLite.

Database location:

```text
data/projectflow.db
```

The database file should be backed up regularly.

### Backup

Stop the application first if you want to make a clean backup:

```bash
docker compose down
```

Then copy:

```text
data/projectflow.db
```

to a backup location.

## API

The backend is built with FastAPI.

Main API groups include:

```text
/api/projects
/api/features
/api/functions
/api/pbis
/api/sprints
/api/developers
/api/projects/{project_id}/members
```

FastAPI documentation is available at:

```text
http://localhost:8000/docs
```

## Development

For development without Docker, install the required Python packages:

```bash
pip install -r requirements.txt
```

Then run:

```bash
uvicorn app.main:app --reload
```

The application will normally be available at:

```text
http://localhost:8000
```

## UI Font

ProjectFlow uses Google Font:

```text
Kanit
```

The font is applied throughout the application UI, including:

- Dashboard
- Sidebar
- Buttons
- Forms
- Tables
- Cards
- Modal dialogs
- Project / Feature / Function / PBI / Sprint screens

## Version

Current version:

```text
v1.10
```

Main changes in this version:

- Automatic Project ID
- Automatic Feature ID
- Automatic Function ID
- Automatic PBI ID
- Automatic Sprint ID
- Kanit font
- Fixed font override issue
- Modern dashboard UI
- Team & Responsibility
- Automatic status roll-up

## Notes

This application is intended for internal project management and DX / Software Development workflow management.

Before using the application in a production environment, review:

- Authentication
- Authorization
- Database backup
- Network security
- HTTPS
- Server resource limits
- User access control
- Audit logging

## License

Internal use / company project.
