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



const createOrUpdate = async (table, data) => {
	let { name } = data;
	let exists = await strapi.get(table, { name });
	if(exists.length) {
		console.log("Updating...");
		let newTools = [...new Set([...exists[0].tools, ...data.tools])];
		let newdata = { ...data, tools: newTools};
		return await strapi.update(table, exists[0].id, newdata);
	} else {
		console.log("Inserting...");
		return await strapi.create(table, data);
	}
};

const downloadFile = async(file) => {
	const filename = file.substring(file.lastIndexOf('/')+1);
	const tempfile = fs.createWriteStream("temp/"+filename);
	console.log("Donwloading file");
	
	// maybe this needs request-promise
	await rp(file).pipe(tempfile);

	console.log("Download complete");
	return filename;

}
const uploadFile = async(file, table, id) => {
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
		field: "images"
	};
	let req = request.post({ url:BASE_URL + '/upload', formData});
	await req;
	console.log("Uploaded");
	return req;
}

async function process($, Tool) {
	let det = $(this).children().eq(2);
    let name = det.children().eq(0).text().trim();
    let author = det.children().eq(1).text().trim().substring(3);
    let description = det.children().eq(2).first().text().trim();
    let link = det.children().eq(3).find('a').first().attr('href').trim();
	let image = "http://adobe.com" + $(this).children().eq(0).find('img').first().attr('src').trim();


	const plug = await createOrUpdate('plugins', {
		name,
		link,
		description,
		author,
		tools: [Tool.id]
	});
	console.log(Tool.id);

	if (image) {
		//upload Image
		await uploadFile(image, 'plugins', plug.id);
	}

	// console.log("Entry:", plug);
    console.log('n',name);
    console.log('a',author);
	console.log('d',description);
	console.log('l',link);
	console.log("i",image);
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
    console.log(A);
    A.reduce(
	  (p, x) =>
	    p.then(_ => sleep(1000).then(s => process.bind(x)($, Tool))),
	  Promise.resolve()
	)
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
