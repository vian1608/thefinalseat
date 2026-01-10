// Admin Authentication System
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminAuth();
});

// Admin credentials (in production, this would be server-side)
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
};

// Initialize admin authentication
function initializeAdminAuth() {
    console.log('🔐 Initializing admin authentication...');
    
    // Check if already logged in
    if (isAdminLoggedIn()) {
        console.log('✅ Admin already logged in, redirecting to dashboard');
        redirectToDashboard();
        return;
    }
    
    // Setup form submission
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleAdminLogin);
    }
    
    console.log('✅ Admin authentication initialized');
}

// Handle admin login
async function handleAdminLogin(event) {
    event.preventDefault();
    console.log('🔐 Processing admin login...');
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    // Clear previous errors
    clearAllErrors();
    
    // Validate inputs
    if (!username) {
        showError('usernameError', 'Username is required');
        return;
    }
    
    if (!password) {
        showError('passwordError', 'Password is required');
        return;
    }
    
    // Show loading state
    showLoading(true);
    
    try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Validate credentials
        if (validateAdminCredentials(username, password)) {
            console.log('✅ Admin login successful');
            
            // Store admin session
            storeAdminSession(username);
            
            // Show success message
            showSuccess('Login successful! Redirecting...');
            
            // Redirect to dashboard
            setTimeout(() => {
                redirectToDashboard();
            }, 1500);
            
        } else {
            console.log('❌ Admin login failed - invalid credentials');
            showError('loginError', 'Invalid username or password');
        }
        
    } catch (error) {
        console.error('❌ Admin login error:', error);
        showError('loginError', 'Login failed. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Validate admin credentials
function validateAdminCredentials(username, password) {
    return username === ADMIN_CREDENTIALS.username && 
           password === ADMIN_CREDENTIALS.password;
}

// Store admin session
function storeAdminSession(username) {
    const sessionData = {
        username: username,
        loginTime: new Date().toISOString(),
        isAdmin: true
    };
    
    localStorage.setItem('adminSession', JSON.stringify(sessionData));
    console.log('✅ Admin session stored');
}

// Check if admin is logged in
function isAdminLoggedIn() {
    const sessionData = localStorage.getItem('adminSession');
    if (!sessionData) return false;
    
    try {
        const session = JSON.parse(sessionData);
        const loginTime = new Date(session.loginTime);
        const now = new Date();
        const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
        
        // Session expires after 8 hours
        if (hoursDiff > 8) {
            console.log('⏰ Admin session expired');
            localStorage.removeItem('adminSession');
            return false;
        }
        
        return session.isAdmin === true;
    } catch (error) {
        console.error('❌ Error parsing admin session:', error);
        localStorage.removeItem('adminSession');
        return false;
    }
}

// Get current admin session
function getCurrentAdminSession() {
    const sessionData = localStorage.getItem('adminSession');
    if (!sessionData) return null;
    
    try {
        return JSON.parse(sessionData);
    } catch (error) {
        console.error('❌ Error parsing admin session:', error);
        return null;
    }
}

// Redirect to dashboard
function redirectToDashboard() {
    window.location.href = 'admin-dashboard.html';
}

// Show loading state
function showLoading(show) {
    const loginBtn = document.getElementById('loginBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const loginText = document.getElementById('loginText');
    
    if (show) {
        loginBtn.disabled = true;
        loadingSpinner.style.display = 'inline-block';
        loginText.textContent = 'Logging in...';
    } else {
        loginBtn.disabled = false;
        loadingSpinner.style.display = 'none';
        loginText.textContent = 'Login to Admin Panel';
    }
}

// Show error message
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Show success message
function showSuccess(message) {
    const successElement = document.getElementById('loginSuccess');
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
    }
}

// Clear all errors
function clearAllErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.style.display = 'none';
        element.textContent = '';
    });
    
    const successElement = document.getElementById('loginSuccess');
    if (successElement) {
        successElement.style.display = 'none';
    }
}

// Admin logout
function adminLogout() {
    console.log('🔐 Admin logging out...');
    localStorage.removeItem('adminSession');
    window.location.href = 'admin-login.html';
}

// Check admin access (for protected pages)
function checkAdminAccess() {
    if (!isAdminLoggedIn()) {
        console.log('❌ Admin access denied - not logged in');
        window.location.href = 'admin-login.html';
        return false;
    }
    return true;
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isAdminLoggedIn,
        getCurrentAdminSession,
        adminLogout,
        checkAdminAccess
    };
}
