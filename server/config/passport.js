const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const { dbOperations } = require('./database');
const logger = require('../utils/logger');

const setupPassport = (app) => {
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize and deserialize user for session management
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await dbOperations.findUserById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // JWT Strategy for API authentication
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    algorithms: ['HS256']
  }, async (payload, done) => {
    try {
      const user = await dbOperations.findUserById(payload.userId);
      if (user && user.status === 'active') {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      logger.error('JWT Strategy Error:', error);
      return done(error, false);
    }
  }));

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await dbOperations.findUserByEmail(profile.emails[0].value);
        
        if (user) {
          // Update social login info
          await dbOperations.query(
            `INSERT INTO social_logins (user_id, provider, provider_id, provider_data)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (provider, provider_id) DO UPDATE SET
             provider_data = $4`,
            [user.id, 'google', profile.id, {
              accessToken,
              refreshToken,
              profile: profile._json
            }]
          );
          return done(null, user);
        }

        // Create new user
        user = await dbOperations.createUser({
          email: profile.emails[0].value,
          first_name: profile.name.givenName,
          last_name: profile.name.familyName,
          role: 'job_seeker',
          email_verified: true
        });

        // Create social login record
        await dbOperations.query(
          `INSERT INTO social_logins (user_id, provider, provider_id, provider_data)
           VALUES ($1, $2, $3, $4)`,
          [user.id, 'google', profile.id, {
            accessToken,
            refreshToken,
            profile: profile._json
          }]
        );

        return done(null, user);
      } catch (error) {
        logger.error('Google OAuth Error:', error);
        return done(error, null);
      }
    }));
  }

  // LinkedIn OAuth Strategy
  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    passport.use(new LinkedInStrategy({
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: "/api/auth/linkedin/callback",
      scope: ['r_emailaddress', 'r_liteprofile']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await dbOperations.findUserByEmail(email);
        
        if (user) {
          await dbOperations.query(
            `INSERT INTO social_logins (user_id, provider, provider_id, provider_data)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (provider, provider_id) DO UPDATE SET
             provider_data = $4`,
            [user.id, 'linkedin', profile.id, {
              accessToken,
              refreshToken,
              profile: profile._json
            }]
          );
          return done(null, user);
        }

        user = await dbOperations.createUser({
          email,
          first_name: profile.name.givenName,
          last_name: profile.name.familyName,
          role: 'job_seeker',
          email_verified: true
        });

        await dbOperations.query(
          `INSERT INTO social_logins (user_id, provider, provider_id, provider_data)
           VALUES ($1, $2, $3, $4)`,
          [user.id, 'linkedin', profile.id, {
            accessToken,
            refreshToken,
            profile: profile._json
          }]
        );

        return done(null, user);
      } catch (error) {
        logger.error('LinkedIn OAuth Error:', error);
        return done(error, null);
      }
    }));
  }
};

module.exports = { setupPassport };