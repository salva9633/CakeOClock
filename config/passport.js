const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userModel");
require("dotenv").config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "http://localhost:3000/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value || null;

                let user = await User.findOne({
                    $or: [{ googleId: profile.id }, { email }]
                });

                if (!user) {
                    user = new User({
                        name: profile.displayName,
                        email,
                        googleId: profile.id,
                        isVerified: true
                    });
                    await user.save();
                }

                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

// ✅ correct
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// ✅ correct
passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => done(null, user))
        .catch(err => done(err, null));
});

module.exports = passport;
