import { DataTypes } from 'sequelize';
import sequelize from '../../config/database.mjs';

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bookingReference: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  bookingDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  customerName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  passengers: {
    type: DataTypes.JSON,
    allowNull: false
  },
  flight: {
    type: DataTypes.JSON,
    allowNull: false
  },
  originalApiPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  displayedWebsitePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentStatus: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'pending'
  },
  transactionId: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  bookingStatus: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  internalNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'bookings',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      unique: true,
      fields: ['bookingReference']
    }
  ]
});

export default Booking;
