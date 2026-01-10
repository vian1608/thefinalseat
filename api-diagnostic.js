// Enhanced API Diagnostic Tool
// This will help identify the exact authentication issue

async function diagnoseAPI() {
    console.log('🔍 Starting comprehensive API diagnosis...');
    
    // Step 1: Check if all scripts are loaded
    console.log('\n📋 Step 1: Checking script loading...');
    const scripts = ['API_CONFIG', 'getAmadeusConfig', 'validateAPIConfig', 'flightAPI'];
    scripts.forEach(script => {
        const exists = typeof window[script] !== 'undefined';
        console.log(`${exists ? '✅' : '❌'} ${script}: ${exists ? 'Loaded' : 'Missing'}`);
    });
    
    // Step 2: Check configuration
    console.log('\n📋 Step 2: Checking configuration...');
    if (typeof getAmadeusConfig === 'function') {
        const config = getAmadeusConfig();
        console.log('✅ Configuration loaded');
        console.log('- API Key length:', config.apiKey ? config.apiKey.length : 0);
        console.log('- API Secret length:', config.apiSecret ? config.apiSecret.length : 0);
        console.log('- Environment:', config.environment);
        console.log('- Base URL:', config.baseURL);
        
        // Validate credentials
        if (!config.apiKey || config.apiKey === 'YOUR_AMADEUS_API_KEY') {
            console.error('❌ API Key not configured');
            return false;
        }
        if (!config.apiSecret || config.apiSecret === 'YOUR_AMADEUS_API_SECRET') {
            console.error('❌ API Secret not configured');
            return false;
        }
    } else {
        console.error('❌ Configuration function not available');
        return false;
    }
    
    // Step 3: Test authentication
    console.log('\n📋 Step 3: Testing authentication...');
    try {
        const config = getAmadeusConfig();
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
        
        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Authentication successful!');
            console.log('- Token length:', data.access_token ? data.access_token.length : 0);
            console.log('- Expires in:', data.expires_in, 'seconds');
            
            // Step 4: Test flight search endpoint
            console.log('\n📋 Step 4: Testing flight search endpoint...');
            
            // Use a future date (30 days from now)
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            const dateString = futureDate.toISOString().split('T')[0];
            
            console.log('📅 Using future date:', dateString);
            
            const searchResponse = await fetch(`${config.baseURL}/v2/shopping/flight-offers?originLocationCode=IAD&destinationLocationCode=LAX&departureDate=${dateString}&adults=1&max=5`, {
                headers: {
                    'Authorization': `Bearer ${data.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('📡 Search response status:', searchResponse.status);
            
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                console.log('✅ Flight search successful!');
                console.log('- Offers found:', searchData.data ? searchData.data.length : 0);
                console.log('- Meta count:', searchData.meta ? searchData.meta.count : 'N/A');
            } else {
                const errorText = await searchResponse.text();
                console.error('❌ Flight search failed:', searchResponse.status);
                console.error('Error details:', errorText);
            }
            
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ Authentication failed:', response.status);
            console.error('Error details:', errorText);
            
            // Common error analysis
            if (response.status === 401) {
                console.error('💡 This usually means invalid API credentials');
                console.error('💡 Check your API Key and Secret in api-config.js');
            } else if (response.status === 403) {
                console.error('💡 This usually means API key/secret mismatch');
                console.error('💡 Verify both credentials are correct');
            } else if (response.status === 429) {
                console.error('💡 Rate limit exceeded. Try again later.');
            } else if (response.status === 0) {
                console.error('💡 CORS error - this is common when testing from file://');
                console.error('💡 Try running from a local server: python3 -m http.server 8000');
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ Network error:', error.message);
        
        if (error.message.includes('CORS')) {
            console.error('💡 CORS error detected');
            console.error('💡 Solution: Run from local server instead of file://');
            console.error('💡 Command: python3 -m http.server 8000');
            console.error('💡 Then visit: http://localhost:8000');
        } else if (error.message.includes('Failed to fetch')) {
            console.error('💡 Network connectivity issue');
            console.error('💡 Check your internet connection');
        }
        
        return false;
    }
}

// Quick test function
async function quickTest() {
    console.log('⚡ Quick API Test...');
    
    if (typeof validateAPIConfig === 'function') {
        const isValid = validateAPIConfig();
        console.log('Config validation:', isValid ? '✅ Valid' : '❌ Invalid');
    }
    
    if (typeof window.flightAPI !== 'undefined') {
        try {
            const token = await window.flightAPI.getAccessToken();
            console.log('Token test:', token ? '✅ Success' : '❌ Failed');
        } catch (error) {
            console.error('Token test failed:', error.message);
        }
    } else {
        console.error('❌ flightAPI not available');
    }
}

// Make functions globally available
window.diagnoseAPI = diagnoseAPI;
window.quickTest = quickTest;

console.log('🔧 Enhanced diagnostic tools loaded!');
console.log('Run diagnoseAPI() for comprehensive analysis');
console.log('Run quickTest() for quick check');
