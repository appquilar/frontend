# Variables
NPM = npm
PLAYWRIGHT = npx playwright

# Colors
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m # No color

.PHONY: help install dev dev-landing stripe-check-account stripe-listen dev-e2e-seed e2e-seed-server landing-sync landing-build-sync build build-landing clean test test-quality test-unit test-integration test-e2e test-e2e-dashboard test-e2e-dashboard-shard test-e2e-dashboard-ui test-e2e-dashboard-ui-shard e2e-dashboard-generate test-ci coverage coverage-e2e coverage-top coverage-all ensure-playwright exec

STRIPE = stripe
STRIPE_EXPECTED_ACCOUNT_ID ?= acct_1T1MQ2COjGpVsE06
STRIPE_FORWARD_TO ?= https://dev.api.appquilar.com/api/billing/webhook/stripe
STRIPE_EVENTS ?= checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed,customer.subscription.trial_will_end,invoice.paid,invoice.payment_action_required,invoice.payment_failed

# Help
help:
	@echo "${GREEN}Available commands:${NC}"
	@echo "  make install     - Install dependencies"
	@echo "  make dev         - Start development environment (Vite) on host"
	@echo "  make dev-landing - Start development in landing-only mode"
	@echo "  make stripe-check-account - Verify Stripe CLI is authenticated to the expected Appquilar account"
	@echo "  make stripe-listen - Forward Stripe webhooks to the local dev API"
	@echo "  make dev-e2e-seed - Start FE locally using deterministic E2E seed API"
	@echo "  make landing-sync - Sync appquilar-landing dist into public/landing"
	@echo "  make landing-build-sync - Build and sync appquilar-landing into public/landing"
	@echo "  make e2e-seed-server - Start deterministic seed API server"
	@echo "  make build       - Build the application for production"
	@echo "  make build-landing - Build FE in landing-only mode"
	@echo "  make clean       - Remove dist/ and node_modules/"
	@echo "  make test        - Run all FE tests (unit + integration + public e2e + dashboard e2e)"
	@echo "  make test-quality - Run FE meaningful-test guard"
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

# Clean generated files
clean:
	@echo "${GREEN}Cleaning dist/ and node_modules/...${NC}"
	rm -rf dist node_modules

# Run tests
test:
	@echo "${GREEN}Ensuring Playwright Chromium is installed...${NC}"
	@$(PLAYWRIGHT) install --with-deps chromium >/dev/null 2>&1 || $(PLAYWRIGHT) install chromium >/dev/null
	@echo "${GREEN}Running all FE tests...${NC}"
	$(NPM) test

test-quality:
	@echo "${GREEN}Running FE meaningful-test guard...${NC}"
	$(NPM) run test:quality

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
