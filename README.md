# OpenStage Live (Beta V1)

OpenStage Live is an open-source platform designed to bridge the gap between the audience and the stage during live stagevisational performances. It enables real-time interaction, fully moderated by the production team.

---

## Version Française
OpenStage Live est une plateforme open-source qui connecte le public aux spectacles d'stagevisation théâtrale via des interactions en temps réel, entièrement modérées par la régie.

---

## Key Features
* **Moderation-First:** No audience content reaches the screen without admin approval.
* **Real-Time Interaction:** Powered by Socket.io for near-zero latency.
* **Multi-View Architecture:** Dedicated interfaces for the Public (mobile), Admin (tablet/PC), and Stage Screen (projector).
* **Session Resilience:** Automatic reconnection and state recovery.
* **Security:** Admin access protected by encrypted tokens and password.
* **Persistence:** Local SQLite database to save the show state.

---

## Repository Structure
* **`/backend`**: Node.js server handling business logic, SQLite persistence, and WebSockets.
* **`/frontend`**: React (Vite) application containing all three views (Public, Admin, Screen).
* **`docker-compose.yml`**: Main orchestration file.

---

## Installation & Quick Start

### 1. Prerequisites
* [Docker](https://www.docker.com/get-started) and **Docker Compose** installed.

### 2. Configuration
The application requires environment variables to run. A template is provided in the backend folder.

1. Navigate to the backend folder: `cd backend`
2. Copy the example file: `cp .env.example .env`
3. Edit the `.env` file with your own settings (especially `ADMIN_PASSWORD` and `SECRET_TOKEN`).

**Key variables in `.env`:**
* `PORT`: The internal port for the server (default 3000).
* `ADMIN_PASSWORD`: The password required to access the `/admin` dashboard.
* `SECRET_TOKEN`: A unique string used to sign security tokens.
* `CORS_ORIGIN`: Set this to your frontend URL (e.g., `http://localhost:5173` in dev).

### 3. Running the Application

#### 🛠 Development Mode (Hot Reload enabled)
Best for testing features or customizing the code.
```bash
docker-compose up --build