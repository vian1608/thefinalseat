import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // Fallback

// Simple validation helper
function required(key) {
  const value = process.env[key];
  if (!value) {
    console.warn(`⚠️  Environment variable ${key} is missing.`);
  }
  return value;
}

export const env = {
  get nodeEnv() { return process.env.NODE_ENV || 'development'; },
  get port() { return parseInt(process.env.PORT || '5001', 10); },
  get frontendUrl() { return process.env.FRONTEND_URL || 'http://localhost:3000'; },
  
  // Supabase
  get supabaseUrl() { return process.env.SUPABASE_URL || ''; },
  get supabaseSecretKey() { return process.env.SUPABASE_SECRET_KEY || ''; },
  
  // Resend
  get resendApiKey() { return process.env.RESEND_API_KEY || ''; },
  get resendFrom() { return process.env.RESEND_FROM || 'The Final Seat <support@thefinalseat.com>'; },
  get inquiryNotifyEmails() { return process.env.INQUIRY_NOTIFY_EMAILS || 'support@thefinalseat.com,viansaini1608@gmail.com'; },
  get adminBookingNotificationEmail() { return process.env.ADMIN_BOOKING_NOTIFICATION_EMAIL || 'viansaini1608@gmail.com'; },
  get adminBookingNotificationsEnabled() { return process.env.ADMIN_BOOKING_NOTIFICATIONS_ENABLED !== 'false'; },

  // Stripe
  get stripeSecretKey() { return process.env.STRIPE_SECRET_KEY || ''; },
  get stripeMockMode() { return process.env.STRIPE_MOCK_MODE === 'true'; },

  // Whop Flight Checkout Integration
  get whopApiKey() { return process.env.WHOP_API_KEY || ''; },
  get whopCompanyId() { return process.env.WHOP_COMPANY_ID || ''; },
  get whopWebhookSecret() { return process.env.WHOP_WEBHOOK_SECRET || ''; },
  get whopEnv() { return process.env.WHOP_ENV || 'sandbox'; },
  get whopFlightCheckoutEnabled() { return process.env.WHOP_FLIGHT_CHECKOUT_ENABLED !== 'false'; },

  // SerpAPI
  get serpapiApiKey() { return process.env.SERPAPI_API_KEY || ''; },

  // JWT
  get jwtSecret() { return process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'; },
  get jwtExpiresIn() { return process.env.JWT_EXPIRES_IN || '7d'; },

  // Admin
  get adminEmail() { return process.env.ADMIN_EMAIL || 'admin@thefinalseat.com'; },
  get adminPassword() { return process.env.ADMIN_PASSWORD || 'admin123'; },

  // PayPal
  get paypalClientId() { return process.env.PAYPAL_CLIENT_ID || ''; },
  get paypalClientSecret() { return process.env.PAYPAL_CLIENT_SECRET || ''; },
  get paypalEnv() { return process.env.PAYPAL_ENV || 'sandbox'; },
  get paypalWebhookId() { return process.env.PAYPAL_WEBHOOK_ID || ''; },

  // Google Analytics 4
  get ga4PropertyId() { return process.env.GA4_PROPERTY_ID || '456789123'; },
  get ga4ClientEmail() { return process.env.GA4_CLIENT_EMAIL || 'the-final-seat-analytics@the-final-seat.iam.gserviceaccount.com'; },
  get ga4PrivateKey() { return process.env.GA4_PRIVATE_KEY || (process.env.GA4_CREDENTIALS_JSON ? JSON.parse(process.env.GA4_CREDENTIALS_JSON).private_key : '') },

  // Business Support Contact
  get supportPhoneDisplay() { return process.env.BUSINESS_SUPPORT_PHONE_DISPLAY || '(888) 780-8855'; },
  get supportPhoneInternational() { return process.env.BUSINESS_SUPPORT_PHONE_INTL || '+1 (888) 780-8855'; },
  get supportPhoneHref() { return process.env.BUSINESS_SUPPORT_PHONE_HREF || 'tel:+18887808855'; },
  get supportPhoneSchema() { return process.env.BUSINESS_SUPPORT_PHONE_SCHEMA || '+1-888-780-8855'; }
};


export default env;
