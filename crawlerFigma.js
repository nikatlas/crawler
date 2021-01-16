// main.js

//const BASE_URL = 'http://localhost:1337';
const BASE_URL = 'http://strapi.bappy.tech';
const fs = require('fs');
const request = require('request-promise');
const axios = require('axios');
const XLSX = require('xlsx');
const url = "https://www.figma.com/api/plugins/browse?page_size=50";
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
        if (table=="plugins") {
            let newTools = [...new Set([...exists[0].tools, ...data.tools])];
            let newLinks = [...new Set([...exists[0].links, ...data.links])];
            let newDescription = (exists[0].description && data.description 
                && exists[0].description.length > data.description.length) ? exists[0].description : data.description;
            newdata = { ...data, tools: newTools, description: newDescription, links: newLinks };
        }
        return await strapi.update(table, exists[0].id, newdata);
    } else {
        if (table === "plugins") {
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


////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
function findMatch(data, excel, field = 'name', preciseness = 0.8) {
    let s1 = data;
    let mx = 0, mi;
    for (var i in excel) {
        if(!excel[i][field]) continue;

        let s = similarity(''+s1, ''+excel[i][field]);
        if(s === 1) {
            return excel[i];
        } else if(s > mx) {
            mx = s; mi=i;
        }
    }
    return mx > preciseness ? excel[mi] : false;
}

function findMetadata(data, excel) {
    let res = {};
    for(var i in data){
        let match = findMatch(data[i].name, excel);
        if (match === false) continue;
        let links;
        try { links = JSON.parse(match.links) } catch(e) {}
        res[match.id] = {
            name: data[i].name,
            description: data[i].description,
            authorname: data[i].author,
            authorimage: data[i].authorImage,
            stars: data[i].stars,
            tools: data[i].tools,
            image: data[i].media.image,
            icon: data[i].media.icon,
            link: data[i].link,
            links
        }
    }
    return res;
}

const addToExcel = (name, authors, field, preciseness) => {
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
const fixAuthors = async(meta, authors) => {
    let revid = {};
    for(var i in meta) {
        let authorname = meta[i].authorname;
        let author = addToExcel(authorname, authors, 'name');
        revid[author.name] = author.id;
    }
    return revid;
}
const createLinks = async(data, links) => {
    for(let i in data) {
        if(!data[i].link) continue;
        let link = addToExcel(data[i].link, links, 'link');
        link.tool = 3;
        let linksData = data[i].links;
        // try { linksData = JSON.parse(data[i].links) } catch(e) {}

        // console.log(linksData, linksData.includes(link.id), link.id);

        data[i].links = (linksData && !linksData.includes(link.id)) ? [...(linksData || []), link.id] : [link.id];
    }
    // console.log(plugins);
}
const fixPlugs = async(data, { plugins, links, authors }) => {
    // for(let i in data) {
    //     if(!data[i].link) continue;
    //     // let link = await addToExcel(data[i].link, links, 'link');

    //     let helpertools;
    //     try { helpertools = JSON.parse(match.tools) } catch(e) {}
    //     let match = findMatch(i, plugs, 'id');
    //     match.tools = JSON.stringify(helpertools && !helpertools.includes(2) ? [...(helpertools||[]), 2] : (helpertools||[]));
    //     match.author = JSON.stringify(match.author);
    //     match.links = data[i].links;
    // }
    // return plugs;

    for(let i in data) {

        let match = addToExcel(data[i].name, plugins, 'name');
        if(!match) continue;

        await checkImages(match, data[i]);
        
        let clinks;
        try { clinks = JSON.parse(match.links) } catch(e) {}
        if(!data[i].link) continue;

        let authorname = data[i].authorname;
        let author = addToExcel(authorname, authors, 'name');

        let link = addToExcel(data[i].link, links, 'link');
        link.tool = 3;
        match.links = JSON.stringify((clinks && !clinks.includes(link.id)) ? [...(clinks || []), link.id] : [link.id]);
        
        let helpertools;
        try { helpertools = JSON.parse(match.tools) } catch(e) {}
        match.tools = JSON.stringify(helpertools && !helpertools.includes(3) ? [...(helpertools||[]), 3] : (helpertools||[3]));
        match.author = JSON.stringify(author.id || match.author);

        match.image = data[i].image;

        match.description = data[i].description;
    }
    return plugins;
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
    
    console.log("Crawling Figma...");
    let data = await nextPage(url, async(d) => findMetadata(d, excelData.plugins), true);
    console.log("Finished Crawling...");

    let plugs = await fixPlugs(data, excelData);

    console.log("Saving...");
    saveFile(excelData.plugins, "pluginsMeta.xlsx");
    saveFile(JSONtoArray(excelData.authors), "authors.xlsx");
    saveFile(excelData.links, "links.xlsx");
    console.log("Finish!");
}
fixExcels();






















const checkImages = async (match, item) => {
    let entity = await strapi.get('plugins', {id: match.id});
    if(!entity[0].images.length)
        await uploadFile(item.image, 'plugins', match.id, 'images');
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
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

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