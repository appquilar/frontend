# Variables
PROJECT_NAME = appquilar
DOCKER_COMPOSE = docker-compose
NPM = npm
PLAYWRIGHT = npx playwright
CONTAINER_FE = $(PROJECT_NAME)-web-dev

# Colors
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No color

NETWORK_NAME = appquilar

.PHONY: help install dev dev-landing dev-domains-setup dev-domains-up dev-domains-down stripe-check-account stripe-listen dev-e2e-seed e2e-seed-server landing-sync landing-build-sync build build-landing up up-prod down down-prod restart logs clean test test-unit test-integration test-e2e test-e2e-dashboard test-e2e-dashboard-shard test-e2e-dashboard-ui test-e2e-dashboard-ui-shard e2e-dashboard-generate test-ci coverage coverage-e2e coverage-top coverage-all ensure-playwright start start-prod exec destroy rebuild network check-be shell

STRIPE = stripe
STRIPE_EXPECTED_ACCOUNT_ID ?= acct_1T1MQ2COjGpVsE06
STRIPE_FORWARD_TO ?= https://dev.api.appquilar.com/api/billing/webhook/stripe
STRIPE_EVENTS ?= checkout.session.completed,checkout.session.async_payment_succeeded,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted

# Help
help:
	@echo "${GREEN}Available commands:${NC}"
	@echo "  make install     - Install dependencies"
	@echo "  make dev         - Start development environment (Vite) on host"
	@echo "  make dev-landing - Start development in landing-only mode"
	@echo "  make dev-domains-setup - Generate local HTTPS certs + show hosts setup for dev.* domains"
	@echo "  make dev-domains-up - Start API + FE + HTTPS proxy for dev.appquilar.com / dev.api.appquilar.com"
	@echo "  make dev-domains-down - Stop API + FE + HTTPS proxy local domains stack"
	@echo "  make stripe-check-account - Verify Stripe CLI is authenticated to the expected Appquilar account"
	@echo "  make stripe-listen - Forward Stripe webhooks to the local dev API"
	@echo "  make dev-e2e-seed - Start FE locally using deterministic E2E seed API"
	@echo "  make landing-sync - Sync appquilar-landing dist into public/landing"
	@echo "  make landing-build-sync - Build and sync appquilar-landing into public/landing"
	@echo "  make e2e-seed-server - Start deterministic seed API server"
	@echo "  make build       - Build the application for production"
	@echo "  make build-landing - Build FE in landing-only mode"
	@echo "  make up          - Start API + FE + HTTPS proxy (dev.appquilar.com / dev.api.appquilar.com)"
	@echo "  make up-prod     - Start Docker containers (legacy production compose)"
	@echo "  make start       - Start the FE in Docker in DEVELOPMENT mode (Vite + hot reload)"
	@echo "  make start-prod  - Start the FE in Docker like in the BE (Nginx + built dist)"
	@echo "  make down        - Stop API + FE + HTTPS proxy local stack"
	@echo "  make down-prod   - Stop legacy production compose containers"
	@echo "  make restart     - Restart Docker containers"
	@echo "  make logs        - Show container logs"
	@echo "  make clean       - Remove dist/ and node_modules/"
	@echo "  make destroy     - Remove containers, images and volumes"
	@echo "  make rebuild     - Equivalent to clean + build + up"
	@echo "  make shell       - Enter the FE container to execute npm or other commands"
	@echo "  make test        - Run all FE tests (unit + integration + public e2e + dashboard e2e)"
	@echo "  make test-unit   - Run FE unit tests"
	@echo "  make test-integration - Run FE integration tests"
	@echo "  make test-e2e    - Run all FE end-to-end tests (public + dashboard)"
	@echo "  make test-e2e-dashboard - Run seeded Dashboard Playwright suite"
	@echo "  make test-e2e-dashboard-shard SHARD=1 TOTAL=4 - Run one seeded dashboard shard"
	@echo "  make test-e2e-dashboard-ui - Run seeded Dashboard suite in Playwright UI mode"
	@echo "  make test-e2e-dashboard-ui-shard SHARD=1 TOTAL=4 - Run one dashboard shard in UI mode"
	@echo "  make e2e-dashboard-generate CSV=/path/file.csv - Generate dashboard Playwright tests from CSV"
	@echo "  make test-ci     - Run FE CI test suite"
	@echo "  make coverage    - Run FE unit+integration coverage (console + html + lcov + summary)"
	@echo "  make coverage-e2e - Run FE E2E coverage (console + html + lcov + summary)"
	@echo "  make coverage-top - Show the files with lowest FE line coverage"
	@echo "  make coverage-all - Run FE e2e + unit+integration coverage"
	@echo "  make check-be    - Check if the FE can reach the BE inside Docker"

