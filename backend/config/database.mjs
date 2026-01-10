import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Create Sequelize instance with MySQL connection
const sequelize = new Sequelize(
  process.env.DB_NAME || 'thefinalseat',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      max: parseInt(process.env.DB_POOL_MAX) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000
    },
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: false
    }
  }
);

// Test database connection
export const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    console.error('Please check your MySQL credentials in the .env file');
    return false;
  }
};

// Sync database (use with caution in production)
export const syncDatabase = async (force = false) => {
  try {
    if (force) {
      console.log('⚠️  Force syncing database - all data will be lost!');
    }
    await sequelize.sync({ force, alter: !force });
    console.log('✅ Database synchronized successfully.');
    return true;
  } catch (error) {
    console.error('❌ Error synchronizing database:', error.message);
    return false;
  }
};

export { sequelize };
export default sequelize;
