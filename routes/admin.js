const express = require('express');
const router = express.Router();
const passport = require("passport");
require('../config/passport')(passport);
const {teacherLendingDays, studentLendingDays} = require("../config/config");

//Book model
const Book = require('../models/Book');
//User model
const User = require('../models/User');


//Get all taken books
router.get('/all', passport.authenticate('jwt', {session: false}), async (req, res) => {
    let book = await Book.find({state:{ $in: [ 'borrowed', 'reserved' ] }});
    book = book.filter(book => {
        return book.status !== 'available'
    });
    res.json(book)
});

//Search taken books
router.get('/search/:type/:phrase', passport.authenticate('jwt', {session: false}), async (req, res) => {
    let book = await Book.find({[req.params.type]: new RegExp(req.params.phrase, "i")});
    book = book.filter(book => {
        return book.status !== 'available'
    });
    if (book.length > 0) {
        res.json(book)
    } else res.status(400).json([{msg: `No taken books matching the selection`}]);
});

//Get all users that have currently borrowed books
router.get('/users/:type', async (req, res) => {
    let user = await User.find({[req.params.type]: {$exists: true, $ne: []}});
    res.json(user)

});


//Lend a book
router.post('/lend', passport.authenticate('jwt', {session: false}), async (req, res) => {
    let errors = [];
    let books = [];
    let user = await User.findOne({email: req.body.email});
    // Check if the user who is borrowing the books exists
    if (user) {
        Promise.all(req.body.idArr.map(async id => {
            //Try to find the book by the id provided in idArr and check its status
            let book = await Book.findById(id);
            //If the book exists
            if (book) {
                // noinspection FallThroughInSwitchStatementJS
                switch (book.status) {
                    //If already borrowed(can be overdue), return an error that the user can't borrow a book already taken
                    case 'borrowed':
                    case 'overdue':
                        errors.push({msg: `${book.title} is currently lent to another user.`});
                        break;
                    //If reserved, check if it's reserved by the student who tries to borrow it; proceed only if it is.
                    case 'reserved':
                        if (book.borrowerId !== user.id) {
                            errors.push({msg: `${book.title} is currently reserved for another user.`});
                            break;
                        }
                    //In case it's available or reserved by the borrower, lend it.
                    case 'available':
                        book.state = 'borrowed';
                        book.lastAccessed = Date.now();
                        book.borrower = user.name;
                        book.borrowerId = user._id;
                        //Teachers have 60 days to read it, students 30. Can be changed in the config file.
                        if (req.user.roles.includes('teacher')) {
                            book.returnDate = addDays(Date.now(), teacherLendingDays);
                        } else {
                            book.returnDate = addDays(Date.now(), studentLendingDays);
                        }
                        //push the updated info for the book to an array which is going to get sent
                        books.push(book);
                        //push the title of the book to an array in the User model, for convenience
                        user.borrowed.push({id: book.id, title: book.title});
                        book.save();
                        break;
                }
            } else errors.push({msg: `Couldn't find such a book`})
        })).then(async() => {
            user.save().then(()=>{
                if (errors.length > 0) {
                    res.status(400).json({errors, books});
                } else {
                    res.json({books})
                }});

        });
    } else res.status(400).json({errors: [{msg: 'No such user!'}]});
});

//Return a book
router.post('/return', passport.authenticate('jwt', {session: false}), async (req, res) => {
    let errors = [];
    let resultBooks = [];
    let errorCode = 400;
    let bookIds = req.body.idArr;
    let authErr = () => {
        errorCode = 401;
        errors.push({msg: `You don't have the authorization level required`})
    };

    for await (const bookId of bookIds) {

        try {
            let book = await Book.findById(bookId.id);
            let user = await User.findById(book.borrowerId);
            switch (book.status) {
                case 'available':
                    errors.push({msg: `${book.title} isn't reserved nor borrowed`});
                    break;
                case  'borrowed' :
                    if (req.user.roles.includes('teacher')) {
                        book.state = 'available';
                        resultBooks.push(book);
                        if (user) {
                            user.borrowed = user.borrowed.filter(infoItem => infoItem.id !== book.id);
                            await user.save();
                        }
                        book.save();

                    } else authErr();
                    break;
                case 'reserved':
                    if (req.user.roles.includes('teacher') || book.borrowerId === req.user.id) {
                        book.state = 'available';
                        resultBooks.push(book);
                        if (user) {
                            user.reserved = user.reserved.filter(infoItem => infoItem.id !== book.id);
                            await user.save();
                        }
                        book.save();

                    } else authErr();
            }
        } catch (e) {
            console.log(e.message);
        }
    }
    if (errors.length > 0) res.status(errorCode).json({errors, books: resultBooks});
    else res.json({books: resultBooks});
});


addDays = (date, days) => {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

module.exports = router;