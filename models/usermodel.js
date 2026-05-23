const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2'); 
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true, 
    lowercase: true 
  },
  name:{
    type:String,
    
  },
  googleId:{
    type:String,
    unique:true,
    sparse:true
  },
  password: {
    type: String,
    required: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  isBlock:{
    type:Boolean,
    default:false
  },
  image:{
    type:[String],
  },
  referralCode: {
    type: String,
    unique: true,
    default: () => Math.random().toString(36).substring(2,8).toUpperCase()
  }
},{timestamps:true});

userSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('User', userSchema);