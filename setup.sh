#!/bin/bash

echo "🚀 KLU Attend+ Setup"
echo "==================="
echo ""

# Check Node version
NODE_VERSION=$(node --version)
echo "✓ Node.js version: $NODE_VERSION"

NPM_VERSION=$(npm --version)
echo "✓ npm version: $NPM_VERSION"
echo ""

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install
if [ $? -ne 0 ]; then
  echo "❌ Failed to install root dependencies"
  exit 1
fi
echo ""

# Install workspace dependencies
echo "📦 Installing workspace packages..."
cd packages/shared-types && npm install && cd ../..
cd packages/attendance-engine && npm install && cd ../..
cd apps/web && npm install && cd ../..
cd apps/api && npm install && cd ../..
echo "✓ All dependencies installed"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env.local (optional for demo mode)"
echo "2. Run: npm run dev"
echo "3. Visit: http://localhost:5173"
echo "4. Click 'Try Demo'"
