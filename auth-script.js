// Authentication JavaScript

// DOM Elements
const signinForm = document.getElementById('signinForm');
const signupForm = document.getElementById('signupForm');
const passwordToggles = document.querySelectorAll('.password-toggle');
const passwordInputs = document.querySelectorAll('input[type="password"]');

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    setupEventListeners();
    setupPasswordToggles();
    setupFormValidation();
});

// Initialize authentication page
function initializeAuth() {
    // Add animation classes to elements
    const animatedElements = document.querySelectorAll('.auth-card, .auth-info');
    animatedElements.forEach((element, index) => {
        setTimeout(() => {
            element.classList.add('fade-in');
        }, index * 200);
    });

    // Set minimum date for date of birth
    const dateOfBirthInput = document.getElementById('dateOfBirth');
    if (dateOfBirthInput) {
        const today = new Date();
        const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
        dateOfBirthInput.max = maxDate.toISOString().split('T')[0];
    }
}

// Setup event listeners
function setupEventListeners() {
    // Sign in form
    if (signinForm) {
        signinForm.addEventListener('submit', handleSignIn);
    }

    // Sign up form
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignUp);
    }

    // Social login buttons
    setupSocialLogin();

    // Forgot password link
    const forgotPasswordLink = document.querySelector('.forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', handleForgotPassword);
    }

    // Terms and conditions link
    const termsLink = document.querySelector('.terms-link');
    if (termsLink) {
        termsLink.addEventListener('click', handleTermsAndConditions);
    }
}

// Setup password toggles
function setupPasswordToggles() {
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

// Setup form validation
function setupFormValidation() {
    // Email validation
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
        input.addEventListener('blur', validateEmail);
        input.addEventListener('input', clearValidation);
    });

    // Password validation
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', validatePassword);
        passwordInput.addEventListener('blur', validatePassword);
    }

    // Confirm password validation
    const confirmPasswordInput = document.getElementById('confirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validateConfirmPassword);
        confirmPasswordInput.addEventListener('blur', validateConfirmPassword);
    }

    // Phone validation
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('blur', validatePhone);
        input.addEventListener('input', clearValidation);
    });

    // Name validation
    const nameInputs = document.querySelectorAll('input[type="text"]');
    nameInputs.forEach(input => {
        if (input.id === 'firstName' || input.id === 'lastName') {
            input.addEventListener('blur', validateName);
            input.addEventListener('input', clearValidation);
        }
    });
}

