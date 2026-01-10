# Razorpay Integration Setup Guide

## 🚀 **Quick Setup Steps**

### **1. Get Your Razorpay Credentials**

#### **From Razorpay Dashboard:**
1. **Login** to your Razorpay Dashboard
2. **Go to** Settings → API Keys
3. **Copy** your Key ID and Key Secret
4. **Note**: Use Test keys for development, Live keys for production

### **2. Update Configuration**

#### **Edit `razorpay-config.js`:**
```javascript
const RAZORPAY_CONFIG = {
    // Replace with your actual Key ID
    keyId: 'rzp_live_YOUR_KEY_ID', // For production
    // keyId: 'rzp_test_YOUR_KEY_ID', // For testing
    
    // Set your currency
    currency: 'USD', // or 'EUR', 'GBP', 'INR', etc.
    
    // Your company name
    companyName: 'Urgent Travel',
    
    // Payment options
    options: {
        international: true,
        method: {
            netbanking: true,
            wallet: true,
            emi: true,
            upi: true,
            card: true
        },
        theme: {
            color: '#8B1538' // Your brand color
        }
    }
};
```

### **3. Backend Integration (Required for Production)**

#### **Create Order API Endpoint:**
```javascript
// Example Node.js/Express endpoint
app.post('/api/create-order', async (req, res) => {
    try {
        const { amount, currency, receipt } = req.body;
        
        const order = await razorpay.orders.create({
            amount: amount * 100, // Convert to paise/cents
            currency: currency,
            receipt: receipt,
            notes: {
                booking_type: 'flight_booking'
            }
        });
        
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

#### **Verify Payment API Endpoint:**
```javascript
// Verify payment signature
app.post('/api/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        
        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET);
        hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');
        
        if (generated_signature === razorpay_signature) {
            // Payment verified successfully
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### **4. Update Frontend Configuration**

#### **Replace Mock Order Creation:**
```javascript
// In razorpay-config.js, replace the mock order creation with:
async function createRazorpayOrder(amount, currency = 'USD') {
    try {
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount,
                currency: currency,
                receipt: 'UT_' + Date.now()
            })
        });
        
        const order = await response.json();
        return order;
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
}
```

## 🔧 **Configuration Options**

### **Payment Methods:**
```javascript
method: {
    netbanking: true,  // Net Banking
    wallet: true,      // Digital Wallets
    emi: true,         // EMI Options
    upi: true,         // UPI Payments
    card: true         // Credit/Debit Cards
}
```

### **International Payments:**
```javascript
options: {
    international: true,  // Enable international cards
    currency: 'USD',      // Set currency
    // Supported currencies: USD, EUR, GBP, INR, etc.
}
```

### **Theme Customization:**
```javascript
theme: {
    color: '#8B1538',     // Brand color
    backdrop_color: '#f6f6f6',  // Background color
    hide: ['.rzp-checkout']     // Hide elements
}
```

## 🧪 **Testing**

### **Test Cards:**
```
Visa: 4111 1111 1111 1111
Mastercard: 5555 5555 5555 4444
American Express: 3782 822463 10005
```

### **Test Details:**
```
CVV: Any 3 digits
Expiry: Any future date
Name: Any name
```

## 🔒 **Security Best Practices**

### **1. Never Expose Secret Key:**
- Keep your Razorpay Secret Key on the backend only
- Never include it in frontend code

### **2. Verify Payments:**
- Always verify payment signatures on your backend
- Don't trust frontend payment confirmations alone

### **3. Use HTTPS:**
- Ensure your website uses HTTPS in production
- Razorpay requires HTTPS for live payments

### **4. Validate Amounts:**
- Always validate payment amounts on your backend
- Prevent amount tampering

## 📱 **Mobile Optimization**

### **Responsive Design:**
```javascript
options: {
    modal: {
        ondismiss: function() {
            console.log('Payment cancelled');
        }
    },
    // Mobile-specific options
    mobile: {
        theme: {
            color: '#8B1538'
        }
    }
}
```

## 🌍 **International Support**

### **Supported Countries:**
- **India**: Full support
- **International**: USD, EUR, GBP currencies
- **Cards**: Visa, Mastercard, American Express

### **Currency Configuration:**
```javascript
// For different markets
const currencyConfig = {
    'US': 'USD',
    'EU': 'EUR', 
    'UK': 'GBP',
    'IN': 'INR'
};
```

## 🚨 **Common Issues & Solutions**

### **1. "Invalid Key ID" Error:**
- Check if you're using the correct Key ID
- Ensure you're using Test keys for testing

### **2. "Payment Failed" Error:**
- Check if the amount is in the correct format (paise/cents)
- Verify currency is supported

### **3. "Signature Verification Failed":**
- Ensure you're using the correct Secret Key
- Check the signature generation logic

### **4. "Order Not Found" Error:**
- Verify the order ID is correct
- Check if the order was created successfully

## 📊 **Analytics & Monitoring**

### **Track Payment Events:**
```javascript
// Track successful payments
razorpay.on('payment.success', function(response) {
    // Send to analytics
    gtag('event', 'purchase', {
        transaction_id: response.razorpay_payment_id,
        value: amount,
        currency: currency
    });
});
```

### **Monitor Failed Payments:**
```javascript
razorpay.on('payment.failed', function(response) {
    // Log failed payment
    console.error('Payment failed:', response);
});
```

## 🎯 **Production Checklist**

- [ ] Replace test Key ID with live Key ID
- [ ] Set up backend API endpoints
- [ ] Implement payment verification
- [ ] Test with real cards (small amounts)
- [ ] Set up webhook notifications
- [ ] Configure refund handling
- [ ] Set up payment analytics
- [ ] Test mobile responsiveness
- [ ] Verify HTTPS is enabled
- [ ] Test international payments

## 📞 **Support**

- **Razorpay Documentation**: https://razorpay.com/docs/
- **API Reference**: https://razorpay.com/docs/api/
- **Support**: support@razorpay.com
- **Status Page**: https://status.razorpay.com/

---

**Ready to start receiving real payments! 🚀💳**

