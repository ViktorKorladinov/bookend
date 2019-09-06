const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    surname: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: false
    },
    date: {
        type: Date,
        default: Date.now
    },
    roles: {
        type: Array,
        default: ['student']
    },
    reserved: {
        type: Array,
        default: [],
    },
    borrowed: {
        type: Array,
        default: [],
    },
    pic: {
        type: String,
        default: 'https://secure.gravatar.com/avatar/a9c4b67c3215e89b9007c5fd184e2d2e?s=96&d=mm&r=g'
    }
}, {toJSON: {virtuals: true}});

UserSchema.virtual('name').get(function () {
    return `${this.firstName} ${this.surname}`
});

const User = mongoose.model('User', UserSchema);
module.exports = User;