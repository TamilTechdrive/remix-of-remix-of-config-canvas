# PHP Backend (v5.3.10 Compatible)

Standalone PHP backend for ConfigFlow — no Composer, no modern extensions required.

## Requirements

- PHP 5.3.10+
- MySQL 5.x
- MSSQL 2008 via ODBC (optional)
- Apache/Nginx with mod_rewrite

## Setup

### 1. Database Setup

**MySQL** (users, parser, configurations):
```bash
mysql -u root < sql/mysql_schema.sql
```

**MSSQL** (projects, builds, teams, features):
```bash
sqlcmd -S localhost -U sa -i sql/mssql_schema.sql
```

### 2. Configuration

Edit `config.php`:
- Set MySQL credentials (`mysql` section)
- Set MSSQL ODBC DSN and credentials (`mssql` section)
- Change `jwt_secret` for production
- Adjust `allowed_origins` for CORS
- Toggle security features in `security` section

### 3. Apache .htaccess

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]
```

### 4. Run

Point your web server document root to this folder, or access via:
```
http://localhost/phpbackend2/
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check with DB status |
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Register |
| GET | /api/auth/me | Current user |
| GET | /api/projects | List projects |
| POST | /api/projects | Create project |
| GET | /api/projects/:id | Get project with models/builds |
| PUT | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project |
| POST | /api/projects/:id/stb-models | Create STB model |
| POST | /api/projects/stb-models/:id/builds | Create build |
| POST | /api/parser/seed | Seed parser data |
| GET | /api/parser/sessions | List parser sessions |
| GET | /api/parser/sessions/:id | Get session with full data |
| GET | /api/features | List features (filter by project/build/module) |
| POST | /api/features | Create feature |
| PUT | /api/features/:id | Update feature |

## Security Features

Configurable in `config.php` → `security` section:
- **CSRF Protection**: Token-based (session storage)
- **Rate Limiting**: File-based (no extensions needed)
- **Password Hashing**: SHA256 + salt (PHP 5.3 compatible)
- **Input Sanitization**: HTML entity encoding
- **Security Headers**: X-Frame-Options, XSS Protection, etc.

All security features can be enabled/disabled via config flags.

## Architecture

```
phpbackend2/
├── index.php          # Entry point & router setup
├── config.php         # All configuration
├── lib/
│   ├── Database.php   # MySQL + ODBC/MSSQL dual connection
│   ├── Router.php     # Simple URL router
│   ├── Response.php   # JSON response helper
│   ├── Auth.php       # JWT-like auth (PHP 5.3 compatible)
│   └── Security.php   # CSRF, rate limiting, sanitization
├── handlers/
│   ├── health.php     # Health check
│   ├── auth.php       # Login/register/me
│   ├── projects.php   # Project CRUD (MSSQL)
│   ├── stb.php        # STB Model CRUD (MSSQL)
│   ├── builds.php     # Build CRUD (MSSQL)
│   ├── parser.php     # Parser sessions (MySQL)
│   └── features.php   # Feature flags (MSSQL)
├── sql/
│   ├── mysql_schema.sql   # MySQL tables
│   └── mssql_schema.sql   # MSSQL tables
└── README.md
```
