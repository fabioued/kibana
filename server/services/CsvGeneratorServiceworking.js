/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */


/* eslint-disable camelcase */

const axios       = require('axios');
const moment      = require('moment');
const _           = require('lodash');
const flatten       = require('flat');
const converter   = require('json-2-csv');
const fs          = require('fs-extra');
const history     = [];
const ESPATH      = 'http://localhost:9200/';
const MaxCSVRows  = 3000;
const INDEXNAME   = 'csvgenerator';


export default class CsvGeneratorService {
  constructor(esDriver, esServer) {
    this.esDriver = esDriver;
    this.esServer = esServer;
  }
  checkIndexExist = async (_req) => {
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const indexExist = await callWithRequest(_req, 'indices.exists', { index: INDEXNAME });
      return { ok: true, resp: indexExist };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - checkIndexExist:', err);
      return { ok: false, resp: err.message };
    }
  }
  getMappings = async (_req) => {
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const mappings = await callWithRequest(_req, 'indices.getMapping', { index: INDEXNAME });
      return { ok: true, resp: mappings };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - getMappings:', err);
      return { ok: false, resp: err.message };
    }
  };
  putMapping = async (_req) => {
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const params  = {
        'properties': {
          'fileType': {
            'type': 'text'
          },
          'file': {
            'type': 'text'
          },
          'downloadLink': {
            'type': 'text'
          },
          'date': {
            'type': 'date',
            'format': 'dd-MM-yyyy HH:mm:ss'
          },
          'status': {
            'type': 'text'
          },
          'binary': {
            'type': 'binary'
          },
          'error': {
            'type': 'text'
          },
          'timestamp': {
            'type': 'date',
            'format': 'dd-MM-yyyy HH:mm:ss'
          },
          'user': {
            'type': 'nested',
            'properties': {
              'id': { 'type': 'text'  },
              'username': { 'type': 'text'  }
            }
          }
        }
      };
      const mappings = await callWithRequest(_req, 'indices.putMapping',
        {
          index: INDEXNAME,
          body: params
        });
      return { ok: true, resp: mappings };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - putMapping:', err);
      return { ok: false, resp: err.message };
    }
  }

  createCSVIndex = async (_req) => {
    try {
      const indexExist = await this.checkIndexExist();
      console.log('indexExist before is ', indexExist);
      const { callWithRequest } = this.esDriver.getCluster('data');
      const mappings = await callWithRequest(_req, 'indices.create', { index: INDEXNAME });
      await this.putMapping();
      console.log('indexExist after is ', indexExist);
      return { ok: true, resp: mappings };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - createCSVIndex:', err);
      return { ok: false, resp: err.message };
    }
  }

  getSingleCSV = async (_req) => {
    const csvId     = _req.params.csvId;
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const csv = await callWithRequest(_req, 'get',
        { index: INDEXNAME,
          id: csvId
        });
      const binary = csv._source.binary;
      const json = Buffer.from(binary, 'base64').toString('utf-8');
      console.log('csv._source.file ', csv._source.file);
      const data = { filename: csv._source.file, csv: JSON.parse(json) };
      //console.log('json parse is ', JSON.parse(json));
      return { ok: true, resp: data };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - getSingleCSV:', err);
      return { ok: false, resp: err.message };
    }
  }

  getRecentCSV = async (_req) => {
    try {
      const histories = [];
      const { callWithRequest } = this.esDriver.getCluster('data');
      const indexes = await callWithRequest(_req, 'search', {
        index: INDEXNAME,
        body: {
          'size': 10,
          'sort': [{ 'date': { 'order': 'desc' } }],
          'query': {
            'bool': {
              'filter': {
                'match': {
                  'fileType': 'csv'
                }
              }
            }
          }
        }
      });
      indexes.hits.hits.sort((a, b) => b._source.date - a._source.date);
      for(const history of indexes.hits.hits) {
        histories.push({
          id: history._id,
          saveSearch: history._source.file,
          status: history._source.status,
          date: history._source.date,
          download: history._source.downloadLink
        });
      }
      return { ok: true, resp: histories };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - getRecentCSV:', err);
      return { ok: false, resp: err.message };
    }
  }

  setup = async () => {
    try {
      const indexExist = await this.checkIndexExist();
      console.log('indexExist is ', indexExist);
      if(!indexExist.resp) {
        await this.createCSVIndex();
      }
      return { ok: true, resp: 'done' };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - setup:', err);
      return { ok: false, resp: err.message };
    }
  }

  getHistory = async () => {
    try {
      const recentsCsv =  await this.getRecentCSV();
      return recentsCsv;
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - getHistory:', err);
      return { ok: false, resp: err.message };
    }
  }

  // download = async (_req) => {
  //   try {
  //     const recentsCsv = await this.getSingleCSV(_req);
  //     //return recentsCsv;
  //     return { ok: true, resp: recentsCsv.resp };
  //     //return { ok: true, resp: recentsCsv, config: config };
  //   } catch (err) {
  //     console.error('CSV Generator - CsvGeneratorService - getHistory:', err);
  //     return { ok: false, resp: err.message };
  //   }
  // }

  savedSearchInfo = async (_req, savedsearchId) => {
    //const { callWithRequest } = this.esDriver.getCluster('data');
    const query = ESPATH + '.kibana/_doc/search:' + savedsearchId;
    return axios.get(query).then(response => {
      //console.log('response.data  from savedSearchInfo is ', response.data);
      return response.data;
    }).catch(error => {
      console.error('getSavedSearch Infos - Error while fetching savedSearch Infos from elasticsearch', error);
      return { ok: false, resp: error.message };
    });
  }

  genereteCsv = async _req => {

    // console.log('this.esDriver is ', this.esDriver);
    // console.log('this.esServer is ', this.esServer);
    const getUser = this.esServer.security;
    //console.log('user is ', getUser);
    const { callWithRequest } = this.esDriver.getCluster('data');

    //start and end date
    const time_range_gte = _req.params.start;
    const time_range_lte = _req.params.end;

    //Get saved search informations (filters, indexRef)
    const savedsearchId   = _req.params.savedsearchId;
    let strColumns        = '';
    const strSort         = '';
    const header_search   = [];
    let fields_exist      = false;
    let strFilename       = '';
    let savedSearchInfos  = {};
    let indexPatter       = '';
    let resIndexPattern   = '';
    let fieldsPattern     = '';
    let body              = '';
    let header            = [];
    const line            = [];
    const dataset         = [];
    const INDEXNAME       = 'csvgenerator';



    async function savedSearchInfo() {
      const savedsearchIdFromES = await callWithRequest(_req, 'search', {
        index: '.kibana',
        type: '_doc'
      });

      //console.log('savedsearchIdFromES from savedSearchInfo is ', savedsearchIdFromES);
      const query = ESPATH + '.kibana/_doc/search:' + savedsearchId;
      return axios.get(query).then(response => {

        //console.log('response.data  from savedSearchInfo is ', response.data);
        return response.data;
      }).catch(error => {
        console.error('getSavedSearch Infos - Error while fetching savedSearch Infos from elasticsearch', error);
        return { ok: false, resp: error.message };
      });
    }

    async function getCSVIndex() {
      const index = await callWithRequest(_req, 'indices.get', {
        index: INDEXNAME
      });
      //console.log('index from getCSVIndex is ', index);
    }

    async function writeToCSVIndexInfo(error, status) {
      console.log('writing to index');
      const params  = {
        index: INDEXNAME,
        body: {
          fileType: 'info',
          status: status,
          error: error,
        }
      };
      const document = await callWithRequest(_req, 'index', params);
      console.log('document from writeToCSVIndexInfo is ', document);
    }

    async function saveCSVToCSVIndexInfo(file, link, date, status, binary) {
      console.log('saving csv to index');
      const params  = {
        index: INDEXNAME,
        body: {
          fileType: 'csv',
          file: file,
          downloadLink: link,
          date: date,
          status: status,
          binary: binary,
          user: {
            id: 'user id',
            username: 'username',
          }
        }
      };

      //const { callWithRequest } = this.esDriver.getCluster('data');
      // console.log('this.esDriver is ', this.esDriver);
      // console.log('this.esServer is ', this.esServer);
      // if (this.esServer.security)
      // {
      //     this.esServer.security.getUser(req).then(user => {
      //    // ticket.fields.reporter.name = user.username
      //    console.log('user is ',user);
      // });

      // }
      const document = await callWithRequest(_req, 'index', params).then(response => {
        console.log('document from writeToCSVIndexInfo is ', response);
      }).catch((err) =>{
        console.log('error from writeToCSVIndexInfo is ', err);
      });
    }

    function indexPattern(queryIndex) {
      //const queryPattern  = ESPATH + '.kibana/_doc/index-pattern:' + item.id;
      return axios.get(queryIndex).then(response => {
        return response.data;
      }).catch(error => {
        writeToCSVIndexInfo('csv Generator CsvGeneratorService indexPattern - Error while fetching Index Pattern from elasticsearch', 'failed');
        console.error('indexPattern - Error while fetching Index Pattern from elasticsearch', error);
      });
    }

    function ESFetchCount(indexPatternTitle, bodyCount) {
      const fecthCountRes =  callWithRequest(_req, 'count', {
        index: indexPatternTitle,
        body: bodyCount
      }).then(response => {
        //console.log(' response in ESFetchData is ', response);
        return response;
      }).catch((err) =>{
        console.log('ESFetchCount - Error while counting the number of elements in ElasticSearch ', err);
      });
      return fecthCountRes;
    }

    async function ESFetchData(body) {
      const fecthDataRes =  callWithRequest(_req, 'search', {
        scroll: '1m',
        body: body
      }).then(response => {
        return response;
      }).catch((err) =>{
        console.log('ESFetchData - Error while Fetching the data from ElasticSearch ', err);
      });
      return fecthDataRes;
    }

    function ESFetchScroll(scrollId) {
      const fecthDataScrollRes =  callWithRequest(_req, 'scroll', {
        scrollId: scrollId,
        scroll: '1m',
      }).then(response => {
        return response;
      }).catch((err) =>{
        console.log('ESFetchScroll - Error while Fetching the scroll data from ElasticSearch ', err);
      });
      return fecthDataScrollRes;
    }
    function traverse(data, keys, result = {}) {
      for (const k of Object.keys(data)) {
        if (keys.includes(k)) {
          result = ({ ...result, ...{
            [k]: data[k]
          } });
          continue;
        }
        if (
          data[k] &&
          typeof data[k] === 'object' &&
          Object.keys(data[k]).length > 0
        )
        {
          result = traverse(data[k], keys, result);
        }
      }
      return result;
    }

    await getCSVIndex();
    savedSearchInfos = await this.savedSearchInfo(_req, savedsearchId);
    // strSort = savedSearchInfos._source.search.sort;
    console.log('savedSearchInfos._source.search.columns', savedSearchInfos._source.search.columns);
    for(const column of savedSearchInfos._source.search.columns) {
      if (column !== '_source') {
        if(strColumns !== '') {
          strColumns = strColumns + ',';
        }
        const split = column.split('.');
        console.log('split is ', split);
        if(split.length >= 2)
        {
          header_search.push(split[1]);
        }else {
          header_search.push(column);
        }
        fields_exist = true;

        strColumns = strColumns + '"' + column + '"';
      }
    }
    // if (fields_exist === false) {
    //   console.log('generateCSV - Err : No columns chosen');
    // }
    //console.log('strColumns ', strColumns.toString(), 'header_search ', header_search);
    //Get filters array
    const filters = savedSearchInfos._source.search.kibanaSavedObjectMeta.searchSourceJSON;
    //Get index name
    for(const item of savedSearchInfos._source.references) {
      if (item.name === JSON.parse(filters).indexRefName) {
        //Get index-pattern informations (index-pattern name & timeFieldName)
        const queryPattern  = ESPATH + '.kibana/_doc/index-pattern:' + item.id;
        indexPatter         = await  indexPattern(queryPattern);
        resIndexPattern     = indexPatter._source['index-pattern'];
        //Get fields type
        fieldsPattern       = resIndexPattern.fields;
        //Get fields Date
        const list_columns_date = [];
        for(const item of JSON.parse(fieldsPattern)) {
          if (item.type === 'date') {
            list_columns_date.push(item.name);
          }
        }
        //console.log('list_columns_date Date fields are :', list_columns_date);
        //building query
        let must     = '"must": [ ';
        let must_not = '"must_not": [ ';
        //console.log('filters are', JSON.parse(filters).filter);
        for(const item of JSON.parse(filters).filter) {
          //console.log('item is ', item);
          if(item.meta.disabled === false) {
            switch (item.meta.negate) {
              case false:
                switch (item.meta.type) {
                  case 'phrase':
                    if (must !== '"must": [ ') {
                      must = must + ',';
                    }
                    must = must + '{ "match_phrase": { "' + item.meta.key + '": { "query": "' + item.meta.value + '" } } }';
                    break;
                  case 'exists':
                    if (must !== '"must": [ ') {
                      must = must + ',';
                    }
                    must = must + '{ "exists": { "field": "' + item.meta.key + '" } }';
                    break;
                  case 'phrases':
                    if (must !== '"must": [ ') {
                      must = must + ',';
                    }
                    must = must + ' { "bool": { "should": [ ';
                    if(item.meta.value.indexOf(',') > -1) {
                      const valueSplit = item.meta.value.split(', ');
                      //console.log('valueSplit are: ', valueSplit);
                      for (const [key, incr]  of valueSplit.entries()) {
                        if(key !== 0) {
                          must = must + ',';
                        }
                        must = must + '{ "match_phrase": { "' + item.meta.key + '": "' + incr + '" } }';
                      }
                    }else {
                      must = must + '{ "match_phrase": { "' + item.meta.key + '": "' + item.meta.value + '" } }';
                    }
                    must = must + ' ], "minimum_should_match": 1 } }';
                    break;
                }
                break;

              case true:
                switch (item.meta.type) {
                  case 'phrase':
                    if (must_not !== '"must_not": [ ') {
                      must_not = must_not + ',';
                    }
                    must_not = must_not + '{ "match_phrase": { "' + item.meta.key + '": { "query": "' + item.meta.value + '" } } }';
                    break;
                  case 'exists':
                    if (must_not !== '"must_not": [ ') {
                      must_not = must_not + ',';
                    }
                    must_not = must_not + '{ "exists": { "field": "' + item.meta.key + '" } }';
                    break;
                  case 'phrases':
                    if(must_not !== '"must_not": [ ') {
                      must_not = must_not + ',';
                    }
                    must_not = must_not + ' { "bool": { "should": [ ';
                    if(item.meta.value.indexOf(',') > -1) {
                      const valueSplit = item.meta.value.split(', ');
                      for (const [key, incr]  of valueSplit.entries()) {
                        if(key !== 0) {
                          must_not = must_not + ',';
                        }
                        must_not = must_not + '{ "match_phrase": { "' + item.meta.key + '": "' + incr + '" } }';
                      }
                    } else {
                      must_not = must_not + '{ "match_phrase": { "' + item.meta.key + '": "' + item.meta.value + '" } }';
                    }
                    must_not = must_not + ' ], "minimum_should_match": 1 } }';
                    break;
                }
                break;
            }
          }
        }
        //console.log('resIndexPattern.timeFieldName', resIndexPattern.timeFieldName);
        if (resIndexPattern.timeFieldName !== '') {
          //add timefield in fields
          //.push(resIndexPattern.timeFieldName);
          if (strColumns !== '') {
            strColumns = ',' + strColumns;
          }
          console.log('fields_exist is ', fields_exist);
          if(fields_exist) {
            strColumns = '"' + resIndexPattern.timeFieldName + '"' + strColumns;
          }
          //strColumns = '"' + resIndexPattern.timeFieldName + '"' + strColumns;

          if (must !== '"must": [ ') {
            must = must + ',';
          }
          must = must + '{ "range": { "' + resIndexPattern.timeFieldName + '": { "format": "epoch_millis", "gte": "' + time_range_gte + '", "lte": "' + time_range_lte + '" } } }';
        }
        console.log('strColumns ', strColumns.toString(), 'header_search ', header_search);
        must = must + ' ]';
        must_not = must_not + ' ]';
        const searchQuery  =  JSON.parse(filters).query.query.split(':');
        // add the search query here if the query field is not null
        //console.log('JSON.parse(filters) is ', JSON.parse(filters).query);
        console.log('searchQuery ', searchQuery);
        if(JSON.parse(filters).query.query)
        {
          body = '"query": { "bool": { ' + must + ', "filter": [ { "bool": {"should": [{"match": { "' + searchQuery[0] + '":"' +  searchQuery[1] + '" }}]}}], "should": [], ' + must_not + ' } } ';
        }
        else
        {
          body = '"query": { "bool": { ' + must + ', "filter": [ { "match_all": {} } ], "should": [], ' + must_not + ' } } ';
        }
        //console.log('body: ', body);
        const bodyCount = '{' + body + '}';
        body = '{ "version": true, "size": 1000, "_source": { "includes": [' + strColumns + '] },' + body + '}';
        console.log('body: ', (body));
        //console.log('bodyCount: ', (bodyCount));
        //console.log('resIndexPattern.title: ', resIndexPattern.title);

        //Count
        //const queryCount = ESPATH + resIndexPattern.title + '/_count';
        const resCount = await ESFetchCount(resIndexPattern.title, bodyCount);
        //check if limit size is reached
        console.log('nb rows: ', (resCount.count));
        if ((resCount.count) > MaxCSVRows) {
          await writeToCSVIndexInfo('csv Generator CsvGeneratorService - file is too large!', 'failed');
          //console.log("generateCSV - csv size is too large");
          //return { ok: false, resp: 'file is too large!' };
        }
        const nb_countDiv = (resCount.count / 10000);
        const modulo_countDiv = ((resCount.count) % 10000);
        //console.log('nb_countDiv : ', nb_countDiv);
        //console.log('modulo_countDiv :', modulo_countDiv);

        //Fecth data
        const resData = await ESFetchData(JSON.parse(body));
        //console.log('resData', resData);

        const arrayHits = [];
        arrayHits.push(resData.hits);
        if (nb_countDiv > 0) {
          for (let i = 0; i < modulo_countDiv + 1; i++) {
            const resScroll = await ESFetchScroll(resData._scroll_id);
            if (Object.keys(resScroll.hits.hits).length > 0) {
              arrayHits.push(resScroll.hits);
            }
          }
        }
        //No data in elasticsearch
        if (resData.hits.total.value === 0) {
          console.log('csv Generator CsvGeneratorService  - No Content');
          await writeToCSVIndexInfo('csv Generator CsvGeneratorService - No Content in elasticsearch', 'failed');
          //return { ok: false, resp: 'csv Generator CsvGeneratorService - No Content in elasticsearch' };
          return { ok: false, resp: 'No Content in elasticsearch!' };
        }

        //Transform data into csv
        if (fields_exist === true) {
          //get the selected fields
          header = header_search;
        }
        console.log('header_search ', header_search);
        console.log('header is', header);
        console.log('resIndexPattern.timeFieldName is', resIndexPattern.timeFieldName);
        //Get data
        for(const valueRes of arrayHits) {
          for(const data_ of valueRes.hits) {
            if (fields_exist === true) {
              const result = traverse(data_, header_search);
              dataset.push(result);
            }else{
              dataset.push(data_);
            }
          }
        }
        console.log('dataset', dataset);
        //console.log('dataset is', dataset);
        //Create csv file
        strFilename = savedSearchInfos._source.search.title + '_' + time_range_gte + '_' + time_range_lte + '.csv';
        // eslint-disable-next-line no-loop-func
        converter.json2csvAsync(dataset).then(csv => {
          // const buf = Buffer.from(JSON.stringify(csv), 'base64');
          const buf = Buffer.from(JSON.stringify(csv)).toString('base64');
          //console.log('the buffer is ', buf);
          console.log('typeOf buffer is ', typeof (buf));
          fs.outputFile('plugins/csv_generator/public/csv/' + strFilename, csv, err => {
            if(err) {
              console.log('generateCSV - Cannot create csv file - err:', err);
            } else{
              // const file = {
              //   saveSearch: strFilename,
              //   status: 'success',
              //   download: 'http://localhost:5601/plugins/csv_generator/csv/' + strFilename,
              //   date: moment().format('DD-MM-YYYY HH:mm:ss'),
              // };
            }
          });
          saveCSVToCSVIndexInfo(strFilename, 'http://localhost:5601/plugins/csv_generator/csv/' + strFilename, moment().format('DD-MM-YYYY HH:mm:ss'), 'success', buf);

        }).catch(err => console.log(err));
        return { ok: true, resp: 'csv file generated !' };
      }
    }
  }
}
