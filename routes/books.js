const express = require('express');
const router = express.Router();
const passport = require("passport");
const bookWorm = require("../scrapers/bookWorm");
const hash = require('object-hash');
const multer = require("multer");
const path = require('path');
const storage = multer.diskStorage({
    destination: path.join(__dirname, '../public/images'),
    filename: function (req, file, cb) {
        let imgName = "";
        Book.findOne({_id: req.params.bookId}, (err, data) => {
            if (err) throw err;
            else cb(null, data.ISBN + path.extname(file.originalname))
        });

    }
});
const upload = multer({storage: storage});
const {borrowDays, teacherLendingDays, studentLendingDays} = require("../config/config");

//Book model
const Book = require('../models/Book');

//Get All Books
router.get('/all/:sort', async (req, res) => {
    let data = await Book.find({}).sort((req.params.sort));
    if (data.length > 0) {
        res.json(data)
    } else res.status(400).json([{msg: `There are no books currently in the system.`}]);
});


//Get Books by Partial or Full Title
router.get('/search/:type/:t', (req, res) => {
    Book.find({[req.params.type]: new RegExp(req.params.t, "i")}, (err, data) => {
        if (err) throw err;
        if (data.length > 0) res.json(data);
        else res.status(400).json([{msg: `There is no book with ${req.params.type} ${req.params.t} in the database`}]);
    })
});

//Provide a selection of books with the searched parameters
router.post('/prePost', (req, res) => {
    const {title, author, index} = req.body;
    if (!title && !author) {
        res.status(400).json([{"msg": "Title/ Author fields is required"}])
    } else {
        let limit = index || 4;
        // const newBook = new Book({title, author, available: true});
        bookWorm.dig(title, limit).then(json => res.json(json));
        // newBook.save();

    }
});

//Save the book chosen form the prePost selection
router.post('/post/url', (req, res) => {
    const {url} = req.body;
    if (url) {
        bookWorm.parseBook(url).then(json => {
            if (json.success) {
                let book = json.book;
                let title = book.title;
                const newBook = new Book(book);
                newBook.save();
                res.json({title: title, type: 'By Title'})
            } else res.status(400).json([{msg: book.msg}])
        })
    } else {
        res.status(400).json([{"msg": "You need to choose a book!"}])
    }
});

//Find and save a book by its ISBN
router.post('/post/ISBN', (req, res) => {
    const {ISBN} = req.body;
    if (ISBN) {
        bookWorm.digISBN(ISBN).then(json => {
            if (json.success) {
                let book = json.book;
                let title = book.title;
                const newBook = new Book(book);
                newBook.save();
                res.json({title: title, type: 'ISBN'})
            } else res.status(400).json([{msg: book.msg}])
        })
    } else {
        res.status(400).json([{"msg": "ISBN field is required"}])
    }
});

//Save a custom book
router.post('/post/custom', (req, res) => {
    let errors = [];
    const book = req.body;
    let title = book.title;

    if (book.ISBN === '') book.ISBN = hash({title: title});

    Object.keys(book).forEach((key) => {
        if (book[key] === "") errors.push([{msg: key + 'is required'}]);
    });
    if (errors.length > 0) {
        res.status(400).json(errors);
    } else {
        const newBook = new Book(book);
        newBook.save();
        res.json({title: title, type: 'custom', id: newBook._id})
    }
});

router.post('/post/custom/:bookId', upload.single('photo'), (req, res) => {
    let file = req.file;
    Book.findOneAndUpdate({_id: req.params.bookId}, {extension: path.extname(file.originalname)}, (err, data) => {
        if (err) throw err;
        else
            imgName = data.ISBN;
        res.json([{msg: 'Hey'}]);
    });


});


//Update a Book
router.put('/id/:id', (req, res) => {
    if (!req.body.length > 0) {
        res.status(418).json([{"msg": "All fields are empty; Nothing to update."}])
    } else {
        Book.findOneAndUpdate({_id: req.params.id}, {...req.body}, {new: true},
            (err, data) => {
                if (err) res.status(500).json([{msg: 'Internal error'}]);
                if (data) {
                    res.json(data)
                } else {
                    res.status(400).json([{msg: 'The requested book is not in the database'}])
                }
            })
    }
});

//Reserve a book
router.get('/reserve/:id', passport.authenticate('jwt', {session: false}), (req, res) => {
    Book.findById(req.params.id, (err, data) => {
        if (data) {
            if (data.status !== 'available') {
                res.status(400).json([{msg: `${data.title} is not available!`}])
            } else {
                data.lastAccessed = Date.now();
                data.state = 'reserved';
                data.borrower = req.user.firstName + " " + req.user.surname;
                data.borrowerId = req.user._id;
                res.json([{msg: `You have ${borrowDays} days to collect the book.`}]);
                data.save();
            }
        } else res.status(400).json([{msg: "This book isn't in our database"}]);
    });
});

//Borrowed a book
router.get('/borrow/:id', passport.authenticate('jwt', {session: false}), (req, res) => {
    Book.findById(req.params.id, (err, data) => {
        if (data) {
            // noinspection FallThroughInSwitchStatementJS
            switch (data.status) {
                case 'borrowed':
                case 'overdue':
                    res.status(400).json([{msg: `${data.title} is currently lent to another user.`}]);
                    break;
                case 'reserved':
                    if (parseInt(data.borrowerId) !== parseInt(req.user._id)) {
                        res.status(400).json([{msg: `${data.title} is currently reserved for another user.`}]);
                        break;
                    }
                case 'available':
                    data.state = 'borrowed';
                    data.lastAccessed = Date.now();
                    data.borrower = req.user.firstName + " " + req.user.surname;
                    data.borrowerId = req.user._id;
                    if (req.user.roles.includes('teacher')) {
                        data.returnDate = addDays(Date.now(), teacherLendingDays);
                        res.json([{msg: `You have ${teacherLendingDays} days to read the book`}]);
                    } else {
                        data.returnDate = addDays(Date.now(), studentLendingDays);
                        res.json([{msg: `You have ${studentLendingDays} days to read the book`}]);
                    }
                    data.save();
                    break;

            }
        } else res.status(400).json([{msg: "This book isn't in our database"}]);
    });
});


//Return a book
router.get('/return/:id', passport.authenticate('jwt', {session: false}), async (req, res) => {
    let book = await Book.findById(req.params.id);
    if (book.status !== 'available') {
        if (req.user.roles.includes('teacher') || parseInt(book.borrowerId) === parseInt(req.user._id)) {
            book.state = 'available';
            book.save();
            res.json([{msg: "returned"}]);
        } else res.status(401).json([{msg: 'You are not allowed to return this book'}])
    } else res.status(400).json([{msg: `${book.title} isn't reserved nor borrowed`}]);
});

addDays = (date, days) => {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

module.exports = router;