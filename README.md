# PDF Manager (Final Project)

A comprehensive web application for managing, viewing, and discussing PDF documents. This project features a full-stack implementation with real-time chat capabilities, user authentication, and a robust PDF management system.

## Features

- **User Authentication**: Secure registration and login system using Argon2 hashing.
- **PDF Management**: 
  - Upload and store PDF documents.
  - View PDFs directly in the browser.
  - Manage your personal library.
  - Access a shared library of PDFs.
- **Interactive Features**:
  - **Real-time Chat**: Global chat functionality powered by Socket.io.
  - **Comments**: Add comments to PDFs, with support for editing and voting (upvotes/downvotes).
- **User Profiles**: Customize your display name and profile color.
- **Responsive Design**: Mobile-friendly interface with a collapsible navigation menu.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (using `better-sqlite3`)
- **Templating**: Handlebars (`express-handlebars`)
- **Real-time**: Socket.io
- **Containerization**: Docker, Docker Compose
- **Reverse Proxy**: Nginx Proxy Manager

## Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Make](https://www.gnu.org/software/make/) (optional, for using the Makefile)

## Installation & Running

### Development

To run the application in development mode (with hot-reloading for the backend):

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd 498-final
   ```

2. Start the services using Make:
   ```bash
   make dev
   ```
   
   Or using Docker Compose directly:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```

3. Access the application at `http://localhost`.

### Production

To run the application in production mode:

```bash
make prod
```

Or:
```bash
docker compose up --build -d
```

## Project Structure

- **backend/**: Contains the Node.js/Express application code.
  - **routes/**: API and view routes.
  - **views/**: Handlebars templates.
  - **modules/**: Utility modules and middleware.
  - **public/**: Static assets (CSS, client-side JS).
  - **db/**: Database files.
- **nginx/**: Nginx configuration and data.
- **docker-compose.yml**: Base Docker Compose configuration.
- **docker-compose.dev.yml**: Development overrides for Docker Compose.
- **Makefile**: Shortcuts for common commands.

## Comment features
- Edit and delete comments you created on a pdf post (Show if you edited the comment, and when)
- Upvote and downvote feature for pdf comments 

## Authentication Features
- Lock account after 5 failed login attempts. Unlock after 15 minutes.
- Forgot password feature. (Send reset link to email)

## Extra Feature

- Shared PDFs Library
  - Users can add their personal pdfs to the shared pdf library 




## License

[ISC](https://opensource.org/licenses/ISC)
