import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import database configuration
import { testConnection } from './config/database.mjs';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - All API endpoints consolidated in routes/index.mjs
import routes from './routes/index.mjs';
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize server and database connection
const startServer = async () => {
  // Test database connection before starting server
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.error('\n⚠️  Warning: Database connection failed. Server will start but database features may not work.');
    console.log('Please ensure MySQL is running and credentials in .env file are correct.\n');
  }

  app.listen(PORT, () => {
    console.log('\n🚀 Urgent Travel Backend Server Started!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('═══════════════════════════════════════════════════\n');
  });
};

// Start the server
startServer();
