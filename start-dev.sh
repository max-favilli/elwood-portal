#!/bin/bash
# Start both the Elwood Runtime API and the Portal in parallel.
# Usage: ./start-dev.sh
# Stop: Ctrl+C (kills both processes)

API_DIR="$(dirname "$0")/../Elwood/dotnet/src/Elwood.Runtime.Api"
PORTAL_DIR="$(dirname "$0")"

echo "Starting Elwood Runtime API (http://localhost:5000) ..."
dotnet run --project "$API_DIR" &
API_PID=$!

echo "Starting Elwood Portal (http://localhost:3000) ..."
cd "$PORTAL_DIR" && npm run dev &
PORTAL_PID=$!

echo ""
echo "Both running. Open http://localhost:3000 in your browser."
echo "Press Ctrl+C to stop both."

trap "kill $API_PID $PORTAL_PID 2>/dev/null; exit" INT TERM
wait
