require('dotenv').config(); // Load env first
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/usermodel');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    proxy: true // Add this if using reverse proxy (e.g., Nginx)
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ 
            $or: [
                { googleId: profile.id },
                { email: profile.emails && profile.emails[0].value }
            ].filter(condition => condition.email !== undefined) 
        });

        if (!user) {
            user = new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails ? profile.emails[0].value : undefined,
                image: profile.photos ? [profile.photos[0].value] : [],
                isVerified: true
            });
            await user.save();
        } else {
            // Update existing user with Google info if missing
            let updated = false;
            if (!user.googleId) {
                user.googleId = profile.id;
                updated = true;
            }
            if (!user.image || user.image.length === 0) {
                if (profile.photos && profile.photos[0].value) {
                    user.image = [profile.photos[0].value];
                    updated = true;
                }
            }
            if (updated) {
                await user.save();
            }
        }
        
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}));

module.exports = passport;