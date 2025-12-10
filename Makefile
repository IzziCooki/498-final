.PHONY: dev build prod

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Build production containers
build:
	docker-compose build
prod:
	docker compose up --build -d 