// Handle sign in
function handleSignIn(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    // Validate form
    if (!validateSignInForm(email, password)) {
        return;
    }

    // Show loading state
    showLoadingState(signinForm);

    // Simulate API call
    setTimeout(() => {
        hideLoadingState(signinForm);
        
        // Mock authentication
        if (email === 'demo@urgenttravel.com' && password === 'password123') {
            showNotification('Welcome back! Redirecting to dashboard...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            showNotification('Invalid email or password. Please try again.', 'error');
        }
    }, 2000);
}

// Handle sign up
function handleSignUp(event) {
    event.preventDefault();
    
    const formData = getSignUpFormData();
    
    // Validate form
    if (!validateSignUpForm(formData)) {
        return;
    }

    // Show loading state
    showLoadingState(signupForm);

    // Simulate API call
    setTimeout(() => {
        hideLoadingState(signupForm);
        
        // Mock successful registration
        showNotification('Account created successfully! Welcome to Urgent Travel.', 'success');
        setTimeout(() => {
            window.location.href = 'signin.html';
        }, 2000);
    }, 2000);
}

// Get sign up form data
function getSignUpFormData() {
    return {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        emergencyContact: document.getElementById('emergencyContact').value.trim(),
        termsAndConditions: document.getElementById('termsAndConditions').checked,
        marketingEmails: document.getElementById('marketingEmails').checked
    };
}

// Validate sign in form
function validateSignInForm(email, password) {
    let isValid = true;

    if (!email) {
        showFieldError('email', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showFieldError('email', 'Please enter a valid email address');
        isValid = false;
    }

    if (!password) {
        showFieldError('password', 'Password is required');
        isValid = false;
    } else if (password.length < 6) {
        showFieldError('password', 'Password must be at least 6 characters');
        isValid = false;
    }

    return isValid;
}

// Validate sign up form
function validateSignUpForm(formData) {
    let isValid = true;

    // First name validation
    if (!formData.firstName) {
        showFieldError('firstName', 'First name is required');
        isValid = false;
    } else if (formData.firstName.length < 2) {
        showFieldError('firstName', 'First name must be at least 2 characters');
        isValid = false;
    }

    // Last name validation
    if (!formData.lastName) {
        showFieldError('lastName', 'Last name is required');
        isValid = false;
    } else if (formData.lastName.length < 2) {
        showFieldError('lastName', 'Last name must be at least 2 characters');
        isValid = false;
    }

    // Email validation
    if (!formData.email) {
        showFieldError('email', 'Email is required');
        isValid = false;
    } else if (!isValidEmail(formData.email)) {
        showFieldError('email', 'Please enter a valid email address');
        isValid = false;
    }

    // Phone validation
    if (!formData.phone) {
        showFieldError('phone', 'Phone number is required');
        isValid = false;
    } else if (!isValidPhone(formData.phone)) {
        showFieldError('phone', 'Please enter a valid phone number');
        isValid = false;
    }

    // Password validation
    if (!formData.password) {
        showFieldError('password', 'Password is required');
        isValid = false;
    } else if (!isStrongPassword(formData.password)) {
        showFieldError('password', 'Password must be at least 8 characters with uppercase, lowercase, and number');
        isValid = false;
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
        showFieldError('confirmPassword', 'Please confirm your password');
        isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
        showFieldError('confirmPassword', 'Passwords do not match');
        isValid = false;
    }

    // Date of birth validation
    if (!formData.dateOfBirth) {
        showFieldError('dateOfBirth', 'Date of birth is required');
        isValid = false;
    }

    // Emergency contact validation
    if (!formData.emergencyContact) {
        showFieldError('emergencyContact', 'Emergency contact is required');
        isValid = false;
    } else if (!isValidPhone(formData.emergencyContact)) {
        showFieldError('emergencyContact', 'Please enter a valid emergency contact number');
        isValid = false;
    }

    // Terms and conditions validation
    if (!formData.termsAndConditions) {
        showNotification('Please accept the Terms and Conditions', 'error');
        isValid = false;
    }

    return isValid;
}

// Validate email
function validateEmail(event) {
    const input = event.target;
    const email = input.value.trim();
    
    if (email && !isValidEmail(email)) {
        showFieldError(input.id, 'Please enter a valid email address');
    } else {
        clearFieldError(input.id);
    }
}

// Validate password
function validatePassword(event) {
    const input = event.target;
    const password = input.value;
    
    updatePasswordStrength(password);
    
    if (password && !isStrongPassword(password)) {
        showFieldError(input.id, 'Password must be at least 8 characters with uppercase, lowercase, and number');
    } else {
        clearFieldError(input.id);
    }
}

// Validate confirm password
function validateConfirmPassword(event) {
    const input = event.target;
    const confirmPassword = input.value;
    const password = document.getElementById('password').value;
    
    if (confirmPassword && password !== confirmPassword) {
        showFieldError(input.id, 'Passwords do not match');
    } else {
        clearFieldError(input.id);
    }
}

// Validate phone
function validatePhone(event) {
    const input = event.target;
    const phone = input.value.trim();
    
    if (phone && !isValidPhone(phone)) {
        showFieldError(input.id, 'Please enter a valid phone number');
    } else {
        clearFieldError(input.id);
    }
}

// Validate name
function validateName(event) {
    const input = event.target;
    const name = input.value.trim();
    
    if (name && name.length < 2) {
        showFieldError(input.id, 'Name must be at least 2 characters');
    } else {
        clearFieldError(input.id);
    }
}

// Update password strength indicator
function updatePasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text');
    
    if (!strengthBar || !strengthText) return;
    
    const strength = getPasswordStrength(password);
    
    strengthBar.className = 'strength-fill';
    strengthBar.classList.add(strength.level);
    strengthText.textContent = strength.text;
}

// Get password strength
function getPasswordStrength(password) {
    if (password.length < 6) {
        return { level: 'weak', text: 'Weak' };
    } else if (password.length < 8) {
        return { level: 'fair', text: 'Fair' };
    } else if (password.length < 12) {
        return { level: 'good', text: 'Good' };
    } else {
        return { level: 'strong', text: 'Strong' };
    }
}

// Show field error
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const formGroup = field.closest('.form-group');
    
    // Remove existing error
    clearFieldError(fieldId);
    
    // Add error class
    formGroup.classList.add('error');
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    formGroup.appendChild(errorDiv);
}

