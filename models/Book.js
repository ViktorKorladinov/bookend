const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    genres:{
        type: Array,
        required: true
    },
    available: {
        type: Boolean,
        default: true
    },
    dateAdded: {
        type: Date,
        default: Date.now
    },
    datePublished: {
        type: String,
    },
    numberOfPages: {
        type: String,
    }
});
const Book = mongoose.model('Book', BookSchema);
module.exports = Book;