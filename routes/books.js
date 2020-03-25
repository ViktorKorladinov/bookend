const express = require('express');
const router = express.Router();
const passport = require("passport");
const bookWorm = require("../scrapers/bookWorm");
const hash = require('object-hash');
const multer = require('multer');
const path = require('path');
const {borrowLimit} = require("../config/config");
const {uploadPhoto} = require("./images");

//Book model
const Book = require('../models/Book');
//User model
const User = require('../models/User');
//Genre model
const Genre = require('../models/Genre');


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

//Save the book chosen from the prePost selection
router.post('/post/url', (req, res) => {
    const {url} = req.body;
    if (url) {
        //Parse it from databazeknih.cz
        bookWorm.parseBook(url).then(async json => {
            if (json.success) {
                let book = json.book;
                let title = book.title;
                const newBook = new Book(book);
                // Save it to our database
                newBook.save();
                // For each genre she classifies, check if it's in the database,
                // if yes, add to the amount of books of that genre,otherwise create the genre;
                await genreCheck(newBook.genres);
                res.status(201).json({title: title})
            } else res.status(400).json([{msg: json.book.msg}])
        })
    } else {
        res.status(400).json([{"msg": "You need to choose a book!"}])
    }
});

//Find and save a book by its ISBN
router.post('/post/ISBN', (req, res) => {
    const {ISBN} = req.body;
    if (ISBN) {
        bookWorm.digISBN(ISBN).then(async json => {
            if (json.success) {
                let book = json.book;
                let title = book.title;
                const newBook = new Book(book);
                newBook.save();
                await genreCheck(newBook.genres);
                res.status(201).json({title: title})
            } else res.status(400).json([{msg: json.msg}])
        })
    } else {
        res.status(400).json([{"msg": "ISBN field is required"}])
    }
});

//Save a custom book
router.post('/post/custom', async (req, res) => {
    let errors = [];
    let book = req.body;
    let title = book.title;

    if (book.ISBN === '') book.ISBN = hash({title: title});

    Object.keys(book).forEach((key) => {
        if (book[key] === "") errors.push({msg: key + ' is required'});
    });
    book.image_link = "";
    if (errors.length > 0) {
        res.status(400).json(errors);
    } else {
        const newBook = new Book(book);
        newBook.save();
        await genreCheck(newBook.genres);
        res.json({title: title, type: 'custom', id: newBook._id})
    }
});

//Provide cover for image with specified id - saves locally - initially the photos were stored on the server,
// but uploading it to a third party server ensures the client can see them,
//even if the application is currently run on another server.

const storage = multer.diskStorage({
    destination: path.join(__dirname, '../public/images'),
    filename: function (req, file, cb) {
        Book.findOne({_id: req.params["bookId"]}, (err, data) => {
            if (err) throw err;
            else cb(null, data.ISBN + path.extname(file.originalname))
        });

    }
});
const upload = multer({storage: storage});

router.put('/post/custom/:bookId', upload.single('photo'), async (req, res) => {
    let file = req.file;
    let image_link = await uploadPhoto(file.path);
    image_link = image_link["data"]["link"];
    let doc = await Book.findOneAndUpdate({_id: req.params["bookId"]}, {image_link}, {new: true});
    return res.json(doc.image_link)
});


//Update a Book
router.put('/id/:id', (req, res) => {
    if (!req.body.length > 0) {
        res.status(418).json([{"msg": "All fields are empty; Nothing to update."}])
    } else {
        Book.findOneAndUpdate({_id: req.params.id}, {...req.body}, {new: true},
            async (err, data) => {
                if (err) res.status(500).json([{msg: 'Internal error'}]);
                if (data) {
                    await genreCheck(data.genres);
                    res.json(data)
                } else {
                    res.status(400).json([{msg: 'The requested book is not in the database'}])
                }
            })
    }
});

//Reserve a book
router.get('/reserve/:id', passport.authenticate('jwt', {session: false}), async (req, res) => {
    User.findById(req.user._id, (err, user) => {
        if (err) console.log(err);
        else if (user.reserved.length <= borrowLimit) {
            Book.findById(req.params.id, async (err, data) => {
                if (data) {
                    if (data.status !== 'available') {
                        res.status(400).json([{msg: `${data.title} is not available!`}])
                    } else {
                        data.lastAccessed = Date.now();
                        data.state = 'reserved';
                        data.borrower = req.user.firstName + " " + req.user.surname;
                        data.borrowerId = req.user._id;
                        res.json(data);
                        data.save();
                        user.reserved.push({id: data.id, title: data.title});
                        await user.save();
                    }
                } else res.status(400).json([{msg: "This book isn't in our database"}]);
            });
        } else res.status(400).json([{msg: `You've reached the limit for reserved books of ${borrowLimit}`}])
    })
});

// Get all genres
router.get('/genres', (req, res) => {
    Genre.find({}, (err, data) => {
        if (err) throw err;
        else res.json(data);
    })
});

// Get all books under the specified genre
router.post('/genre', (req, res) => {
    Book.find({genres: req.body["genre"]}, (err, data) => {
        if (err) throw err;
        else res.json(data)
    });
});

// Search through genres.
router.post('/genres/search', (req, res) => {
    Genre.find({name: new RegExp(req.body["genre"], "i")}, (err, data) => {
        if (err) throw err;
        else res.json(data)
    });
});


genreCheck = async (arr) => {
    for await (let name of arr) {
        let genre = await Genre.findOne({name});
        if (genre) {
            genre.amount = genre.amount + 1;
        } else {
            genre = new Genre({name})
        }
        genre.save();
    }
};

module.exports = router;