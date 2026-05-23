const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },

    offer: {
      type: Number, 
      min: 0,
      max: 100,
      default: 0,
    },
    style: {
      type: String,
      enum: ['Mens', 'Womens', ''],
      default: '',
      trim: true
    },
    isdelete: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
  }
);

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
