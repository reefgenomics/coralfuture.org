#!/bin/bash

# Quick rebuild script - faster version without cleanup
# Use this for quick iterations during development

echo "⚡ Quick rebuild starting..."

# Stop only django-app-1 and react-app-1 containers
echo "🛑 Stopping django-app-1 and react-app-1 containers..."
docker compose down django-app react-app

# Rebuild and start only django-app-1 and react-app-1 (without removing images)
echo "🔨 Rebuilding and starting django-app-1 and react-app-1 containers..."
docker compose up --build -d django-app react-app

# Quick status check
echo "📊 Container status:"
docker compose ps

echo "✅ Quick rebuild completed!"
echo "🌐 Services available at:"
echo "   - Django: http://localhost:8000"
echo "   - React:  http://localhost:3000" 