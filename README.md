# DevOps PDF Library (Assignment 3)

This project is a web application for managing and viewing PDF files, developed as part of Assignment 3. It demonstrates the use of a Node.js backend with an SQLite database, containerized using Docker, and served behind an Nginx Proxy Manager.

## Features

- **PDF Management**: Upload and store PDF documents.
- **PDF Viewing**: View the list of available PDFs and their details.
- **PDF Processing**: Extracts information and generates images from PDFs using `pdf-parse` and `pdf-to-img`.
- **Responsive UI**: Built with Handlebars (hbs) templates and custom CSS.
- **Containerization**: Fully dockerized application using Docker Compose.
- **Reverse Proxy**: Integrated Nginx Proxy Manager for handling traffic and SSL management.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Templating Engine**: Handlebars (hbs)
- **Containerization**: Docker, Docker Compose
- **Proxy**: Nginx Proxy Manager

## Project Structure

```
.
├── backend/                # Node.js application source code
│   ├── db/                 # Database files
│   ├── middleware/         # Express middleware (PDF verification, etc.)
│   ├── pdfs/               # Storage for uploaded PDFs
│   ├── public/             # Static assets (CSS, images)
│   ├── routes/             # API routes
│   ├── views/              # Handlebars templates
│   ├── server.js           # Application entry point
│   └── Dockerfile          # Docker configuration for the backend
├── nginx/                  # Nginx Proxy Manager configuration and data
│   ├── data/               # Persistent data for Nginx
│   └── letsencrypt/        # SSL certificates
├── docker-compose.yml      # Docker Compose configuration
└── README.md               # Project documentation
```

## Getting Started

### Prerequisites

- Docker
- Docker Compose

### Installation & Running

1.  **Clone the repository** (if applicable) or navigate to the project directory.

2.  **Start the application** using Docker Compose:

    ```bash
    docker compose up -d
    ```

    This command will build the backend image and start both the `backend-pdf` and `nginx-pdf` containers.

    Alternatively, you can use the provided Makefile for development with hot-reloading:

    ```bash
    make dev
    ```

3.  **Access the Application**:
    - **Nginx Proxy Manager Admin Interface**: `http://localhost:5001`
        - Default Email: `admin@example.com`
        - Default Password: `changeme`
    - **Web Application**: Accessible via the configured Nginx proxy hosts (e.g., `http://localhost` if configured to forward to `backend-pdf:1738`).

### Development

To run the backend locally without Docker for development:

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the server:
    ```bash
    node server.js
    ```
    The server will start on port 1738 (default).

## Assignment Details

This submission implements the requirements for Assignment 3, focusing on:
- Containerizing a Node.js application.
- Setting up Nginx Proxy Manager as a reverse proxy.
- Configuring Docker Compose to orchestrate the services.
- Ensuring data persistence for the database and Nginx configurations.
