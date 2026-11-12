.PHONY: help up down restart logs build migrate seed clean

help:
	@echo "TalentOS Platform Commands:"
	@echo "  make up          - Start all services (Backend, Frontend, Resume Parser, In-House DB if set)"
	@echo "  make down        - Stop all services"
	@echo "  make restart     - Restart all containers"
	@echo "  make logs        - Follow logs from all containers"
	@echo "  make build       - Rebuild container images"
	@echo "  make migrate     - Run Prisma migrations inside the backend container"
	@echo "  make seed        - Seed database with prototype mock dataset"
	@echo "  make clean       - Remove volumes and stopped containers"

up:
	@if [ "$$(grep -E '^DB_LOCATION=' .env 2>/dev/null | cut -d= -f2)" = "in_house" ] || [ -z "$$(grep -E '^DB_LOCATION=' .env 2>/dev/null)" ]; then \
		echo "Starting with in-house PostgreSQL container..."; \
		docker compose --profile in_house up -d; \
	else \
		echo "Starting with external database routing..."; \
		docker compose up -d; \
	fi

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

build:
	docker compose build

migrate:
	docker compose exec backend npx prisma migrate dev

seed:
	docker compose exec backend npm run seed

clean:
	docker compose down -v

