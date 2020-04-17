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
const url = "https://www.sketch.com/extensions/plugins/";

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
	let formData = {
		// files: [fs.createReadStream("temp/" + file.substring(file.lastIndexOf('/')+1))],
		files: request(file),
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
    let name = $(this).find('.card-title').contents().first().text().trim();
    let author = $(this).find('.card-title small').contents().get(1).data.trim();
    let description = $(this).find('.card-description').text().trim();
    let link = $(this).attr("href").trim();
	let stars = 0;
	let image;
	if(link.includes("github.")) {
		let gitpage = await fetchData(link);
		//fs.writeFile("page.html", gitpage.data, (err) => console.log(err));
		const $git = cheerio.load(gitpage.data);
		stars = $git($git(".pagehead-actions li a.social-count").get(1)).contents().first().text().trim();
		let tempimg = $git("#readme img").first().attr("src");

		if (tempimg) {
			console.log("Image Found:",tempimg);
			image = tempimg;
			//image = await downloadFile(tempimg);
		}
		
	}

	const plug = await createOrUpdate('plugins', {
		name,
		link,
		description,
		author,
		stars,
		tools: [Tool.id]
	});
	console.log(Tool.id);

	if (image) {
		//upload Image
		await uploadFile(image, 'plugins', plug.id);
	}

	// console.log("Entry:", plug);
//       console.log(name);
//       console.log(author);
	// console.log(description);
	// console.log(link);
	// console.log("stars:",stars);
}
const sleep = ms =>
new Promise(res => {
setTimeout(res, ms)
})
fetchData(url).then(async (res) => {

	const Tool = (await strapi.get('tools', {name: 'Sketch'}))[0];
    const html = res.data;
    const $ = cheerio.load(html);
    const statsTable = $('.wrapper .row li.col a');
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
