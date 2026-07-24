.PHONY: up down logs build restart ps

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build

restart:
	docker compose restart

ps:
	docker compose ps
