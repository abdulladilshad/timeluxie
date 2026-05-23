const mongoose= require('mongoose');
const env = require ("dotenv").config()

const connectDB = async ()=>{
    try{
        const conn=await mongoose.connect(process.env.MONGODB_URI,{})
        console.log(`mongoDB Connected: ${conn.connection.host}`);
        
        // Seed default categories if none exist
        try {
            const Category = require('../models/categories');
            const count = await Category.countDocuments();
            if (count === 0) {
                await Category.insertMany([
                    { name: 'Mens', description: 'Mens Collection', style: 'Mens' },
                    { name: 'Womens', description: 'Womens Collection', style: 'Womens' }
                ]);
                console.log('Seeded default categories: Mens and Womens');
            }
        } catch (seedErr) {
            console.error('Error seeding categories:', seedErr);
        }

        // Drop the faulty googleId_1 index from the users collection
        try {
            await mongoose.connection.collection('users').dropIndex('googleId_1');
            console.log('Dropped faulty googleId_1 index');
        } catch (indexErr) {
            // Ignore if index doesn't exist
            if (indexErr.code !== 27) {
                console.error('Error dropping index:', indexErr.message);
            }
        }

        }catch (error){
            console.log(error)
            process.exit(1)
            
        }
      
        
}

module.exports=connectDB