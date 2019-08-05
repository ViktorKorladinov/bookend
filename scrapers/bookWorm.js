const rp = require('request-promise');
const url = 'https://www.databazeknih.cz/';
const cheerio = require('cheerio');

let result = [];

const initialScraping = async link => {
    let html = await rp(encodeURI(url + link));
    let img = $("img.kniha_img", html);

    return {'img': img[0].attribs.src, title: $('h1', html).text()}

};
const dig = async (search, index) => {
    try {
        let html = await rp(encodeURI(url + 'search?q=/' + search));
        let things = $('p.new_search a.new', html);
        result = [];
        for (let i = 0; i < index; i++) {
            await initialScraping(things[i].attribs.href)
                .then(e => {
                    result.push(e)
                })
        }
    } catch (e) {
        console.log(e);
    }
    return result
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
        uri: encodeURI(url + "?show=binfo"),
        transform: body => {
            return cheerio.load(body);
        }
    };
    return rp(options).then($ => {
        const title = $('h1').text();
        const genres = $('h5[itemprop="genre"]').text().split(', ');
        const datePublished = $('span[itemprop="datePublished"]').text();
        const numberOfPages = $('td[itemprop="numberOfPages"]').text();

        let book = {bookName: title, genres, datePublished, numberOfPages};
        console.log(book);

        return title;
    }).catch(err => {
        console.log(err);
    });
};

module.exports = {
    dig,
    digISBN
};

