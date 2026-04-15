# JobQuest: Full-Stack Job Search and Application Management System

## Project Overview
JobQuest is a comprehensive full-stack web application designed for career discovery and application lifecycle management. The platform aggregates real-time job listings through external API integration and provides a suite of tools for application tracking and resume-to-job-description compatibility analysis.

## Technical Architecture

### Frontend
- Structure and Logic: HTML5, CSS3, JavaScript (ES6+)
- External Libraries: 
  - Axios: Simplified HTTP client for API requests
  - PDF.js: Client-side PDF parsing and text extraction

### Backend
- Runtime: Node.js
- Framework: Express.js
- ORM: Prisma
- Database: SQLite (Persistent local storage)

### Implementation Details
- **Search Proxy**: To avoid Cross-Origin Resource Sharing (CORS) limitations and browser-side tracking prevention, all job discovery requests are proxied through the Express backend.
- **Semantic Matcher**: A custom algorithm identifies technical keyword density between user resumes and target job descriptions, providing a compatibility score and gap analysis.
- **Persistence Layer**: User profiles and application trackers are managed via a structured relational database, ensuring data consistency across sessions.

## Installation and Local Development

### Prerequisites
- Node.js (v16.0 or higher)
- npm (Node Package Manager)

### Configuration
1. Clone the repository to the local environment.
2. Execute dependency installation:
   ```bash
   npm install
   ```
3. Initialize the database schema:
   ```bash
   npx prisma db push
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment Instructions (Render.com)

1. **GitHub Synchronization**: Direct the project files to a remote GitHub repository.
2. **Web Service Creation**: In the Render Dashboard, create a new Web Service and link the repository.
3. **Environment Configuration**:
   - Runtime: Node
   - Build Command: `npm install && npx prisma generate && npx prisma db push`
   - Start Command: `node server.js`
4. **Data Persistence**: Note that on Render's free tier, the SQLite database (`dev.db`) will reset upon service restarts or redeployments. For permanent production storage, integration with a managed PostgreSQL instance is recommended.

## Security and Authentication
The application utilizes an API-Key-per-user model. Third-party API keys are stored exclusively in the browser's `localStorage` to ensure privacy and security, preventing sensitive credentials from passing through the backend persistence layer.
