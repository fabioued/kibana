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

const INDEXNAME   = 'csvgenerator';

export default class RecentCsvService {
  constructor(esDriver, esServer) {
    this.esDriver = esDriver;
    this.esServer = esServer;
  }
  recentCSV = async (_req) => {
    try {
      const histories           = [];
      const { callWithRequest } = this.esDriver.getCluster('data');
      const indexes             = await callWithRequest(_req, 'search', {
        index: INDEXNAME,
        body: {
          'size': 10,
          'sort': [ { 'date': { 'order': 'desc' } }],
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
      //indexes.hits.hits.sort((a, b) => b._source.date - a._source.date);
      for(const history of indexes.hits.hits) {
        histories.push({
          id: history._id,
          saveSearch: history._source.file,
          status: history._source.status,
          error: history._source.error,
          date: history._source.date,
          download: history._source.downloadLink,
          userId: history._source.userId,
          username: history._source.username
        });
      }
      return { ok: true, resp: histories };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - getRecentCSV:', err);
      return { ok: false, resp: err.message };
    }
  }

  getRecentCSV = async (_req) => {
    try {
      const recentsCsv =  await this.recentCSV(_req);
      return recentsCsv;
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - getHistory:', err);
      return { ok: false, resp: err.message };
    }
  }
}
