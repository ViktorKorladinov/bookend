const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const JWT = require('jsonwebtoken');
const {JWT_SECRET, CLIENT_ID} = require('../config/keys');
const passport = require("passport");
require('../config/passport')(passport);
const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(CLIENT_ID);

//User model
const User = require('../models/User');

//Verify the token received when the user signs in through Google with their own library
async function verify(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID,
    });
    return ticket.getPayload();

}


signToken = user => {
    return JWT.sign({
        name: user.name,
        roles: user.roles,
        iss: 'Bookend',
        sub: user._id,
        iat: new Date().getTime(),
        exp: new Date().setDate(new Date().getDate() + 30)
    }, JWT_SECRET)
};

//Register a new user
router.post('/register', (req, res) => {
    const {firstName, surname, email, password, password2} = req.body;
    let errors = [];

    if (!surname || !firstName || !email || !password || !password2) {
        errors.push({msg: 'Please fill in all fields'});
    }

    //Check if pass and pass2 match
    if (password !== password2) {
        errors.push({msg: 'Passwords do not match'});
    }

    //Check pass length
    if (password.length < 6) {
        errors.push({msg: 'Password should be at least 6 characters'});
    }
    if (errors.length > 0) {
        res.status(400).json(errors);
    } else {
        //Validation passed
        User.findOne({email: email})
            .then(user => {
                if (user) {
                    errors.push({msg: 'User with such email already exists'});
                    res.status(400).json(errors);
                } else {
                    const newUser = new User({firstName, surname, email, password});
                    //Hash Password
                    bcrypt.genSalt(10, (err, salt) => {
                        if (err) throw err;
                        bcrypt.hash(newUser.password, salt, (err, hash) => {
                            if (err) throw err;

                            //Set password to salted hash
                            newUser.password = hash;

                            //Save user
                            newUser.save()
                                .then(() => {
                                    const token = signToken(newUser);
                                    res.status(201).json({token})
                                })
                        })
                    });
                }
            });
    }

});

//Login
router.post('/login', (req, res) => {
    const {email, password} = req.body;
    let errors = [];
    if (!email || !password) {
        errors.push({msg: 'Please fill in all fields'});
    }
    if (errors.length > 0) {
        res.status(400).json(errors);
    } else {
        User.findOne({email: email})
            .then(user => {
                if (user) {
                    bcrypt.compare(password, user.password)
                        .then(ress => {
                            if (ress) {
                                const token = signToken(user);
                                res.status(200).json({token})
                            } else {
                                errors.push({msg: 'Incorrect password!'});
                                res.status(401).json(errors)
                            }
                        }).catch(error => console.log(error));

                } else {
                    errors.push({msg: "That user doesn't exist"});
                    res.status(400).json(errors)
                }
            });

    }
});

//Google Authorization
router.post('/google', (req, res) => {
    let errors = [];
    verify(req.body.tokenId).then(payload => {
        User.findOne({email: payload['email']}).then(user => {
            if (user) {
                const token = signToken(user);
                res.json({token})
            } else {
                let user = -1;
                switch (payload['hd']) {
                    case "student.gyarab.cz":
                        user = new User({
                            firstName: payload['given_name'],
                            surname: payload['family_name'],
                            email: payload['email'],
                            role: 'student',
                            pic: payload['picture']
                        });
                        user.save();
                        res.status(201).json({token: signToken(user)});
                        break;
                    case "gyarab.cz":
                        user = new User({
                            firstName: payload['given_name'],
                            surname: payload['family_name'],
                            email: payload['email'],
                            role: 'bookBender'
                        });
                        user.save();
                        break;
                }
                if (user !== -1) res.status(201).json(user);
                else {
                    errors.push({msg: 'You need to log in with your school mail!'});
                    res.status(403).json(errors)
                }

            }
        });
    });
});

router.get('/debt', passport.authenticate('jwt', {session: false}), (req, res) => {
    user = req.user;
    delete user["password"];
    res.json(user)
});


module.exports = router;
