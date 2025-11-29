# 🎲 DND Helper Tool

A scalable Dungeons & Dragons helper application for managing sessions, maps, and players. Built with Vue.js, Node.js, and Supabase.

## Features

- ✅ User authentication and management
- ✅ Session creation and management
- ✅ Dungeon Master (DM) role with special permissions
- ✅ DM role transfer between session members
- ✅ Map upload and sharing (DM only)
- ✅ Real-time map viewing for all session members
- ✅ Local network access for multiplayer sessions

## Tech Stack

- **Frontend**: Vue.js 3 + Vite
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Prerequisites

Before you begin, make sure you have:

- Node.js (v18 or higher) installed
- npm or yarn package manager
- A Supabase account (free tier works fine)
- Basic knowledge of terminal/command line

## Setup Instructions

### Step 1: Clone and Install Dependencies

```bash
# Install all dependencies (root, backend, and frontend)
npm run install:all
```

### Step 2: Set Up Supabase Database

**This is the most important step!** Follow the detailed instructions in [DATABASE_SETUP.md](./DATABASE_SETUP.md).

**Quick summary:**
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and API keys
3. Run the SQL script provided in `DATABASE_SETUP.md` in Supabase SQL Editor
4. Verify tables were created

### Step 3: Configure Environment Variables

#### Backend Configuration

1. Navigate to the `backend` folder
2. Create a `.env` file (you can copy from `.env.example` if it exists)
3. Add your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here

PORT=3000
NODE_ENV=development
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

#### Frontend Configuration

1. Navigate to the `frontend` folder
2. Create a `.env` file
3. Add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
# VITE_API_URL is optional - it will auto-detect based on your current URL
# Only set this if you want to override the auto-detection
# VITE_API_URL=http://localhost:3000
```

**Where to find your Supabase keys:**
- Go to your Supabase project dashboard
- Click **Settings** → **API**
- Copy the **Project URL** and **anon/public key** for frontend
- Copy the **service_role key** for backend (keep this secret!)

**Note:** The API URL will automatically detect your server's IP address, so it works on both localhost and local network. You only need to set `VITE_API_URL` if you want to override this behavior.

### Step 4: Start the Application

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

### Step 5: Access on Local Network

The servers are configured to accept connections from your local network. To access from other devices:

1. Find your computer's local IP address:
   - **macOS/Linux**: Run `ifconfig | grep "inet "` in terminal
   - **Windows**: Run `ipconfig` in command prompt
   - Look for an IP like `192.168.x.x` or `10.0.x.x`

2. On other devices on the same network, access:
   - Frontend: `http://[YOUR_IP]:5173`
   - The API URL will automatically use `http://[YOUR_IP]:3000` based on the hostname

3. **Configure Supabase for Network Access** (Important!):
   - Go to your Supabase project dashboard
   - Navigate to **Authentication** → **URL Configuration**
   - Add your local network URLs to **Redirect URLs**:
     - `http://[YOUR_IP]:5173/**`
     - `http://localhost:5173/**`
   - Add to **Site URL** (optional, can keep as localhost):
     - `http://localhost:5173` or `http://[YOUR_IP]:5173`

**Important**: 
- Make sure your firewall allows connections on ports 3000 and 5173
- The API URL automatically detects the hostname, so no manual configuration needed

## Usage Guide

### Creating Your First Session

1. Sign up for an account (or sign in if you already have one)
2. Click "Create New Session"
3. Enter a session name and optional description
4. You'll automatically become the DM (Dungeon Master)

### Joining a Session

1. Ask the DM for the session ID (shown in the URL when viewing a session)
2. Navigate to `/session/[session-id]` in your browser
3. You'll be automatically added as a member

### Uploading a Map (DM Only)

1. Open your session
2. In the "Session Map" section, click or drag an image file
3. Supported formats: JPG, PNG, GIF, WEBP (max 10MB)
4. All session members will see the map automatically

### Transferring DM Role

1. As the current DM, open your session
2. In the "Session Members" section, find the member you want to make DM
3. Click "Transfer DM" next to their name
4. Confirm the transfer

## Project Structure

```
dnd-tool/
├── backend/           # Node.js/Express API server
│   ├── server.js      # Main server file
│   ├── uploads/       # Uploaded map files (created automatically)
│   └── package.json
├── frontend/          # Vue.js application
│   ├── src/
│   │   ├── views/     # Page components
│   │   ├── lib/       # API and Supabase clients
│   │   └── App.vue    # Main app component
│   └── package.json
├── DATABASE_SETUP.md  # Detailed database setup guide
└── README.md          # This file
```

## API Endpoints

### Authentication
- All endpoints require authentication via Bearer token

### Sessions
- `GET /api/sessions` - Get all sessions for current user
- `POST /api/sessions` - Create a new session
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions/:id/join` - Join a session
- `POST /api/sessions/:id/transfer-dm` - Transfer DM role

### Maps
- `POST /api/sessions/:id/maps` - Upload a map (DM only)
- `GET /api/sessions/:id/map` - Get current map for session

## Database Schema

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed schema information.

**Main Tables:**
- `sessions` - D&D sessions
- `session_members` - User-session relationships
- `maps` - Uploaded map files

## Security Features

- Row Level Security (RLS) enabled on all tables
- Authentication required for all API endpoints
- DM-only actions protected on both frontend and backend
- File upload validation (type and size limits)
- Secure file storage

## Troubleshooting

### "Cannot connect to Supabase"
- Check your `.env` files have the correct credentials
- Verify your Supabase project is active
- Check your internet connection

### "Permission denied" errors
- Make sure you ran the SQL script in `DATABASE_SETUP.md`
- Verify RLS policies were created
- Check that you're authenticated

### Maps not uploading
- Check file size (max 10MB)
- Verify file is an image (JPG, PNG, GIF, WEBP)
- Make sure you're the DM of the session
- Check backend console for errors

### Can't login from other devices on the network
- **Most Common Issue**: Supabase redirect URLs not configured
  - Go to Supabase dashboard → **Authentication** → **URL Configuration**
  - Add `http://[YOUR_IP]:5173/**` to **Redirect URLs**
  - Add `http://[YOUR_IP]:5173` to **Site URL** (or keep localhost)
  - Replace `[YOUR_IP]` with your actual local IP address
- Verify both devices are on the same network
- Check firewall settings (ports 3000 and 5173)
- Make sure you're using the correct IP address
- Try accessing the backend URL directly (`http://[YOUR_IP]:3000/api/health`) to test connectivity
- Clear browser cache and try again
- Check browser console for CORS or network errors

## Future Enhancements

This is a scalable foundation. Potential additions:
- Real-time updates via WebSockets
- Multiple maps per session
- Map annotations and markers
- Character sheets
- Dice rolling
- Chat functionality
- Initiative tracker
- And more!

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

MIT

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the `DATABASE_SETUP.md` guide
3. Check browser console and backend logs for error messages
4. Verify all environment variables are set correctly

---

**Happy adventuring! 🎲⚔️🐉**

