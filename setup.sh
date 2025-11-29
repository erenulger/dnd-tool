#!/bin/bash

echo "🎲 DND Helper Tool - Setup Script"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "✅ All dependencies installed!"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Set up your Supabase database (see DATABASE_SETUP.md)"
echo "2. Create backend/.env file with your Supabase credentials"
echo "3. Create frontend/.env file with your Supabase credentials"
echo ""
echo "Then run:"
echo "  npm run dev:backend  (in one terminal)"
echo "  npm run dev:frontend (in another terminal)"
echo ""

