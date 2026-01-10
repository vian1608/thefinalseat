sa// API Test Utility
// Run this in browser console to test your API credentials

async function testAmadeusAPI() {
    console.log('🧪 Testing Amadeus API Configuration...');
    
    // Check if config is loaded
    if (typeof API_CONFIG === 'undefined') {
        console.error('❌ API_CONFIG not found. Make sure api-config.js is loaded.');
        return;
    }
    
    // Check credentials
    const config = getAmadeusConfig();
    console.log('📋 Configuration:');
    console.log('- API Key:', config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'MISSING');
    console.log('- API Secret:', config.apiSecret ? `${config.apiSecret.substring(0, 4)}...` : 'MISSING');
    console.log('- Environment:', config.environment);
    console.log('- Base URL:', config.baseURL);
    
    // Validate credentials
    if (!config.apiKey || config.apiKey === 'YOUR_AMADEUS_API_KEY') {
        console.error('❌ API Key not configured properly');
        return;
    }
    
    if (!config.apiSecret || config.apiSecret === 'YOUR_AMADEUS_API_SECRET') {
        console.error('❌ API Secret not configured properly');
        return;
    }
    
    // Test API key format
    if (config.apiKey.length < 20) {
        console.warn('⚠️ API Key seems too short. Amadeus keys are usually longer.');
    }
    
    if (config.apiSecret.length < 10) {
        console.warn('⚠️ API Secret seems too short. Amadeus secrets are usually longer.');
    }
    
    console.log('🔑 Testing authentication...');
    
    try {
        // Test token request
        const response = await fetch(`${config.baseURL}/v1/security/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: config.apiKey,
                client_secret: config.apiSecret
            })
        });
        
        console.log('📡 Response Status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Authentication successful!');
            console.log('- Token received:', data.access_token ? 'Yes' : 'No');
            console.log('- Expires in:', data.expires_in, 'seconds');
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ Authentication failed:', response.status);
            console.error('Error details:', errorText);
            
            // Common error messages
            if (response.status === 401) {
                console.error('💡 This usually means invalid API credentials');
            } else if (response.status === 403) {
                console.error('💡 This usually means API key/secret mismatch');
            } else if (response.status === 429) {
                console.error('💡 Rate limit exceeded. Try again later.');
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ Network error:', error.message);
        
        if (error.message.includes('CORS')) {
            console.error('💡 CORS error detected. This is common when testing from browser.');
            console.error('💡 For production, you should use a server-side proxy.');
        }
        
        return false;
    }
}

// Make it globally available
window.testAmadeusAPI = testAmadeusAPI;

console.log('🔧 API Test utility loaded. Run testAmadeusAPI() in console to test your credentials.');
