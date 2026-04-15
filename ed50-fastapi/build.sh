#!/bin/bash
# build docker image with progress bar

echo "building docker image for ed50-fastapi..."
echo "this might take 10-20 minutes on first build"

cd "$(dirname "$0")"

docker build \
    --progress=plain \
    --tag ed50-fastapi:latest \
    .

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ build completed successfully!"
    echo "to run use:"
    echo "  docker run -p 8001:8001 ed50-fastapi:latest"
    echo ""
    echo "or via docker-compose:"
    echo "  cd /root/coral-future && docker-compose up ed50-fastapi"
else
    echo ""
    echo "✗ build failed"
    exit 1
fi

