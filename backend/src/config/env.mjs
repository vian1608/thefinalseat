import dotenv from 'dotenv';
dotenv.config();

// Simple validation helper
function required(key) {
  const value = process.env[key];
  if (!value) {
    console.warn(`⚠️  Environment variable ${key} is missing.`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Supabase
  supabaseUrl: required('SUPABASE_URL'),
  supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
  
  // Resend
  resendApiKey: required('RESEND_API_KEY'),
  resendFrom: process.env.RESEND_FROM || 'The Final Seat LLC <onboarding@resend.dev>',
  inquiryNotifyEmails: process.env.INQUIRY_NOTIFY_EMAILS || 'support@thefinalseat.com,viansaini1608@gmail.com',

  // Stripe
  stripeSecretKey: required('STRIPE_SECRET_KEY'),
  stripeMockMode: process.env.STRIPE_MOCK_MODE === 'true',

  // Whop Flight Checkout Integration
  whopApiKey: process.env.WHOP_API_KEY || '',
  whopCompanyId: process.env.WHOP_COMPANY_ID || '',
  whopWebhookSecret: process.env.WHOP_WEBHOOK_SECRET || '',
  whopEnv: process.env.WHOP_ENV || 'sandbox',
  whopFlightCheckoutEnabled: process.env.WHOP_FLIGHT_CHECKOUT_ENABLED === 'true',

  // SerpAPI
  serpapiApiKey: required('SERPAPI_API_KEY'),

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Admin
  adminEmail: process.env.ADMIN_EMAIL || 'admin@thefinalseat.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  // PayPal
  paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  paypalEnv: process.env.PAYPAL_ENV || 'sandbox',
  paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID || '',

  // Google Analytics 4
  ga4PropertyId: process.env.GA4_PROPERTY_ID || '456789123',
  ga4ClientEmail: process.env.GA4_CLIENT_EMAIL || 'the-final-seat-analytics@the-final-seat.iam.gserviceaccount.com',
  ga4PrivateKey: process.env.GA4_PRIVATE_KEY || (process.env.GA4_CREDENTIALS_JSON ? JSON.parse(process.env.GA4_CREDENTIALS_JSON).private_key : '')
};

export default env;
