const mongoose = require('mongoose');


const GenreSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        default: 1,
    },
});

const Genre = mongoose.model('Genre', GenreSchema);
module.exports = Genre;