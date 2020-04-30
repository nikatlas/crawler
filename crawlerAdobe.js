// main.js

//const BASE_URL = 'http://localhost:1337';
const BASE_URL = 'http://strapi.bappy.tech/';
const fs = require('fs');
const https = require('https');
const request = require('request');
const rp = require('request');
const FormData = require('form-data');

const axios = require('axios');
const cheerio = require('cheerio');
const url = "https://www.adobe.com/products/xd/resources.html";

const StrapiClient = require('strapi-client')
const strapi = new StrapiClient(BASE_URL);


let Errors = [];

const createOrUpdate = async (table, data, comparator = { name: data.name }) => {
	let exists = await strapi.get(table, comparator);
	if(exists.length) {
		console.log("Updating...", table);
		let newdata = data;
		if(table=="plugins"){
			let newTools = [...new Set([...exists[0].tools, ...data.tools])];
			let newLinks = [...new Set([...exists[0].links, ...data.links])];
			let newDescription = (exists[0].description && data.description 
				&& exists[0].description.length > data.description.length) ? exists[0].description : data.description;
			newdata = { ...data, tools: newTools, description: newDescription, links: newLinks };
		}
		return await strapi.update(table, exists[0].id, newdata);
	} else {
		console.log("Inserting...", table);
		return await strapi.create(table, data);
	}
};
const uploadFile = async(file, table, id, field = "images") => {
	console.log("Uploading");
	if(!file.includes("http")) {
		file = "https://github.com" + file;
	}
	let filename = file.substring(file.lastIndexOf('/')+1,file.indexOf('?') > -1 ? file.indexOf('?') : undefined);
	let formData = {
		// files: [fs.createReadStream("temp/" + file.substring(file.lastIndexOf('/')+1))],
		files: {
			value: request(file),
			options: {
				filename: filename.includes('.') ? filename : filename + ".png"
			}
		},
		refId: id,
		ref: table,
		field
	};
	let req = request.post({ url:BASE_URL + '/upload', formData});
	await req;
	console.log("Uploaded");
	return req;
}

async function process($, Tool) {
	let det = $(this).children().eq(2);
    let name = det.children().eq(0).text().trim();
    let author_name = det.children().eq(1).text().trim().substring(3);
    let short_description = det.children().eq(2).first().text().trim();
    let link_url = det.children().eq(3).find('a').first().attr('href').trim();
	let image = "http://adobe.com" + $(this).children().eq(0).find('img').first().attr('src').trim();

	const author = await createOrUpdate('authors', {
		name: author_name
	});

	const link = await createOrUpdate('links', {
		tool: Tool.id,
		link: link_url
	}, {tool : Tool.id, link: link_url});

	const plug = await createOrUpdate('plugins', {
		name,
		links: [link.id],
		short_description,
		author: author.id,
		tools: [Tool.id]
	});
	console.log(Tool.id, plug.id);

	if (image) {
		//upload Image
		await uploadFile(image, 'plugins', plug.id, "icon");
	}
}
const sleep = ms =>
new Promise(res => {
setTimeout(res, ms)
})
fetchData(url).then(async (res) => {

	const Tool = (await strapi.get('tools', {name: 'AdobeXD'}))[0];
    const html = res.data;
    const $ = cheerio.load(html);
    const statsTable = $('div.grid-span-1of3');
    const arr = statsTable.map((i, elem) => elem);
    let A = [];
    for(var i in arr) {
    	A.push(arr[i]);
    }
    let number = 0;
    // console.log(A);

    const counter = A.length;
    A.reduce(
	  (p, x) =>
	    p.then(_ => sleep(10).then(s => process.bind(x)($, Tool))).catch(e => {
	    	Errors.push(x)
	    	console.log("Error Number: " + Errors.length);
	    	console.log(e);
	    }).then(() => console.log("Number: " , ++number)),
	  Promise.resolve()
	).then(() => {
		console.log("There were ", Errors.length, " errors");
		console.log("Out of ", counter, " items");
	})
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
