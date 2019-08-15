const mongoose = require('mongoose');
const {borrowDays, teacherLendingDays, studentLendingDays} = require("../config/config");


const BookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    desc: {
        type: String,
    },
    genres: {
        type: Array,
        required: true
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
    },
    ISBN: {
        type: String,
        required: true,
    },
    extension: {
        type: String,
    },
    state: {
        type: String,
        default: 'available'
    },
    lastAccessed: {
        type: Date,
    },
    returnDate: {
        type: Date,
    },
    borrower: {
        type: String,
    },
    borrowerId: {
        type: String,
    },
}, {toJSON: {virtuals: true}});

BookSchema.virtual('status').get(function () {
    switch (this.state) {
        case 'available':
            return 'available';
        case 'reserved':
            if (Date.now() > addDays(this.lastAccessed, borrowDays)) {
                return 'available'
            } else return 'reserved';
        case 'borrowed':
            if (Date.now() > this.returnDate) return 'overdue';
            else return 'borrowed'
    }
});
addDays = (date, days) => {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const Book = mongoose.model('Book', BookSchema);
module.exports = Book;