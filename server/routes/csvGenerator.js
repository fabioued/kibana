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

export default function (server, options, services) {
  const { csvService }  = services;
  const { setupService } = services;
  const { downloadService } = services;
  const { recentCsvService } = services;

  server.route({
    path: '/api/csvGenerator/setup',
    method: 'GET',
    handler: setupService.setup,
  });

  server.route({
    path: '/api/csvGenerator/history',
    method: 'GET',
    handler: recentCsvService.getRecentCSV,
  });

  server.route({
    path: '/api/csvGenerator/savedObjects/{savedsearchId}/{start}/{end}',
    method: 'GET',
    handler: csvService.createPendingCsv,
  });

  server.route({
    path: '/api/csvGenerator/download/{csvId}',
    method: 'GET',
    handler: downloadService.download,
  });

  // server.route({
  //   path: '/api/csvGenerator/example',
  //   method: 'GET',
  //   handler() {
  //     return { ElasticsearchConfig, ConfigOptions };
  //   }
  // });


}
