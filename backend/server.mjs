import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Import Supabase connection test
import { testSupabaseConnection } from './config/supabase.mjs';

// Import routes
import routes from './routes/index.mjs';

const app = express();
const PORT = process.env.PORT || 5001;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  // Test Supabase connection on startup
  const connected = await testSupabaseConnection();
  if (!connected) {
    console.warn('⚠️  Supabase connection test failed. Check SUPABASE_URL and SUPABASE_SECRET_KEY.');
    console.warn('    The server will still start. Run the migration SQL in your Supabase dashboard.');
  }

  app.listen(PORT, () => {
    console.log('\n🚀 The Final Seat Backend Started!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log(`🗄️  Database: Supabase PostgreSQL`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('═══════════════════════════════════════════════════\n');
  });
};

startServer();