# Create network only if it doesn't exist
network:
	@if [ -z "$$(docker network ls --filter name=^$(NETWORK_NAME)$$ -q)" ]; then \
		echo "⛵  Creating network $(NETWORK_NAME)..."; \
		docker network create $(NETWORK_NAME); \
	else \
		echo "✔️  Network $(NETWORK_NAME) already exists"; \
	fi

# Install dependencies
install:
	@echo "${GREEN}Installing dependencies...${NC}"
	$(NPM) install

# Development mode (host)
dev:
	@echo "${GREEN}Starting development environment on host...${NC}"
	$(NPM) run dev

dev-landing:
	@echo "${GREEN}Starting frontend in landing-only mode...${NC}"
	$(NPM) run landing:sync
	$(NPM) run dev:landing

dev-domains-setup:
	@echo "${GREEN}Preparing local HTTPS setup for dev domains...${NC}"
	./docker/dev-domains/scripts/setup-local-https.sh

dev-domains-up: network dev-domains-setup
	@echo "${GREEN}Starting API stack for local HTTPS domains...${NC}"
	$(DOCKER_COMPOSE) -f ../api/docker-compose.yml up -d php messenger mysql mysql_integration mailpit
	@if ( [ -f .env ] && grep -Eiq '^VITE_LANDING_ONLY_MODE=(1|true|yes|on)$$' .env ) || ( [ -f .env.local ] && grep -Eiq '^VITE_LANDING_ONLY_MODE=(1|true|yes|on)$$' .env.local ); then \
		echo "${GREEN}Landing-only mode detected. Syncing landing assets...${NC}"; \
		$(NPM) run landing:sync; \
	fi
	@echo "${GREEN}Starting FE (Vite) stack...${NC}"
	VITE_API_BASE_URL=https://dev.api.appquilar.com $(DOCKER_COMPOSE) -f docker-compose.dev.yml up -d --build --renew-anon-volumes web
	@echo "${GREEN}Starting HTTPS reverse proxy (Caddy)...${NC}"
	$(DOCKER_COMPOSE) -f docker/dev-domains/docker-compose.yml up -d --force-recreate dev-proxy
	@echo ""
	@echo "${GREEN}Ready:${NC}"
	@echo "  FE:  https://dev.appquilar.com"
	@echo "  API: https://dev.api.appquilar.com"
	@echo ""

dev-domains-down:
	@echo "${GREEN}Stopping local HTTPS domains stack...${NC}"
	-$(DOCKER_COMPOSE) -f docker/dev-domains/docker-compose.yml down
	-$(DOCKER_COMPOSE) -f docker-compose.dev.yml down
	-$(DOCKER_COMPOSE) -f ../api/docker-compose.yml down

