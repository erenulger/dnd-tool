# Troubleshooting Guide

## Network Error When Loading Sessions

If you're getting a "Network Error" when trying to see your sessions, follow these steps:

### Step 1: Verify Backend is Running

1. Check if the backend server is running:
   ```bash
   # In the backend terminal, you should see:
   🚀 Server running on http://0.0.0.0:3000
   ```

2. If not running, start it:
   ```bash
   npm run dev:backend
   ```

### Step 2: Test Backend Connectivity

1. **From the device running the backend:**
   - Open browser and go to: `http://localhost:3000/api/health`
   - You should see: `{"status":"ok","timestamp":"..."}`

2. **From another device on the network:**
   - Find your server's IP address (see below)
   - Open browser and go to: `http://[YOUR_IP]:3000/api/health`
   - You should see the same JSON response

### Step 3: Find Your Server IP Address

**macOS/Linux:**
```bash
ifconfig | grep "inet "
```
Look for an IP like `192.168.x.x` or `10.0.x.x` (not `127.0.0.1`)

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter

### Step 4: Check Firewall Settings

**macOS:**
1. System Settings → Network → Firewall
2. Make sure ports 3000 and 5173 are allowed, OR
3. Temporarily disable firewall to test

**Windows:**
1. Windows Defender Firewall → Advanced Settings
2. Add inbound rules for ports 3000 and 5173

**Linux:**
```bash
# If using ufw
sudo ufw allow 3000
sudo ufw allow 5173

# If using iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5173 -j ACCEPT
```

### Step 5: Verify Network Connection

1. Make sure both devices are on the **same WiFi network**
2. Try pinging the server from the other device:
   ```bash
   ping [YOUR_IP]
   ```
   You should get responses

### Step 6: Check Browser Console

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for error messages
4. Check the Network tab to see if requests are being made

### Step 7: Manual API Test

Try accessing the API directly from the browser on the other device:
```
http://[YOUR_IP]:3000/api/health
```

If this works but the app doesn't, it's likely a CORS or frontend configuration issue.

## Common Issues and Solutions

### Issue: "Cannot connect to backend server"

**Solution:**
- Backend is not running → Start it with `npm run dev:backend`
- Wrong IP address → Use the correct local IP (not localhost)
- Firewall blocking → Check firewall settings
- Different network → Ensure both devices on same WiFi

### Issue: "CORS error" in browser console

**Solution:**
- Backend CORS is already configured to allow all origins in development
- Make sure backend is running
- Try accessing from the same device first to verify it works

### Issue: Backend accessible from server device but not from other devices

**Solution:**
- Check firewall settings (most common)
- Verify both devices on same network
- Try accessing `http://[YOUR_IP]:3000/api/health` directly in browser
- Check if your router has AP isolation enabled (disables device-to-device communication)

### Issue: Sessions load on one device but not another

**Solution:**
- This is likely the network error issue above
- Check backend connectivity from the device having issues
- Verify API URL is being detected correctly (check browser console)

## Quick Diagnostic Commands

```bash
# Test if backend is listening
curl http://localhost:3000/api/health

# Test from network IP (replace with your IP)
curl http://192.168.1.100:3000/api/health

# Check what's listening on port 3000
# macOS/Linux:
lsof -i :3000
# Windows:
netstat -ano | findstr :3000
```

## Still Having Issues?

1. Check backend terminal for error messages
2. Check browser console (F12) for detailed errors
3. Verify your `.env` files are configured correctly
4. Make sure Supabase is accessible (check internet connection)
5. Try restarting both frontend and backend servers

## Getting Help

When asking for help, provide:
- Error message from browser console
- Backend terminal output
- Your IP address (first 3 octets only, e.g., `192.168.1.x`)
- Operating system
- Whether it works on localhost but not network

