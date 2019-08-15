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
    }
});

UserSchema.virtual('name').get(function () {
    return `${this.firstName} ${this.surname}`
});

const User = mongoose.model('User', UserSchema);
module.exports = User;