// Clear field error
function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const formGroup = field.closest('.form-group');
    
    formGroup.classList.remove('error');
    
    const errorMessage = formGroup.querySelector('.error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
}

// Clear validation
function clearValidation(event) {
    const field = event.target;
    clearFieldError(field.id);
}

// Show loading state
function showLoadingState(form) {
    const submitBtn = form.querySelector('.auth-btn');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    submitBtn.setAttribute('data-original-text', originalText);
}

// Hide loading state
function hideLoadingState(form) {
    const submitBtn = form.querySelector('.auth-btn');
    const originalText = submitBtn.getAttribute('data-original-text');
    
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
}

// Setup social login
function setupSocialLogin() {
    const googleBtn = document.querySelector('.google-btn');
    const facebookBtn = document.querySelector('.facebook-btn');
    
    if (googleBtn) {
        googleBtn.addEventListener('click', () => handleSocialLogin('google'));
    }
    
    if (facebookBtn) {
        facebookBtn.addEventListener('click', () => handleSocialLogin('facebook'));
    }
}

// Handle social login
function handleSocialLogin(provider) {
    showNotification(`Redirecting to ${provider} login...`, 'info');
    
    // Simulate social login
    setTimeout(() => {
        showNotification(`Successfully logged in with ${provider}!`, 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }, 1500);
}

// Handle forgot password
function handleForgotPassword(event) {
    event.preventDefault();
    
    const email = prompt('Please enter your email address:');
    if (email && isValidEmail(email)) {
        showNotification('Password reset instructions sent to your email!', 'success');
    } else if (email) {
        showNotification('Please enter a valid email address', 'error');
    }
}

// Handle terms and conditions
function handleTermsAndConditions(event) {
    event.preventDefault();
    
    // Create modal for terms and conditions
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 20px;
            padding: 2rem;
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2 style="color: #1e293b;">Terms and Conditions</h2>
                <button class="close-modal" style="
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #64748b;
                ">&times;</button>
            </div>
            <div style="line-height: 1.6; color: #374151;">
                <h3>1. Acceptance of Terms</h3>
                <p>By using Urgent Travel services, you agree to be bound by these terms and conditions.</p>
                
                <h3>2. Service Description</h3>
                <p>Urgent Travel provides emergency and urgent flight booking services 24/7.</p>
                
                <h3>3. User Responsibilities</h3>
                <p>Users are responsible for providing accurate information and maintaining account security.</p>
                
                <h3>4. Privacy Policy</h3>
                <p>Your personal information is protected according to our privacy policy.</p>
                
                <h3>5. Limitation of Liability</h3>
                <p>Urgent Travel is not liable for delays or cancellations beyond our control.</p>
            </div>
            <div style="text-align: center; margin-top: 2rem;">
                <button class="close-modal-btn" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 1rem 2rem;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                ">I Understand</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal functionality
    const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.remove();
        });
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

function isStrongPassword(password) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasMinLength = password.length >= 8;
    
    return hasUpperCase && hasLowerCase && hasNumbers && hasMinLength;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
}

// Get notification icon
function getNotificationIcon(type) {
    const icons = {
        'info': 'info-circle',
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle'
    };
    return icons[type] || 'info-circle';
}
