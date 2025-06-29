.PHONY: build run clean

dev:
	@echo "Starting development server..."
	npm run api-server

build:
	@echo "Building the project..."
	npm run build

run:
	@echo "Running the project..."
	npm run api-server-built

clean:
	@echo "Cleaning up..."
	rm -rf dist
	rm -rf node_modules
	npm cache clean --force
	@echo "Clean complete."