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


import { resolve } from 'path';
import { existsSync } from 'fs';

import { i18n } from '@kbn/i18n';

import csvGeneratorRoute from './server/routes/csvGenerator';

export default function (kibana) {
  return new kibana.Plugin({
    require: ['elasticsearch'],
    name: 'csv_generator',
    uiExports: {
      app: {
        title: 'Csv Generator',
        description: 'csv Generator',
        main: 'plugins/csv_generator/app',
      },
      hacks: ['plugins/csv_generator/hack'],
      styleSheetPaths: [
        resolve(__dirname, 'public/app.scss'),
        resolve(__dirname, 'public/app.css'),
      ].find(p => existsSync(p)),
    },

    config(Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
      }).default();
    },

    // eslint-disable-next-line no-unused-vars
    init(server, options) {
      const esDriver            = server.plugins.elasticsearch;
      const esServer            = server.plugins;
      const CsvGeneratorService = require('./server/services/CsvGeneratorService');
      const SetupService        = require('./server/services/SetupService');
      const DownloadService     = require('./server/services/DownloadService');
      const RecentCsvService    = require('./server/services/RecentCsvService');
      const csvService          = new CsvGeneratorService(esDriver, esServer);
      const setupService        = new SetupService(esDriver, esServer);
      const downloadService     = new DownloadService(esDriver, esServer);
      const recentCsvService    = new RecentCsvService(esDriver, esServer);
      const services            = { csvService, setupService, downloadService, recentCsvService };

      const xpackMainPlugin = server.plugins.xpack_main;
      if (xpackMainPlugin) {
        const featureId = 'csv_generator';

        xpackMainPlugin.registerFeature({
          id: featureId,
          name: i18n.translate('csvGenerator.featureRegistry.featureName', {
            defaultMessage: 'csvGenerator',
          }),
          navLinkId: featureId,
          icon: 'questionInCircle',
          app: [featureId, 'kibana'],
          catalogue: [],
          privileges: {
            all: {
              api: [],
              savedObject: {
                all: [],
                read: [],
              },
              ui: ['show'],
            },
            read: {
              api: [],
              savedObject: {
                all: [],
                read: [],
              },
              ui: ['show'],
            },
          },
        });
      }

      // Add server routes and initialize the plugin here
      csvGeneratorRoute(server, options, services);
    },
  });
}
