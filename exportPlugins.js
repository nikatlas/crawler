const _ = require('lodash');
const request = require('request');
const parse = require('csv-parse');
var strapi = require('strapi')();
var fs = require('fs');

// const remoteLink = "..."
const localFile = "./data.csv"

async function fetchData() {
  return new Promise( resolve => {
    data = []
    header = null;

    // source = request(remoteLink)
    // source = fs.createReadStream(localFile)
    // source.pipe(parse()).on('data', (row) => {
    //   if(!header) { header = row; return; }
    //   row = row.map(item=>item=='N/A' ? '' : item);
    //   data.push(_.zipObject(header, row))
    // }).on('end', () => {
    //   resolve(data);
    // });
  });
}

async function getData() {
  let count = await strapi.services.plugins.count();
  let data = [];
  const perPage = 100;
  for (let i = 0; i < count;) {
    data = data.concat(await strapi.services.plugins.find({_limit: perPage, _start: count}));
    if (i==data.length) break;
    i = data.length;
  }
  return data;
}

async function initStrapi() {
  await strapi.load();
  await strapi.runBootstrapFunctions();
  return strapi;
}

async function main() {
  let strapi = await initStrapi();
  let data = await getData();

  console.log(data.length);
}
main();