stripe-check-account:
	@if ! command -v $(STRIPE) >/dev/null 2>&1; then \
		echo "${RED}❌ Stripe CLI is not installed. Install it first and run 'stripe login'.${NC}"; \
		exit 1; \
	fi
	@CURRENT_ACCOUNT_ID="$$( $(STRIPE) config --list 2>/dev/null | awk -F"'" '/account_id/{print $$2; exit}' )"; \
	if [ -z "$$CURRENT_ACCOUNT_ID" ]; then \
		echo "${RED}❌ Stripe CLI account could not be detected. Run 'stripe login' and retry.${NC}"; \
		exit 1; \
	fi; \
	if [ "$$CURRENT_ACCOUNT_ID" != "$(STRIPE_EXPECTED_ACCOUNT_ID)" ]; then \
		echo "${RED}❌ Stripe CLI is authenticated to $$CURRENT_ACCOUNT_ID, expected $(STRIPE_EXPECTED_ACCOUNT_ID).${NC}"; \
		echo "Run 'stripe login' with the Appquilar Stripe account before using local billing commands."; \
		exit 1; \
	fi; \
	echo "${GREEN}Stripe CLI account verified: $(STRIPE_EXPECTED_ACCOUNT_ID)${NC}"

stripe-listen: stripe-check-account
	@echo "${GREEN}Forwarding Stripe webhooks to $(STRIPE_FORWARD_TO)...${NC}"
	@echo "Copy the webhook signing secret shown by Stripe CLI into ../api/.env.local as STRIPE_WEBHOOK_SECRET=..."
	@echo "Then keep this command running while testing checkout or portal flows."
	$(STRIPE) listen --events $(STRIPE_EVENTS) --forward-to $(STRIPE_FORWARD_TO) --skip-verify

# Development mode against deterministic E2E seed API
dev-e2e-seed:
	@echo "${GREEN}Starting frontend against E2E seed API...${NC}"
	$(NPM) run dev:e2e:seed

# Sync built landing assets into FE public/landing
landing-sync:
	@echo "${GREEN}Syncing landing dist into public/landing...${NC}"
	$(NPM) run landing:sync

# Build and sync landing assets into FE public/landing
landing-build-sync:
	@echo "${GREEN}Building and syncing landing dist into public/landing...${NC}"
	$(NPM) run landing:build-sync

# Start deterministic seed API server
e2e-seed-server:
	@echo "${GREEN}Starting deterministic E2E seed API server...${NC}"
	$(NPM) run e2e:seed:server

# Build for production
build:
	@echo "${GREEN}Building for production...${NC}"
	$(NPM) run build

build-landing:
	@echo "${GREEN}Building frontend in landing-only mode...${NC}"
	$(NPM) run build:landing

# Default up/down now use local HTTPS domains stack
up: dev-domains-up

# Legacy production-compose up
up-prod:
	@echo "${GREEN}Starting Docker containers (legacy production compose)...${NC}"
	$(DOCKER_COMPOSE) up -d

# Start FE (Docker) in DEVELOPMENT mode (Vite + hot reload)
start: network
	@echo "${GREEN}Starting frontend in Docker (development mode)...${NC}"
	$(DOCKER_COMPOSE) -f docker-compose.dev.yml up -d --build
	@echo ""
	@echo "${GREEN}Frontend (dev) available at:${NC} http://localhost:8080"
	@echo ""

# Start FE (Docker) in PRODUCTION mode (Nginx + dist)
start-prod: network
	@echo "${GREEN}Starting frontend in Docker (production mode)...${NC}"
	$(DOCKER_COMPOSE) -f docker-compose.yml up -d --build
	@echo ""
	@echo "${GREEN}Frontend (prod) available at:${NC} http://localhost:8080"
	@echo ""

# Default down for local HTTPS domains stack
down: dev-domains-down

# Legacy production-compose down
down-prod:
	@echo "${GREEN}Stopping Docker containers (legacy production compose)...${NC}"
	$(DOCKER_COMPOSE) down

# Restart containers
restart:
	@echo "${GREEN}Restarting Docker containers...${NC}"
	$(DOCKER_COMPOSE) restart

# Show logs
logs:
	@echo "${GREEN}Showing logs...${NC}"
	$(DOCKER_COMPOSE) logs -f

