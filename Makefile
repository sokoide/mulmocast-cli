# set MULMOCAST_API_BASE if it's not defined
MULMOCAST_API_BASE ?= http://localhost:3000
MULMOCAST_API_BASE_PROD := https://tmp1.sokoide.com

.PHONY: install build run test clean

install:
	@echo "Installing dependencies..."
	yarn install

dev:
	@echo "Starting development server with file watching..."
	npm run dev

build:
	@echo "Building the project..."
	npm run build

prod:
	@echo "Building the project for production..."
	MULMOCAST_API_BASE=${MULMOCAST_API_BASE_PROD} npm run build

run:
	@echo "Running the project..."
	npm run api-server-built

test:
	@echo "Running test..."
	npm run test

clean:
	@echo "Cleaning up..."
	npm run clean
	rm -rf node_modules
	npm cache clean --force
	@echo "Clean complete."
