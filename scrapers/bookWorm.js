const rp = require('request-promise');
const url = 'https://www.databazeknih.cz/';
const cheerio = require('cheerio');
const download = require('image-downloader');
const hash = require('object-hash');
const {uploadPhoto} = require("../routes/images");

const dig = async (search, index) => {
    let options = {
        uri: url + 'search?q=' + search,
        transform: body => {
            return cheerio.load(body);
        }
    };

    return rp(options).then($ => {
        let result = [];
        $('p.new').each((elIndex, element) => {
            if (elIndex !== 0) {
                if (elIndex === parseInt(index) + 1) return false;
                result.push({
                    title: $(element).find('a').text(),
                    image: $(element).find('a > img').attr('src'),
                    url: url + $(element).find('a').attr('href')
                })
            }
        });
        return result
    }).catch(e => {
        console.log(e);
    });
};


const digISBN = (ISBN) => {
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
    return rp(options).then(async $ => {

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

            const extension = '.' + photoUrl.split('.')[photoUrl.split('.').length - 1];
            let imageOptions = {
                url: photoUrl,
                dest: `./public/images/${ISBN}${extension}`,
                extractFilename: false
            };

            download.image(imageOptions)
                .catch((err) => console.error(err));
            let image_link = await uploadPhoto(`./public/images/${ISBN}${extension}`);
            image_link = image_link.data.link;
            let book = {title, author, desc, genres, datePublished, numberOfPages, ISBN, image_link};
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

