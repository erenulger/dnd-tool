# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies (2 minutes)

```bash
# Run the setup script
./setup.sh

# OR manually:
npm run install:all
```

### 2. Set Up Supabase (3 minutes)

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Wait for it to finish setting up

2. **Get Your Keys**
   - In Supabase dashboard: Settings → API
   - Copy these three values:
     - Project URL
     - anon/public key
     - service_role key

3. **Create Database Tables**
   - In Supabase dashboard: SQL Editor → New query
   - Copy the entire SQL script from `DATABASE_SETUP.md`
   - Click "Run"
   - Verify tables appear in Table Editor

4. **Configure Environment**
   
   **Backend** (`backend/.env`):
   ```env
   SUPABASE_URL=your_url_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SUPABASE_ANON_KEY=your_anon_key
   PORT=3000
   ```
   
   **Frontend** (`frontend/.env`):
   ```env
   VITE_SUPABASE_URL=your_url_here
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_API_URL=http://localhost:3000
   ```

### 3. Start the Application

**Terminal 1:**
```bash
npm run dev:backend
```

**Terminal 2:**
```bash
npm run dev:frontend
```

### 4. Open Your Browser

Go to: **http://localhost:5173**

### 5. Create Your First Session

1. Sign up for an account
2. Click "Create New Session"
3. You're now the DM!
4. Upload a map to test it out

## 🎯 Common Issues

**"Cannot connect to Supabase"**
→ Check your `.env` files have correct credentials

**"Permission denied"**
→ Make sure you ran the SQL script in Supabase

**"Port already in use"**
→ Change PORT in backend/.env or kill the process using the port

## 📱 Access from Other Devices

1. Find your IP: `ifconfig | grep "inet "` (Mac/Linux) or `ipconfig` (Windows)
2. **Configure Supabase** (Required for login to work!):
   - Supabase Dashboard → **Authentication** → **URL Configuration**
   - Add to **Redirect URLs**: `http://[YOUR_IP]:5173/**`
   - Add to **Site URL**: `http://[YOUR_IP]:5173` (or keep localhost)
3. On other device: `http://[YOUR_IP]:5173`
4. Make sure both devices are on the same WiFi network

---

**Need more help?** See `README.md` and `DATABASE_SETUP.md` for detailed instructions.

