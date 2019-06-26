const rp = require('request-promise');
const url = 'https://www.databazeknih.cz/';
const $ = require('cheerio');

let result = [];

const initialScraping = async link => {
    let html = await rp(encodeURI(url + link));
     let img = $("img.kniha_img", html);

    return {'img':img[0].attribs.src, title: $('h1',html).text()}

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

module.exports = {
    dig
};

