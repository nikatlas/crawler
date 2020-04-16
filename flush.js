// main.js

const axios = require('axios');
const cheerio = require('cheerio');
const url = "https://www.sketch.com/extensions/plugins/";

const StrapiClient = require('strapi-client')
//const strapi = new StrapiClient('http://strapi.bappy.tech/')
const strapi = new StrapiClient('http://localhost:1337/')



async function flush	(table) {
	let plugins = await strapi.get(table);
	for(var i in plugins) {
		await strapi.delete(table, plugins[i].id);
	}
}

async function flush10() {
for(var i =0;i<10;i++)
	await flush('plugins');
}

flush10();