# Clean generated files
clean:
	@echo "${GREEN}Cleaning dist/ and node_modules/...${NC}"
	rm -rf dist node_modules

# Enter the FE container
shell:
	@echo "${GREEN}Entering the FE container...${NC}"
	@docker exec -it $(CONTAINER_FE) sh || echo "${RED}❌ The container cannot be found. Is it running?${NC}"

# Destroy everything: containers, images, and volumes
destroy:
	@echo "${GREEN}Destroying containers, images, and volumes for the FE...${NC}"
	$(DOCKER_COMPOSE) down --rmi all --volumes --remove-orphans
	@echo "✔️ Project cleaned completely"

# Rebuild (clean + build + up)
rebuild: clean build up
	@echo "${GREEN}Completed full rebuild${NC}"

# Run tests
test:
	@echo "${GREEN}Ensuring Playwright Chromium is installed...${NC}"
	@$(PLAYWRIGHT) install --with-deps chromium >/dev/null 2>&1 || $(PLAYWRIGHT) install chromium >/dev/null
	@echo "${GREEN}Running all FE tests...${NC}"
	$(NPM) test

test-unit:
	@echo "${GREEN}Running FE unit tests...${NC}"
	$(NPM) run test:unit

test-integration:
	@echo "${GREEN}Running FE integration tests...${NC}"
	$(NPM) run test:integration

test-e2e:
	@echo "${GREEN}Ensuring Playwright Chromium is installed...${NC}"
	@$(PLAYWRIGHT) install --with-deps chromium >/dev/null 2>&1 || $(PLAYWRIGHT) install chromium >/dev/null
	@echo "${GREEN}Running all FE E2E tests (public + dashboard)...${NC}"
	$(NPM) run test:e2e

test-e2e-dashboard:
	@echo "${GREEN}Ensuring Playwright Chromium is installed...${NC}"
	@$(PLAYWRIGHT) install --with-deps chromium >/dev/null 2>&1 || $(PLAYWRIGHT) install chromium >/dev/null
	@echo "${GREEN}Running seeded Dashboard Playwright suite...${NC}"
	$(NPM) run test:e2e:dashboard

test-e2e-dashboard-shard:
	@if [ -z "$(SHARD)" ] || [ -z "$(TOTAL)" ]; then \
		echo "${RED}❌ Missing SHARD/TOTAL. Usage: make test-e2e-dashboard-shard SHARD=1 TOTAL=4${NC}"; \
		exit 1; \
	fi
	@echo "${GREEN}Ensuring Playwright Chromium is installed...${NC}"
	@$(PLAYWRIGHT) install --with-deps chromium >/dev/null 2>&1 || $(PLAYWRIGHT) install chromium >/dev/null
	@echo "${GREEN}Running seeded Dashboard shard $(SHARD)/$(TOTAL)...${NC}"
	$(NPM) run test:e2e:dashboard -- --shard=$(SHARD)/$(TOTAL)

test-e2e-dashboard-ui:
	@echo "${GREEN}Ensuring Playwright Chromium is installed...${NC}"
	@$(PLAYWRIGHT) install --with-deps chromium >/dev/null 2>&1 || $(PLAYWRIGHT) install chromium >/dev/null
	@echo "${GREEN}Running seeded Dashboard Playwright suite (UI mode)...${NC}"
	$(NPM) run test:e2e:dashboard:ui

test-e2e-dashboard-ui-shard:
	@if [ -z "$(SHARD)" ] || [ -z "$(TOTAL)" ]; then \
		echo "${RED}❌ Missing SHARD/TOTAL. Usage: make test-e2e-dashboard-ui-shard SHARD=1 TOTAL=4${NC}"; \
		exit 1; \
	fi
	@echo "${GREEN}Ensuring Playwright Chromium is installed...${NC}"
	@$(PLAYWRIGHT) install --with-deps chromium >/dev/null 2>&1 || $(PLAYWRIGHT) install chromium >/dev/null
	@echo "${GREEN}Running seeded Dashboard shard $(SHARD)/$(TOTAL) in UI mode...${NC}"
	$(NPM) run test:e2e:dashboard:ui -- --shard=$(SHARD)/$(TOTAL)

