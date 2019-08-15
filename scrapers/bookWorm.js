const rp = require('request-promise');
const url = 'https://www.databazeknih.cz/';
const cheerio = require('cheerio');
const download = require('image-downloader');
const hash = require('object-hash');

const dig = async (search, index) => {
    let options = {
        uri: url + 'search?q=' + search,
        transform: body => {
            return cheerio.load(body);
        }
    };

    return rp(options).then($ => {
        let result = [];
        $('p.new_search ').each((elIndex, element) => {
            if (elIndex === parseInt(index)) return false;
            result.push({
                title: $(element).find('a').text(),
                image: $(element).find('a > img').attr('src'),
                url: url + $(element).find('a').attr('href')
            })
        });
        return result
    }).catch(e => {
        console.log(e);
    });
};


const digISBN = async (ISBN) => {
    let options = {
        uri: encodeURI(url + 'search?q=' + ISBN),
        resolveWithFullResponse: true,
    };
    return rp(options)
        .then(res => parseBook(res.request.uri.href))
        .catch(err => {
            console.log(err);
        });
};

const parseBook = async (url) => {
    let options = {
        uri: encodeURI(url + "?show=alldesc"),
        transform: body => {
            return cheerio.load(body);
        }
    };
    return rp(options).then($ => {

        const title = $('h1').text();
        if (title !== 'Vyhledávání') {

            const author = $('span[itemprop="author"]').text();
            const desc = $('#bdetdesc').text();
            const genres = $('h5[itemprop="genre"]').text().split(', ');
            const datePublished = $('span[itemprop="datePublished"]').text();
            const numberOfPages = $('td[itemprop="numberOfPages"]').text();
            const photoUrl = $('img.kniha_img').attr('src');
            let temp = $('span[itemprop="isbn"]').text();
            let ISBN = temp !== "" ? temp : hash({title: title});

            const extension ='.'+ photoUrl.split('.')[photoUrl.split('.').length - 1];
            let imageOptions = {
                url: photoUrl,
                dest: `./public/images/${ISBN}${extension}`,
                extractFilename: false
            };

            download.image(imageOptions)
                .catch((err) => console.error(err));

            let book = {title, author, desc, genres, datePublished, numberOfPages, ISBN, extension};

            return {book, success: true};
        } else return {msg: "Couldn't find a book with such ISBN", success: false};
    }).catch(err => {
        console.log(err);
    });
};

module.exports = {
    dig,
    digISBN,
    parseBook,
};

