const rp = require("request-promise");
const fs = require('fs');
const uploadPhoto = async filePath => {
    let options = {
        'method': 'POST',
        'url': 'https://api.imgur.com/3/upload',
        'headers': {
            'Authorization': 'Client-ID de558d31baa4377',
            'Content-Type': 'multipart/form-data; boundary=--------------------------981771235579817547347720'
        },
        formData: {
            'image': {
                'value': fs.createReadStream(filePath),
                'options': {
                    'filename': filePath,
                    'contentType': null
                }
            }
        }
    };
    return await rp(options).then(body => {
        fs.unlink(`${filePath}`, response=>{
            console.log("deleted")
        });
        return JSON.parse(body);

    }).catch(err => {
        console.error(err)
    });
};
module.exports = {
    uploadPhoto
};