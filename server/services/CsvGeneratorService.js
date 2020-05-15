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
const moment      = require('moment');
const converter   = require('json-2-csv');
const { AsyncParser } = require('json2csv');
const MaxCSVRows  = 100000;
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
      //console.log('csv._source.file ', csv._source.file);
      const data = { filename: csv._source.file, csv: JSON.parse(json) };
      //console.log('json parse is ', JSON.parse(json));
      return { ok: true, resp: data };
    } catch (err) {
      //console.error('CSV Generator - CsvGeneratorService - getSingleCSV:', err);
      return { ok: false, resp: err.message };
    }
  }
  saveCSVToIndex = async (_req, file, status, binary, error, username, type) => {
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const date = moment().format('DD-MM-YYYY HH:mm:ss');
      //console.log('saving csv to index');
      const params  = {
        index: INDEXNAME,
        body: {
          fileType: type,
          file: file,
          downloadLink: '',
          date: date,
          status: status,
          binary: binary,
          error: error,
          userId: 'user id here',
          username: username,
        }
      };
      const document = await callWithRequest(_req, 'index', params);
      return document;
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - saveCSVToIndex - Error from while saving csv to index:', err);
      return { ok: false, resp: err.message };
    }
  }

 updateCSV = async (_req, documentId, status, binary, error) => {
   try {
     const { callWithRequest } = this.esDriver.getCluster('data');
     console.log('updating the csv in the  index');
     const params  = {
       index: INDEXNAME,
       id: documentId,
       body: {
         doc: {
           status: status,
           binary: binary,
           error: error
         }
       }
     };
     //console.log('params are ', params);
     const document = await callWithRequest(_req, 'update', params);
     return document;
   } catch (err) {
     this.updateCSV(_req, documentId, 'failed', '', err);
     console.error('CSV Generator - CsvGeneratorService - updateCSV - Error from while updating the csv to index:', err);
     return { ok: false, resp: err.message };
   }
 }
  savedSearchInfo = async (_req, savedsearchId) => {
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const savedsearchIdFromES = await callWithRequest(_req, 'get',
        {
          index: '.kibana',
          id: 'search:' + savedsearchId
        });
      return savedsearchIdFromES;
    } catch (err) {
      console.error('getSavedSearch Infos - Error while fetching savedSearch Infos from elasticsearch:', err);
      return { ok: false, resp: err.message };
    }
  }
  indexPattern    = async (_req, indexpatternId) => {
    const { callWithRequest } = this.esDriver.getCluster('data');
    //const queryPattern       = ESPATH + '.kibana/_doc/index-pattern:' + item.id;
    const indexpatern = await callWithRequest(_req, 'get',
      {
        index: '.kibana',
        id: 'index-pattern:' + indexpatternId
      });
    return indexpatern;
  }
  esFetchCount = async (_req, indexPatternTitle, bodyCount) => {
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const fecthCountRes       =  callWithRequest(_req, 'count', {
        index: indexPatternTitle,
        body: bodyCount
      });
      return fecthCountRes;
    }catch (err) {
      console.error('CSV Generator - CsvGeneratorService - ESFetchCount - Error while counting the number of elements in ElasticSearch ', err);
      return { ok: false, resp: err.message };
    }
  }
  esFetchData = async (_req, body) => {
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const fecthDataRes        =  callWithRequest(_req, 'search', {
        scroll: '1m',
        body: body
      }).then(response => {
        return response;
      }).catch((err) =>{
        console.log('ESFetchData - Error while Fetching the data from ElasticSearch ', err);
      });
      return fecthDataRes;
    }catch (err) {
      console.error('CSV Generator - CsvGeneratorService - ESFetchData - Error while Fetching the data from ElasticSearch ', err);
      return { ok: false, resp: err.message };
    }
  }
  esFetchScroll = async (_req, scrollId) => {
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const fecthDataScrollRes  = callWithRequest(_req, 'scroll', {
        scrollId: scrollId,
        scroll: '1m',
      });
      return fecthDataScrollRes;
    }catch (err) {
      console.error('CSV Generator - CsvGeneratorService - ESFetchScroll - Error while Fetching the scroll data from ElasticSearch ', err);
      return { ok: false, resp: err.message };
    }
  }
  traverse = (data, keys, result = {}) => {
    for (const k of Object.keys(data)) {
      if (keys.includes(k)) {
        result = ({ ...result, ...{
          [k]: data[k]
        } });
        continue;
      }
      if (data[k] && typeof data[k] === 'object' && Object.keys(data[k]).length > 0)
      {
        result = this.traverse(data[k], keys, result);
      }
    }
    return result;
  }
  genereteCsv = async (_req, documentId) => {
    const time_range_gte  = _req.params.start;
    const time_range_lte  = _req.params.end;
    const savedsearchId   = _req.params.savedsearchId;
    let strColumns        = '';
    const header_search   = [];
    let fields_exist      = false;
    let savedSearchInfos  = {};
    let indexPatter       = '';
    let resIndexPattern   = '';
    let fieldsPattern     = '';
    let body              = '';
    let header            = [];
    const dataset         = [];
    const nullBinary      = 'bnVsbA==';

    savedSearchInfos = await this.savedSearchInfo(_req, savedsearchId);
    const filters    = savedSearchInfos._source.search.kibanaSavedObjectMeta.searchSourceJSON;
    for(const column of savedSearchInfos._source.search.columns) {
      if (column !== '_source') {
        if(strColumns !== '') {
          strColumns = strColumns + ',';
        }
        const split = column.split('.');
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
    //Get index name
    for(const item of savedSearchInfos._source.references) {
      if (item.name === JSON.parse(filters).indexRefName) {
        //Get index-pattern informations (index-pattern name & timeFieldName)
        indexPatter              = await  this.indexPattern(_req, item.id);
        resIndexPattern          = indexPatter._source['index-pattern'];
        fieldsPattern            = resIndexPattern.fields;  //Get fields type
        //Get fields Date
        const list_columns_date  = [];
        for(const item of JSON.parse(fieldsPattern)) {
          if (item.type === 'date') {
            list_columns_date.push(item.name);
          }
        }
        //building query
        let must     = '"must": [ ';
        let must_not = '"must_not": [ ';
        for(const item of JSON.parse(filters).filter) {
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
        if (resIndexPattern.timeFieldName !== '') {
          if (strColumns !== '') {
            strColumns = ',' + strColumns;
          }

          if(fields_exist) {
            strColumns = '"' + resIndexPattern.timeFieldName + '"' + strColumns;
          }
          //strColumns = '"' + resIndexPattern.timeFieldName + '"' + strColumns;
          if (must !== '"must": [ ') {
            if (resIndexPattern.timeFieldName) {
              must = must + ',';
              must = must + '{ "range": { "' + resIndexPattern.timeFieldName + '": { "format": "epoch_millis", "gte": "' + time_range_gte + '", "lte": "' + time_range_lte + '" } } }';
            }
          }
          if (resIndexPattern.timeFieldName) {
            must = must + '{ "range": { "' + resIndexPattern.timeFieldName + '": { "format": "epoch_millis", "gte": "' + time_range_gte + '", "lte": "' + time_range_lte + '" } } }';
          }
          //console.log('resIndexPattern is', resIndexPattern);
          //console.log('resIndexPattern.timeFieldName is', resIndexPattern.timeFieldName);
        }

        must               = must + ' ]';
        must_not           = must_not + ' ]';
        const searchQuery  =  JSON.parse(filters).query.query.split(':');
        // add the search query here if the query field is not null
        if(JSON.parse(filters).query.query) {
          body = '"query": { "bool": { ' + must + ', "filter": [ { "bool": {"should": [{"match": { "' + searchQuery[0] + '":"' +  searchQuery[1] + '" }}]}}], "should": [], ' + must_not + ' } } ';
        }
        else {
          body = '"query": { "bool": { ' + must + ', "filter": [ { "match_all": {} } ], "should": [], ' + must_not + ' } } ';
        }
        const bodyCount = '{' + body + '}';
        body            = '{ "version": true, "size": 1000, "_source": { "includes": [' + strColumns + '] },' + body + '}';
        //Count
        //console.log('body is', body);
        const resCount  = await this.esFetchCount(_req, resIndexPattern.title, bodyCount);
        //check if limit size is reached
        console.log('nb rows: ', (resCount.count));
        if (resCount.count === 0) {
          this.updateCSV(_req, documentId, 'failed', nullBinary, 'No Content.');
          return { ok: false, resp: 'No Content in elasticsearch!' };
        }
        const newCount = resCount.count;
        if ((resCount.count) > MaxCSVRows) {
          //chunk the data to 100 000 and then stop
          // newCount = 100;
          //await writeToCSVIndexInfo('csv Generator CsvGeneratorService - file is too large!', 'failed');
          //console.log("generateCSV - csv size is too large");
          this.updateCSV(_req, documentId, 'failed', nullBinary, 'Data too large.');
          return { ok: false, resp: 'file is too large!' };
        }
        const nb_countDiv     = (resCount.count / 10000);
        const modulo_countDiv = ((resCount.count) % 10000);
        //Fecth data
        //console.log('bodyCount is', bodyCount);
        //console.log('JSON.parse(body) is', JSON.parse(body));
        const resData   = await this.esFetchData(_req, JSON.parse(body));
        //console.log('resData.hits ', resData.hits);
        //console.log('resData.hits.total.value ', resData.hits.total.value);
        const arrayHits = [];
        arrayHits.push(resData.hits);
        if (nb_countDiv > 0) {
          for (let i = 0; i < nb_countDiv + 1; i++) {
            const resScroll = await this.esFetchScroll(_req, resData._scroll_id);
            if (Object.keys(resScroll.hits.hits).length > 0) {
              arrayHits.push(resScroll.hits);
            }
          }
        }
        //No data in elasticsearch
        if (resData.hits.total.value === 0) {
          this.updateCSV(_req, documentId, 'failed', nullBinary, 'No Content in elasticsearch!');
          return { ok: false, resp: 'No Content in Elasticsearch ' };
        }
        if (fields_exist === true) {
          header = header_search; //get the selected fields
        }
        //console.log('header search is ', header_search);
        //Get data
        for(const valueRes of arrayHits) {
          for(const data_ of valueRes.hits) {
            if (fields_exist === true) {
              const result = this.traverse(data_, header_search);
              dataset.push(result);
            }else{
              dataset.push(data_);
            }
          }
        }
        //console.log('dataset  is; ', dataset.slice(0, 10));
        const roughObjSize = JSON.stringify(dataset).length;
        converter.json2csvAsync(dataset).then(csv => {
          const buf = Buffer.from(JSON.stringify(csv)).toString('base64');
          const bufroughObjSize = JSON.stringify(csv).length;
          console.log('dataset size csv is; ', bufroughObjSize);
          //console.log('buffer size is; ', buf.byteLength);
          this.updateCSV(_req, documentId, 'success', buf, 'Succesfully Generated');
          // if(newCount === resCount.count) {
          //   this.updateCSV(_req, documentId, 'success', buf, 'Succesfully Generated');
          // }else{
          //   this.updateCSV(_req, documentId, 'success', buf, 'Truncated Data');
          // }

        }).catch(err => {
          console.log(err);
          this.updateCSV(_req, documentId, 'failed', nullBinary, err);
        });
      }
    }
  }
  createPendingCsv = async (_req) => {
    let username           = '';
    const time_range_gte   = _req.params.start;
    const time_range_lte   = _req.params.end;
    const savedsearchId    = _req.params.savedsearchId;
    if (this.esServer.security)
    {
      this.esServer.security.getUser(_req).then(user => {
        // ticket.fields.reporter.name = user.username
        //console.log('user is ', user);
        username = user.username;
      });
    }

    const savedSearchInfos = await this.savedSearchInfo(_req, savedsearchId);
    const stripSpaces      = savedSearchInfos._source.search.title.split(' ').join('_');
    const strFilename      = stripSpaces + '_' + time_range_gte + '_' + time_range_lte + '.csv';
    const nullBinary       = 'bnVsbA==';
    const document         = await this.saveCSVToIndex(_req, strFilename, 'pending', nullBinary, 'Csv being Generated', username, 'csv');
    this.genereteCsv(_req, document._id);
    return { ok: true, resp: 'csv file pending !' };
  }
}
