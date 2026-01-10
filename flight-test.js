// Simple Flight Search Test
async function testFlightSearch() {
    console.log('🧪 Testing Flight Search...');
    
    try {
        // Get current config
        const config = getAmadeusConfig();
        console.log('📋 Config loaded:', config.baseURL);
        
        // Get fresh token
        console.log('🔑 Getting access token...');
        const tokenResponse = await fetch(`${config.baseURL}/v1/security/oauth2/token`, {
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
        
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ Token failed:', tokenResponse.status, errorText);
            return;
        }
        
        const tokenData = await tokenResponse.json();
        console.log('✅ Token received');
        
        // Test flight search with proper future date
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const dateString = futureDate.toISOString().split('T')[0];
        
        console.log('📅 Testing with date:', dateString);
        
        const searchUrl = `${config.baseURL}/v2/shopping/flight-offers?originLocationCode=IAD&destinationLocationCode=LAX&departureDate=${dateString}&adults=1&max=3`;
        console.log('🔍 Search URL:', searchUrl);
        
        const searchResponse = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Search response status:', searchResponse.status);
        
        if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            console.log('✅ Flight search successful!');
            console.log('📊 Results:', {
                offers: searchData.data ? searchData.data.length : 0,
                meta: searchData.meta || 'No meta',
                dictionaries: searchData.dictionaries ? 'Present' : 'Missing'
            });
            
            if (searchData.data && searchData.data.length > 0) {
                console.log('🛫 First flight:', searchData.data[0]);
            }
            
            return true;
        } else {
            const errorText = await searchResponse.text();
            console.error('❌ Search failed:', searchResponse.status);
            console.error('Error details:', errorText);
            
            // Parse error for more details
            try {
                const errorData = JSON.parse(errorText);
                console.error('Parsed error:', errorData);
            } catch (e) {
                console.error('Raw error text:', errorText);
            }
            
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Test with different routes
async function testMultipleRoutes() {
    console.log('🧪 Testing Multiple Routes...');
    
    const routes = [
        { from: 'IAD', to: 'LAX', name: 'Washington to Los Angeles' },
        { from: 'JFK', to: 'SFO', name: 'New York to San Francisco' },
        { from: 'ORD', to: 'DEN', name: 'Chicago to Denver' }
    ];
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateString = futureDate.toISOString().split('T')[0];
    
    for (const route of routes) {
        console.log(`\n🛫 Testing ${route.name} (${route.from} → ${route.to})`);
        
        try {
            const config = getAmadeusConfig();
            const tokenResponse = await fetch(`${config.baseURL}/v1/security/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: config.apiKey,
                    client_secret: config.apiSecret
                })
            });
            
            if (!tokenResponse.ok) {
                console.error('❌ Token failed for', route.name);
                continue;
            }
            
            const tokenData = await tokenResponse.json();
            
            const searchResponse = await fetch(`${config.baseURL}/v2/shopping/flight-offers?originLocationCode=${route.from}&destinationLocationCode=${route.to}&departureDate=${dateString}&adults=1&max=2`, {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`📡 ${route.name}: Status ${searchResponse.status}`);
            
            if (searchResponse.ok) {
                const data = await searchResponse.json();
                console.log(`✅ ${route.name}: ${data.data ? data.data.length : 0} flights found`);
            } else {
                const errorText = await searchResponse.text();
                console.error(`❌ ${route.name}: ${searchResponse.status} - ${errorText}`);
            }
            
        } catch (error) {
            console.error(`❌ ${route.name}: ${error.message}`);
        }
    }
}

// Make functions available
window.testFlightSearch = testFlightSearch;
window.testMultipleRoutes = testMultipleRoutes;

console.log('🔧 Flight search test tools loaded!');
console.log('Run testFlightSearch() for single test');
console.log('Run testMultipleRoutes() for multiple route tests');
