# Urgent Travel - Flight Booking Application

A full-stack flight booking application with React frontend and Express.js backend.

## Project Structure

```
Urgent-travel/
├── backend/          # Express.js backend API
│   ├── config/       # Configuration files
│   ├── routes/       # API routes
│   ├── services/     # Business logic services
│   ├── server.js     # Express server entry point
│   └── package.json  # Backend dependencies
│
├── frontend/         # React frontend application
│   ├── public/       # Static files
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API service layer
│   │   └── styles/      # CSS styles
│   └── package.json     # Frontend dependencies
│
└── [original files]  # Original HTML/JS files (kept for reference)
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Amadeus API credentials (get from https://developers.amadeus.com/)

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory:
```bash
cp .env.example .env
```

4. Update the `.env` file with your credentials:
```env
PORT=5000
NODE_ENV=development

# Amadeus API Configuration
AMADEUS_API_KEY=your_amadeus_api_key
AMADEUS_API_SECRET=your_amadeus_api_secret
AMADEUS_ENVIRONMENT=test

# JWT Secret for Authentication
JWT_SECRET=your-super-secret-jwt-key

# Razorpay Configuration (optional)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@urgenttravel.com

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

5. Start the backend server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the frontend directory (optional):
```env
REACT_APP_API_URL=http://localhost:5000/api
```

4. Start the React development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Running the Application

1. **Start the backend server** (in one terminal):
```bash
cd backend
npm start
```

2. **Start the frontend server** (in another terminal):
```bash
cd frontend
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## API Endpoints

### Flights
- `POST /api/flights/search` - Search for flights
- `GET /api/airports/search?q=query` - Search for airports

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify JWT token

### Bookings
- `POST /api/bookings` - Create a new booking
- `GET /api/bookings/user/:userId` - Get user bookings
- `GET /api/bookings/:reference` - Get booking by reference

### Payments
- `POST /api/payments/razorpay/create-order` - Create Razorpay order
- `POST /api/payments/razorpay/verify` - Verify Razorpay payment

### Admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/bookings` - Get all bookings
- `GET /api/admin/stats` - Get booking statistics

## Features

- ✈️ Flight search with Amadeus API integration
- 🔐 User authentication (JWT-based)
- 📱 Responsive design
- 💳 Payment integration (Razorpay)
- 📧 Email notifications
- 👨‍💼 Admin dashboard
- 🎨 Modern UI with Qatar Airways-inspired design

## Technologies Used

### Backend
- Express.js
- Axios (for API calls)
- bcryptjs (password hashing)
- jsonwebtoken (JWT authentication)
- nodemailer (email sending)
- razorpay (payment gateway)

### Frontend
- React
- React Router
- Axios
- Font Awesome icons

## Development Notes

- The backend uses in-memory storage for users and bookings. In production, replace with a database (MongoDB, PostgreSQL, etc.)
- Admin credentials are hardcoded in the backend. Change this in production.
- Email and payment configurations are optional but recommended for full functionality.

## Production Deployment

1. Build the React frontend:
```bash
cd frontend
npm run build
```

2. Serve the built files using a static file server or integrate with the Express backend.

3. Update environment variables for production.

4. Use a production-grade database instead of in-memory storage.

5. Set up proper error logging and monitoring.

## License

ISC
