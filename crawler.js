// main.js

const axios = require('axios');
const cheerio = require('cheerio');
const url = "https://www.sketch.com/extensions/plugins/";

const StrapiClient = require('strapi-client')
const strapi = new StrapiClient('http://strapi.bappy.tech/')


fetchData(url).then( (res) => {
    const html = res.data;
    const $ = cheerio.load(html);
    const statsTable = $('.wrapper .row li.col a');
    statsTable.each(async function() {
        let name = $(this).find('.card-title').text();
        let description = $(this).find('.card-description').text();
        let link = $(this).attr("href");

	const plug = await strapi.create('plugins', {
		name,
		link,
		description
	});

        console.log(name, description, link);
    });
})

async function fetchData(url){
    console.log("Crawling data...")
    // make http call to url
    let response = await axios(url).catch((err) => console.log(err));

    if(response.status !== 200){
        console.log("Error occurred while fetching data");
        return;
    }
    return response;
}
