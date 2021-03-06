// main.js

//const BASE_URL = 'http://localhost:1337';
const BASE_URL = 'http://strapi.bappy.tech';
const fs = require('fs');
const request = require('request-promise');
const axios = require('axios');
const url = "https://www.figma.com/api/plugins/browse";
const figmaUrl = "https://figma.com"
// https://www.figma.com/api/plugins/browse?sort_by=installs&tag=&user_id=717321891961427131&sort_order=desc&resource_type=plugins&page_size=25

const StrapiClient = require('strapi-client');
const strapi = new StrapiClient(BASE_URL);

let insertCounter = 0;
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
        if(table === "plugins") {
            insertCounter++;
            console.log("Need to insert this one...", table);
        } else {
            console.log("Inserting ", table);
            return await strapi.create(table, data);
        }
    }
};
const uploadFile = async(file, table, id, field = 'images') => {
	console.log("Uploading");
	if(!file.includes("http")) {
		file = "http://" + file;
    }
	let filename = file.substring(file.lastIndexOf('/')+1,file.indexOf('?') > -1 ? file.indexOf('?') : undefined);
    console.log(filename);
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
		field: field
	};

	let req;
    try {
        req = await request.post({ url:BASE_URL + '/upload', formData});
    } catch(e) {
        console.log("Error" , e);
    }
	console.log("Uploaded", BASE_URL + "/upload", file);
	return req;
}

async function process(data) {
   const media = data.map((item) => item.media)
   const endData = data.map((item) => {
       delete item.media
       return item
   })
   
   for (i = 0; i < endData.length; i++) {
        let entry = endData[i]
        const author = await createOrUpdate('authors', {
            name: entry.name
        });

        const link = await createOrUpdate('links', {
            tool: entry.tools[0],
            link: entry.link
        }, {tool : entry.tools[0], link: entry.link});

        const plug = await createOrUpdate('plugins', {
            name: entry.name,
            links: [link.id],
            description: entry.description,
            author: author.id,
            tools: entry.tools
        });
        // Insert Images
        if(entry.authorImage && author && author.id) {
            await uploadFile(entry.authorImage, 'authors', author.id, 'icon');
        }
        if (media[i].image && plug && plug.id) {
            await uploadFile(media[i].image, 'plugins', plug.id);
        }
        else if(media[i].icon && plug && plug.id) {
            await uploadFile(media[i].icon, 'plugins', plug.id, 'icon');
        }
    
    }
}


async function fetchData(url){
    console.log("Crawling data...")
    let response = await axios(url).catch((err) => console.log(err));
    if(response.status !== 200){
        console.log("Error occurred while fetching data");
        return;
    }
    if(response.data) {
        return response.data
    }
    return
}

const getLink = (id, name) => `${figmaUrl}/community/plugin/${id}/${name}`

function parseData(data, Tool) {
    return data.map(item => {
        return {
            name: item.versions[Object.keys(item.versions)[0]].name,
            description: item.versions[Object.keys(item.versions)[0]].description,
            author: item.creator.handle,
            authorImage: item.creator.img_url,
            link: getLink(item.id, item.versions[Object.keys(item.versions)[0]].name),
            stars: item.like_count,
            tools: [Tool.id],
            media: {
                image: `${figmaUrl}${item.versions[Object.keys(item.versions)[0]].redirect_cover_image_url}`,
                icon: `${figmaUrl}${item.versions[Object.keys(item.versions)[0]].redirect_icon_url}`,
            }
        }
    })
}

const nextPage = async (u) => {
    let data = await fetchData(u);
    const Tool = (await strapi.get('tools', {name: 'Figma'}))[0];
    let result = parseData(data.meta.plugins, Tool)
    await process(result);
    console.log("InsertCounter: ", insertCounter);
    if(data.pagination.next_page)
        return nextPage(data.pagination.next_page);
}

const run = async () => {
    console.log("Starting...");
    await nextPage(url);
    console.log("Finished...");
}
run();