// main.js

const BASE_URL = 'http://localhost:1337';
//const BASE_URL = 'http://strapi.bappy.tech/';
const fs = require('fs');
const https = require('https');
const request = require('request-promise');
const FormData = require('form-data');

const axios = require('axios');
const XLSX = require('xlsx');
const cheerio = require('cheerio');
const url = "https://www.adobe.com/products/xd/resources.html";

const StrapiClient = require('strapi-client')
const strapi = new StrapiClient(BASE_URL);


let Errors = [];

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

	// if (image) {
	// 	//upload Image
	// 	await uploadFile(image, 'plugins', plug.id, "icon");
	// }
}


async function findMetadata($, Tool) {
	let det = $(this).children().eq(2);
    let name = det.children().eq(0).text().trim();
    let author_name = det.children().eq(1).text().trim().substring(3);
    let short_description = det.children().eq(2).first().text().trim();
    let link_url = det.children().eq(3).find('a').first().attr('href');
	let image = "http://adobe.com" + $(this).children().eq(0).find('img').first().attr('src');


	// const author = await createOrUpdate('authors', {
	// 	name: author_name
	// });

	// const link = await createOrUpdate('links', {
	// 	tool: Tool.id,
	// 	link: link_url
	// }, {tool : Tool.id, link: link_url});

	// const plug = await createOrUpdate('plugins', {
	// 	name,
	// 	links: [link.id],
	// 	short_description,
	// 	author: author.id,
	// 	tools: [Tool.id]
	// });
	// console.log(Tool.id, plug.id);

	// if (image) {
	// 	//upload Image
	// 	await uploadFile(image, 'plugins', plug.id, "icon");
	// }
	return {
		name,
        authorname: author_name,
        image,
        link: link_url,
        description: short_description
    }
}


const sleep = ms =>
new Promise(res => {
setTimeout(res, ms)
})
let grab = async function() {
	return await fetchData(url).then((res) => {

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
	    let AllData = [];
	    const counter = A.length;
	    return A.reduce(
		  (p, x) =>
		    p.then(_ => sleep(10).then(s => findMetadata.bind(x)($)))
		    .then((a) => AllData.push(a)).catch(e => {
		    	Errors.push(x)
		    	console.log("Error Number: " + Errors.length);
		    	console.log(e);
		    }),
		  Promise.resolve()
		).then(() => {
			console.log("There were ", Errors.length, " errors");
			console.log("Out of ", counter, " items");
			console.log("insertCounter ", insertCounter, " items");
			return AllData;
		})
	});
}

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


////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
const excelURL = (sheet) => "https://converter.pluginverse.com/api/v1/xlsx/convert/json?url=https://docs.google.com/spreadsheets/d/1zcH3vMnCDvPJBL0LSwMItrrBxDXlvc49u1ovLWxm3Wo/export?format=xlsx&sheet="+sheet;
let pluginData,authorData;
async function getExcel() {
    let ex = await axios({
        method: "GET",
        url: excelURL("Plugins")
      })
    pluginData = ex.data;
    ex = await axios({
        method: "GET",
        url: excelURL("Authors")
      })
    authorData = ex.data;
    ex = await axios({
        method: "GET",
        url: excelURL("Links")
      })
    linkData = ex.data;
    
    return {
        plugins: pluginData,
        authors: authorData,
        links: linkData
    }
}

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
////////////////////   MAIN  ///////////////////////////
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
let page = 0;
const nextPage = async (u, tf, all = false) => {
    let data = await fetchData(u);
    const Tool = (await strapi.get('tools', {name: 'Figma'}))[0];
    let result = parseData(data.meta.plugins, Tool)
    

    //await process(result);
    let temp = await tf(result);

    console.log("page: ", page++);
    let tt = {};
    if(data.pagination.next_page && all)
        tt = await nextPage(data.pagination.next_page, tf, all);
    return {...temp, ...tt};
}

const fixExcels = async () => {
    console.log("Starting...");
    console.log("Fetching Excel from drive...");
    let excelData = await getExcel();
    
    console.log("Crawling AdobeXD...");
    let data = await grab();
    console.log("Finished Crawling...");

    await fixPlugs(data, excelData);

    console.log("Saving...");
    saveFile(excelData.plugins, "pluginsMeta.xlsx");
    saveFile(excelData.authors, "authors.xlsx");
    saveFile(excelData.links, "links.xlsx");
    console.log("Finish!");
}

fixExcels();

















































////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
function findMatch(data, excel, field = 'name', preciseness = 0.8) {
    let s1 = data;
    let mx = 0, mi;
    for (var i in excel) {
        if(!excel[i][field]) continue;

        let s = similarity(s1, excel[i][field]);
        if(s === 1) {
            return excel[i];
        } else if(s > mx) {
            mx = s; mi=i;
        }
    }
    return mx > preciseness ? excel[mi] : false;
}

const addToExcel = (name, authors, field, preciseness) => {
	if(!name.length)return false;
    let author = findMatch(name, authors, field, preciseness);
    if(author == false) {
        let maxid = Math.max(0, ...authors.map(i=>parseInt(i.id))) + 1;
        author = {
            id: maxid,
            [field]: name
        };
        authors.push(author);
    }
    return author;
}
//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
const fixPlugs = async(data, {plugins, links, authors}) => {
    for(let i in data) {
        let match = addToExcel(data[i].name, plugins, 'name');
        if(!match) continue;
        
        let clinks;
        try { clinks = JSON.parse(match.links) } catch(e) {}

        if(!data[i].link) continue;

        let authorname = data[i].authorname;
        let author = addToExcel(authorname, authors, 'name');


	    let link = addToExcel(data[i].link, links, 'link');
	    link.tool = 2;
        match.links = JSON.stringify((clinks && !clinks.includes(link.id)) ? [...(clinks || []), link.id] : [link.id]);
        
        let helpertools;
        try { helpertools = JSON.parse(match.tools) } catch(e) {}
        match.tools = JSON.stringify(helpertools && !helpertools.includes(2) ? [...(helpertools||[]), 2] : (helpertools||[]));
        match.author = JSON.stringify(author.id || match.author);
        match.description = data[i].description;
    }
    return plugins;
}





/////////////////////////////////////////////////////////////////////////////////////
// FILE save ////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////
function JSONtoArray(data) {
    let res = [];
    let keys = Object.keys(data)
    let maxKey = keys[keys.length-1];
    for(let i=1;i<maxKey;i++) {
        if(!data[i]) data[i] = {};
        data[i].id = i;
        res.push(data[i]);
    }
    return res;
}

function saveFile(data, name) {
    let sheet = XLSX.utils.json_to_sheet(data);
    var wb = XLSX.utils.book_new();
    /* Add the worksheet to the workbook */
    XLSX.utils.book_append_sheet(wb, sheet, "Data");

    return XLSX.writeFile(wb, name);
}










/////////////////////////////////////////////////////////////////////////////////////
// HELPERS //////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////
function similarity(s1, s2) {
  var longer = s1;
  var shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  var longerLength = longer.length;
  if (longerLength == 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}
function editDistance(s1, s2) {
  s1 = s1 && (''+s1).toLowerCase();
  s2 = s2 && (''+s2).toLowerCase();

  var costs = new Array();
  for (var i = 0; i <= s1.length; i++) {
    var lastValue = i;
    for (var j = 0; j <= s2.length; j++) {
      if (i == 0)
        costs[j] = j;
      else {
        if (j > 0) {
          var newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue),
              costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0)
      costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}