e2e-dashboard-generate:
	@if [ -z "$(CSV)" ]; then \
		echo "${RED}❌ Missing CSV path. Usage: make e2e-dashboard-generate CSV=/absolute/path/file.csv${NC}"; \
		exit 1; \
	fi
	@echo "${GREEN}Generating dashboard Playwright tests from CSV...${NC}"
	$(NPM) run e2e:dashboard:generate -- "$(CSV)"

test-ci:
	@echo "${GREEN}Ensuring Playwright Chromium is installed...${NC}"
	@$(PLAYWRIGHT) install --with-deps chromium >/dev/null 2>&1 || $(PLAYWRIGHT) install chromium >/dev/null
	@echo "${GREEN}Running FE CI test suite...${NC}"
	$(NPM) run test:ci

coverage:
	@echo "${GREEN}Running FE coverage (unit + integration)...${NC}"
	npx vitest run --config vitest.config.ts src/test/unit src/test/integration --coverage --coverage.reporter=text --coverage.reporter=lcov --coverage.reporter=html --coverage.reporter=json-summary
	@echo "${GREEN}Coverage reports:${NC}"
	@echo "  Console: shown above"
	@echo "  HTML: coverage/index.html"
	@echo "  LCOV: coverage/lcov.info"
	@echo "  Summary JSON: coverage/coverage-summary.json"

coverage-e2e:
	@echo "${GREEN}Ensuring Playwright Chromium is installed...${NC}"
	@$(PLAYWRIGHT) install --with-deps chromium >/dev/null 2>&1 || $(PLAYWRIGHT) install chromium >/dev/null
	@echo "${GREEN}Running FE E2E coverage (app + dashboard suites)...${NC}"
	$(NPM) run test:e2e:coverage
	@echo "${GREEN}E2E coverage reports:${NC}"
	@echo "  Scoped console: shown above (coverage-e2e)"
	@echo "  Scoped HTML: coverage-e2e/index.html"
	@echo "  Scoped LCOV: coverage-e2e/lcov.info"
	@echo "  Scoped Summary JSON: coverage-e2e/coverage-summary.json"
	@echo "  Scope metadata: coverage-e2e/scope.json"
	@echo "  Full HTML: coverage-e2e-full/index.html"
	@echo "  Full LCOV: coverage-e2e-full/lcov.info"
	@echo "  Full Summary JSON: coverage-e2e-full/coverage-summary.json"

coverage-top:
	@node -e 'const fs=require("fs"); const path="coverage/coverage-summary.json"; if(!fs.existsSync(path)){console.error("Missing "+path+". Run `make coverage` first."); process.exit(1);} const data=JSON.parse(fs.readFileSync(path,"utf8")); const rows=Object.entries(data).filter(([file])=>file!=="total").map(([file,metrics])=>({file,lines:metrics.lines.pct,branches:metrics.branches.pct,functions:metrics.functions.pct,statements:metrics.statements.pct})).sort((a,b)=>a.lines-b.lines).slice(0,15); console.table(rows);'

coverage-all:
	@$(MAKE) coverage-e2e
	@$(MAKE) coverage

# Check connectivity FE → BE inside Docker (production container name)
check-be:
	@echo "${GREEN}Checking Backend communication...${NC}"
	@if docker ps --format '{{.Names}}' | grep -q "$(CONTAINER_FE)"; then \
		echo "${GREEN}→${NC} ${YELLOW}Running test inside container $(CONTAINER_FE)...${NC}"; \
		docker exec -it $(CONTAINER_FE) sh -c "wget -qO- http://php/api/health || echo 'ERROR'"; \
	else \
		echo "${RED}❌ FE container is not running. Execute: make start-prod${NC}"; \
		exit 1; \
	fi
