.PHONY: install build run clean

dev:
	@echo "Starting development server..."
	npm run api-server

install:
	@echo "Installing dependencies..."
	yarn install

build:
	@echo "Building the project..."
	npm run build

run:
	@echo "Running the project..."
	npm run api-server-built

clean:
	@echo "Cleaning up..."
	npm run clean
	rm -rf node_modules
	npm cache clean --force
	@echo "Clean complete."