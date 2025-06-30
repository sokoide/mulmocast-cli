#!/bin/bash

echo "🚀 Starting Mulmocast API Server and Client..."

# Start the API server using the new refactored structure
cd .. && npx tsx ./server/app.ts &
API_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Open browser with the refactored client
echo "🌐 Opening web client..."
if command -v open >/dev/null 2>&1; then
    # macOS
    open http://localhost:3000/client/index.html
elif command -v xdg-open >/dev/null 2>&1; then
    # Linux
    xdg-open http://localhost:3000/client/index.html
elif command -v start >/dev/null 2>&1; then
    # Windows
    start http://localhost:3000/client/index.html
else
    echo "Please open http://localhost:3000/client/index.html in your browser"
fi

echo "✅ Setup complete!"
echo "📋 API Server PID: $API_PID"
echo "🛑 To stop the server: kill $API_PID"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for user to stop
wait $API_PID