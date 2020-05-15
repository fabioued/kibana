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

export default class DownloadService {
  constructor(esDriver, esServer) {
    this.esDriver = esDriver;
    this.esServer = esServer;
  }
  getSingleCSV = async (_req) => {
    const csvId                 = _req.params.csvId;
    try {
      const { callWithRequest } = this.esDriver.getCluster('data');
      const csv                 = await callWithRequest(_req, 'get', { index: INDEXNAME,  id: csvId });
      const binary              = csv._source.binary;
      const json                = Buffer.from(binary, 'base64').toString('utf-8');
      const data                = { filename: csv._source.file, csv: JSON.parse(json) };
      return { ok: true, resp: data };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - getSingleCSV:', err);
      return { ok: false, resp: err.message };
    }
  }

  download = async (_req) => {
    try {
      const recentsCsv = await this.getSingleCSV(_req);
      return { ok: true, resp: recentsCsv.resp };
    } catch (err) {
      console.error('CSV Generator - CsvGeneratorService - getHistory:', err);
      return { ok: false, resp: err.message };
    }
  }
}
