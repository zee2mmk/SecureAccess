# SecureAccess — Identity and Access Management Platform

SecureAccess is a portfolio project demonstrating the design and development of an enterprise-style Identity and Access Management (IAM) application. It focuses on secure authentication, access request workflows, approval controls, and auditability.

The project showcases full-stack engineering skills using Microsoft technologies and modern web development tools.

## Key Features

- **Microsoft Entra ID Authentication** — Sign-in and sign-out using Microsoft Authentication Library (MSAL).
- **Protected API Endpoints** — ASP.NET Core API secured with JWT bearer token validation.
- **Access Request Management** — Submit and track application access requests.
- **Approval Workflow** — Approve or reject pending requests with reviewer comments.
- **Separation of Duties** — Prevent employees from approving or rejecting their own requests.
- **Audit Trail** — Record request creation and review activities, with a request history timeline.
- **Dashboard and Search** — View request summaries, search and filter requests, and navigate paginated results.
- **Relational Data Persistence** — Store employees, applications, access requests, and audit events in SQL Server.

## Technology Stack

**Frontend**
- React
- TypeScript
- Vite
- Microsoft Authentication Library (MSAL)

**Backend**
- C#
- ASP.NET Core Web API (.NET 10)
- Entity Framework Core

**Database**
- SQL Server LocalDB
- Entity Framework Core migrations

**Identity and Security**
- Microsoft Entra ID
- OAuth 2.0 / OpenID Connect
- JWT bearer token validation
- Protected API endpoints
- Role-based access workflow concepts
- Audit logging

## Architecture

The application follows a client–API–database architecture:

1. The React frontend authenticates users through Microsoft Entra ID.
2. MSAL obtains an access token for the SecureAccess API.
3. The frontend sends the token in the HTTP Authorization header.
4. ASP.NET Core validates the token before allowing access to protected endpoints.
5. The API processes access requests and review decisions.
6. Entity Framework Core persists workflow data and audit events in SQL Server.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check API availability |
| GET | `/api/access-requests` | Retrieve access requests |
| POST | `/api/access-requests` | Submit an access request |
| PUT | `/api/access-requests/{id}/review` | Approve or reject a request |
| GET | `/api/access-requests/{id}/audit-events` | Retrieve request audit history |
| GET | `/api/employees` | Retrieve employees |
| GET | `/api/applications` | Retrieve managed applications |

All workflow and data endpoints require authentication. The health endpoint is public.

## Local Development Setup

### Prerequisites

- .NET 10 SDK
- Node.js and npm
- SQL Server LocalDB
- A Microsoft Entra ID tenant with appropriate permissions to configure application registrations

### 1. Configure the API

Copy `SecureAccess.Api/appsettings.example.json` to `SecureAccess.Api/appsettings.json`.

Update the copied file with your local database connection string and Microsoft Entra ID settings:

- **Connection string:** Verify that it matches your SQL Server LocalDB setup.
- **Tenant ID:** Replace `YOUR_ENTRA_TENANT_ID` with your Microsoft Entra tenant ID.
- **API audience:** Replace `api://YOUR_API_APPLICATION_CLIENT_ID` with the expected audience for your API app registration.

Configure the frontend's MSAL settings in `secureaccess-web/src/authConfig.ts` to match your own Microsoft Entra tenant and application registrations.

Register and configure the required Microsoft Entra applications, API permissions, and redirect URIs before running the application.

**Security note:** Never commit client secrets, passwords, access tokens, or other credentials to source control. The example configuration contains placeholders and is intended as a starting point for local development.

### 2. Run the backend

From the project root:

```powershell
cd SecureAccess.Api
dotnet restore
dotnet ef database update
dotnet run
```

The API is configured to run locally at `http://localhost:5225`.

### 3. Configure the frontend

In a separate terminal:

```powershell
cd secureaccess-web
npm install
```

Configure `src/authConfig.ts` with your own Microsoft Entra tenant ID, frontend app registration client ID, API application ID URI, and delegated API scope.

Ensure the frontend redirect URI is registered in Microsoft Entra ID and matches the application's configuration.

### 4. Run the frontend

```powershell
npm run dev
```

Open `http://localhost:5173` in your browser and sign in with an authorized test account.

## Project Structure

```text
SecureAccess/
├── SecureAccess.Api/
│   ├── Contracts/
│   ├── Data/
│   ├── Entities/
│   ├── Migrations/
│   ├── Program.cs
│   └── appsettings.json
├── secureaccess-web/
│   ├── public/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   └── authConfig.ts
│   ├── redirect.html
│   └── package.json
├── .gitignore
└── README.md
```

## Engineering Focus

SecureAccess demonstrates practical experience with:

- Full-stack application design and implementation
- Microsoft identity integration and token-based API security
- IAM access request and approval workflows
- Separation-of-duties controls
- Database-backed audit trails
- API design, validation, and error handling
- Relational data modeling and persistence

## Roadmap

Planned enhancements include stronger authorization policies, deriving reviewer identity from validated token claims, automated testing, and deployment-oriented configuration.

---

**Note:** SecureAccess is a portfolio and learning project. Its security controls and architecture should be reviewed and tested before any production use.
