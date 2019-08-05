const express = require('express');
const router = express.Router();
const bookWorm = require("../scrapers/bookWorm");

//Book model
const Book = require('../models/Book');

//Get All Books
router.get('/', (req, res) => {
    Book.find({}, (err, data) => {
        if (err) throw err;
        if (data.length > 0) res.json(data);
        else res.status(400).json([{msg: `There are no books currently in the system.`}]);
    });
});


//Get Books by Partial or Full Title
router.get('/t/:t', (req, res) => {
    Book.find({"title": new RegExp(req.params.t, "i")}, (err, data) => {
        if (err) throw err;
        if (data.length > 0) res.json(data);
        else res.status(400).json({msg: `There is no book with title ${req.params.t} in the database`});
    })
});

//Create a Book
router.post('/prePost', (req, res) => {
    const {title, author,ISBN, index} = req.body;
    if (ISBN !== ""){
        bookWorm.digISBN(ISBN).then(title=>{
           res.json({title:title,type:'ISBN'})
        })
    }
    else if (title === "" && author === "") {
        res.status(400).json({"msg": "Title, Author or ISBN is needed"})
    }
    else {
        let limit = index || 4;
        // const newBook = new Book({title, author, available: true});
        bookWorm.dig(title, limit).then(json=>res.json(json));
        // newBook.save();

    }
});

//Update a Book
router.put('/id/:id', (req, res) => {
    console.log(req.body);
    if (!req.body.length>0) {
        res.status(418).json({"msg": "All fields are empty; Nothing to update."})
    }
    else {
        Book.findOneAndUpdate({_id: req.params.id}, {...req.body}, {new: true},
            (err, data) => {
                if (err) res.status(500).json({msg:'Internal error'});
                if (data) {
                    res.json(data)
                } else {
                    res.status(400).json({msg: 'The requested book is not in the database'})
                }
            })
    }
});
module.exports = router;