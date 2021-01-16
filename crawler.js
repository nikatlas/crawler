// main.js

let RXJS = require('rxjs');
let { exhaustMap, shareReplay, tap,map, take, mergeMap, concatMap } = require('rxjs/operators');

const BASE_URL = 'http://localhost:1337';
//const BASE_URL = 'http://strapi.bappy.tech/';
const fs = require('fs');
const https = require('https');
const request = require('request');
const rp = require('request');
const FormData = require('form-data');

const axios = require('axios');
const XLSX = require('xlsx');
const cheerio = require('cheerio');
const url = "https://www.sketch.com/extensions/plugins/";

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

async function process($, Tool, images = false) {
    let name = $(this).find('.card-feature__name').contents().first().text().trim();
    let authorname = $(this).find('.card-feature__small').contents().first().text().replace('by ','').trim();
    let description = $(this).find('.card-feature__description').text().trim();
    let link_url = $(this).attr("href").trim();
	let stars = 0;
	let image;
	if(link_url.includes("github.") && images) {
		let gitpage = await fetchData(link_url);
		//fs.writeFile("page.html", gitpage.data, (err) => console.log(err));
		const $git = cheerio.load(gitpage.data);
		stars = $git($git(".pagehead-actions li a.social-count").get(1)).contents().first().text().trim();
		let tempimg = $git("#readme img").first().attr("src");

		if (tempimg) {
			console.log("Image Found:",tempimg);
			image = tempimg;
			//image = await downloadFile(tempimg);
		}
		
	} else if (!link_url.includes("http")) {
		link_url = "https://www.sketch.com" + link_url;
	}

	// console.log("NAME:",name, " AUTHOR:", author_name, description, link_url);
	return {
		name,
		authorname,
		description,
		link: link_url,
		image,
		stars
	}

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
	// 	description,
	// 	author: author.id,
	// 	stars,
	// 	tools: [Tool.id]
	// });

	// console.log(Tool.id);

	// if (image) {
	// 	//upload Image
	// 	await uploadFile(image, 'plugins', plug.id);
	// }

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
let run = () => {
	return fetchData(url).then(async (res) => {
	    const html = res.data;
	    const $ = cheerio.load(html);
	    const statsTable = $('.card-feature-link');
	    const arr = statsTable.map((i, elem) => elem);
	    let A = [];
	    for(let i in arr) {
	    	A.push(
	    		arr[i]
	    	)
	    }
	    // console.log(RXJS)
	    // let req$ = RXJS.concat(...A)
	   	// .pipe(tap(console.log),map((s) => process.bind(s)($, {id: 1})))
	    // .subscribe(function (observableItems) {
	    // 	console.log(observableItems);
	    // })

	    console.log(A.length);
	    const counter = A.length;
	    let number = 0;
	    let results = [];
	    return A.reduce(
		  (p, x) =>
		    p.then(_ => sleep(1).then(s => process.bind(x)($, {id:1})))
		    .then((data) => results.push(data)).catch(e => {
		    	Errors.push(x)
		    	console.log("Error Number: " + Errors.length);
		    	console.log(e);
		    }).then(() => console.log("Number: " , ++number)),
		  Promise.resolve()
		).then(() => {
			console.log("There were ", Errors.length, " errors");
			console.log("Out of ", counter, " items");
			console.log("insertCounter ", insertCounter, " items");
			return results;
		});
	})
};

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
// const makeQuery = new RXJS.Observable(s => 
// 	setTimeout(()=>{
// 		console.log(1);
// 		s.next("!@#");
// 		s.complete();
// 	},2000)
// ).pipe(shareReplay(1));

// let interval = RXJS.interval(1000).pipe(take(3));
// let dinterval = RXJS.interval(2000).pipe(concatMap(()=>interval)).subscribe(console.log);
// let n = interval.pipe(shareReplay(1));
// n.subscribe(console.log)
// console.log("FINISH LINE")


// function tt() {
// 	makeQuery.subscribe(console.log);
// }

// tt()
// tt()
// tt()

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
    
    console.log("Crawling Figma...");
    let data = await run();
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
	    link.tool = 1;
        match.links = JSON.stringify((clinks && !clinks.includes(link.id)) ? [...(clinks || []), link.id] : [link.id]);
        
        let helpertools;
        try { helpertools = JSON.parse(match.tools) } catch(e) {}
        match.tools = JSON.stringify(helpertools && !helpertools.includes(1) ? [...(helpertools||[]), 1] : (helpertools||[]));
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