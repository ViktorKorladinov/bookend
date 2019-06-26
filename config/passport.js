const JwtStrategy = require('passport-jwt').Strategy;
const {ExtractJwt} = require('passport-jwt');

const {JWT_SECRET} = require('./keys');

//Load User Model
const User = require('../models/User');


module.exports = passport => passport.use(
    new JwtStrategy({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET,
        issuer: 'Bookend'
    }, (payload, done) => {
        //Match User
        User.findOne({_id: payload.sub})
            .then(user => {
                if (user) return done(null, user);
                return done(null, false, {msg: "That user doesn't exist"});
            })
            .catch(err => console.log(err));
    })
);

