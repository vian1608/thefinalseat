# How to Run Urgent Travel Application

## Quick Start Options

### Option 1: Using Python's Built-in Server (Recommended for Quick Testing)

1. **Open Terminal/Command Prompt**
2. **Navigate to the project directory:**
   ```bash
   cd /Users/vinodsaini/Documents/Urgent-travel
   ```

3. **Start the server:**
   - For Python 3:
     ```bash
     python3 -m http.server 8000
     ```
   - For Python 2:
     ```bash
     python -m SimpleHTTPServer 8000
     ```

4. **Open your browser and visit:**
   ```
   http://localhost:8000
   ```

5. **To stop the server:** Press `Ctrl + C` in the terminal

---

### Option 2: Using Node.js (http-server)

1. **Install http-server globally** (if not already installed):
   ```bash
   npm install -g http-server
   ```

2. **Navigate to the project directory:**
   ```bash
   cd /Users/vinodsaini/Documents/Urgent-travel
   ```

3. **Start the server:**
   ```bash
   http-server -p 8000
   ```

4. **Open your browser and visit:**
   ```
   http://localhost:8000
   ```

---

### Option 3: Using PHP's Built-in Server

1. **Navigate to the project directory:**
   ```bash
   cd /Users/vinodsaini/Documents/Urgent-travel
   ```

2. **Start the server:**
   ```bash
   php -S localhost:8000
   ```

3. **Open your browser and visit:**
   ```
   http://localhost:8000
   ```

---

### Option 4: Using Live Server (VS Code Extension)

1. **Install Live Server extension** in VS Code
2. **Right-click on `index.html`**
3. **Select "Open with Live Server"**

---

## Important Notes

### ⚠️ Why You Need a Server?

This application makes API calls to the Amadeus API. Browsers enforce CORS (Cross-Origin Resource Sharing) policies that prevent loading files directly from the file system. **You cannot simply double-click `index.html`** - you must use a web server.

### ✅ Before Running

1. **API Configuration:** Make sure your Amadeus API credentials are set in `api-config.js`
   - Open `api-config.js`
   - Verify that `API_KEY` and `API_SECRET` are configured
   - See `API_SETUP_GUIDE.md` for detailed setup instructions

2. **File Structure:** Ensure all files are in the same directory as shown in the project layout

### 🚀 Accessing the Application

Once the server is running, open:
- **Main Application:** `http://localhost:8000/index.html` or just `http://localhost:8000`
- **API Status Page:** `http://localhost:8000/api-status.html`
- **Admin Login:** `http://localhost:8000/admin-login.html`

### 🐛 Troubleshooting

**Port Already in Use?**
- Use a different port: `python3 -m http.server 8080` (or any other port)
- Update the URL in your browser accordingly

**API Not Working?**
- Check `api-config.js` for correct credentials
- Verify your internet connection
- Check the browser console (F12) for error messages
- Visit `http://localhost:8000/api-status.html` to test API connectivity

**CORS Errors?**
- Make sure you're accessing via `http://localhost:8000` not `file:///`
- Ensure the server is actually running

---

## Development Tips

- **Check Browser Console:** Press F12 to open developer tools and see any errors
- **Network Tab:** Check if API requests are being made and what responses you're getting
- **Test Pages:** Use the test pages (`api-test-page.html`, `airport-test.html`, etc.) to debug specific features

---

## Production Deployment

For production, you'll want to:
1. Use a proper web server (Apache, Nginx, etc.)
2. Configure HTTPS
3. Set up proper CORS headers if needed
4. Configure environment variables for API keys (don't commit secrets to git)
