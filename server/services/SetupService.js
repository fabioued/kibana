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
const INDEXNAME   = 'csvgenerator';
export default class SetupService {
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
          'userId': {
            'type': 'text'
          },
          'username': {
            'type': 'text'
          },
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
      const { callWithRequest } = this.esDriver.getCluster('data');
      const mappings = await callWithRequest(_req, 'indices.create', { index: INDEXNAME });
      await this.putMapping(_req);
      return { ok: true, resp: mappings };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - createCSVIndex:', err);
      return { ok: false, resp: err.message };
    }
  }

  setup = async (_req) => {
    try {
      const indexExist = await this.checkIndexExist(_req);
      console.log('indexExist is ', indexExist);
      if(!indexExist.resp) {
        await this.createCSVIndex(_req);
      }
      return { ok: true, resp: 'done' };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - setup:', err);
      return { ok: false, resp: err.message };
    }
  }
}
