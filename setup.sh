#!/bin/bash
# Setup script - run once before docker-compose up

echo "Setting up BancaHNL project..."

# Copy seed data to clean path
if [ -f "datos-prueba-HNL (1).json" ]; then
    cp "datos-prueba-HNL (1).json" data/seed.json
    echo "✓ Seed data copied to data/seed.json"
elif [ -f "data/seed.json" ]; then
    echo "✓ Seed data already at data/seed.json"
else
    echo "⚠️  Warning: Seed data not found. Skipping seed."
fi

echo ""
echo "Setup complete! Run: docker-compose up --build"
