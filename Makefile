.DEFAULT_GOAL := help

COMPOSE := docker compose --env-file .env -f compose.yaml
IMAGE := baius-paulo-afonso-em-dados
SERVICE ?= web

.PHONY: help env up down restart logs status shell install init migrate seed lint typecheck test build production-build worker-build worker legislative db-up test-db

help: ## Mostra os comandos disponíveis
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_-]+:.*##/ {printf "%-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

env: ## Cria .env sem sobrescrever configuração existente
	@test -f .env || cp .env.example .env

up: env ## Inicia o ambiente local em http://localhost:3104
	$(COMPOSE) up -d --build

db-up: env ## Inicia apenas o Postgres local
	$(COMPOSE) up -d --wait postgres

down: env ## Para os containers locais e preserva os volumes
	$(COMPOSE) down

restart: env ## Reinicia os serviços locais
	$(COMPOSE) restart

logs: env ## Acompanha logs (SERVICE=web ou postgres)
	$(COMPOSE) logs -f $(SERVICE)

status: env ## Exibe o estado dos containers
	$(COMPOSE) ps

shell: env ## Abre um shell no container de desenvolvimento
	$(COMPOSE) exec web sh

install: env ## Instala dependências com lockfile no container
	$(COMPOSE) run --rm web pnpm install --frozen-lockfile

init: up ## Aplica migrations e cadastra fontes no banco local
	$(COMPOSE) exec web pnpm db:migrate
	$(COMPOSE) exec web pnpm db:seed

migrate: env ## Aplica migrations no banco local
	$(COMPOSE) run --rm web pnpm db:migrate

seed: env ## Cadastra fontes oficiais, sem dados fictícios
	$(COMPOSE) run --rm web pnpm db:seed

lint: env ## Executa lint dentro do container
	$(COMPOSE) run --rm web pnpm lint

typecheck: env ## Valida tipos dentro do container
	$(COMPOSE) run --rm web pnpm typecheck

test-db: db-up ## Cria o banco isolado de testes sem recriar dados existentes
	$(COMPOSE) exec -T postgres sh < docker/create-test-db.sh

test: test-db ## Executa testes unitários e integração no banco pad_test
	$(COMPOSE) run --rm web pnpm test

build: env ## Gera o build do portal dentro do container
	$(COMPOSE) run --rm web pnpm build

production-build: ## Valida a imagem do portal usada pelo Coolify
	docker build --target production -t $(IMAGE):local .

worker-build: ## Valida a imagem do coletor usada pelo Coolify
	docker build --target production-worker -t $(IMAGE)-worker:local .

worker: env ## Executa coleta manual (CMD="siger:works", por exemplo)
	@test -n "$(CMD)" || (echo 'Use: make worker CMD="siger:works"' && exit 2)
	$(COMPOSE) run --rm web pnpm worker $(CMD)

legislative: env ## Atualiza autoria do SAPL (YEAR=2026); precisa de novo deploy
	$(COMPOSE) run --rm web pnpm collect:legislative $(YEAR)
