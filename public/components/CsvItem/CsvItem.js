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


import React from 'react';
import {
  EuiTitle,
  EuiPageContent,
  EuiButton,
  EuiBasicTable,
  EuiHealth,
  EuiFlexGrid,
  EuiFlexItem
} from '@elastic/eui';
import chrome from 'ui/chrome';
import { toastNotifications } from 'ui/notify';
import axios from 'axios';

const ITEM_BIG = { width: '80%' };
const ITEM_SMALL = { width: '10%' };
export class CsvItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      savedObjects: {},
      buttonIsLoading: false,
      downloadButLoading: false,
      isDisabled: false,
      downloadButDisabled: false,
    };
  }

  download = (id) => {
    const url = '/api/csvGenerator/download/' + id;
    console.log('the base path is ', chrome.addBasePath(url));
    axios.get(url).then(res => {
      //toastNotifications.addSuccess(res.data.resp);
      console.log('download is', res.data);
      const FileSaver = require('file-saver');
      const csv = new Blob([res.data.resp.csv], { type: 'text/csv;charset=utf-8' });
      FileSaver.saveAs(csv, res.data.resp.filename);
    }).then(error => {
      if(error) {
        toastNotifications.addDanger('An Error Occurred While downloading the file');
        throw error;
      }
    });
  };
  render() {
    const getRowProps = item => {
      const { id }    = item;
      //console.log('item is ', item);
      if(item.error !== 'Succesfully Generated') {
        return '';
      }else{
        return {
          'data-test-subj': `row-${id}`,
          className: 'customRowClass',
          onClick: () => this.download(id),
        };
      }
    };

    const sorting = {
      sort: {
        field: 'saveSearch',
        direction: 'asc',
        enableAllColumns: true
      },
    };
    const onTableChange = ({ sort = {} }) => {
      const { field: sortField, direction: sortDirection } = sort;
      sorting.sort.field = sortField;
      sorting.sort.direction = sortDirection;

    };
    const columns = [
      {
        field: 'username',
        name: 'User',
        sortable: true,
      },
      {
        field: 'saveSearch',
        name: 'Saved Search',
        sortable: true,
      },
      {
        field: 'status',
        name: 'Status',
        sortable: true,
        dataType: 'boolean',
        render: status => {
          let color = '';
          if(status === 'success') {
            color = 'success';
          }else if(status === 'pending') {
            color = 'warning';
          }else{
            color = 'danger';
          }
          return <EuiHealth color={color}>{status}</EuiHealth>;
        },
      },
      {
        field: 'error',
        name: 'Message',
        sortable: true,
      },
      {
        field: 'date',
        name: 'Date',
        schema: 'date',
        sortable: true,
      },
      {
        field: 'status',
        name: 'Download',
        sortable: true,
        render: (status) => {
          return status === 'success' ? <EuiButton isLoading={this.state.downloadButLoading} isDisabled={this.state.downloadButDisabled}  fill onClick={this.generate}>Download </EuiButton> : '';
        },
      },
    ];
    return (
      <EuiPageContent>
        <EuiFlexGrid >
          <EuiFlexItem style={ITEM_BIG}>
            <EuiTitle size="m">
              <h1>{this.props.title} ({this.props.items.length})  </h1>
            </EuiTitle>
          </EuiFlexItem>
          <EuiFlexItem style={ITEM_SMALL}>
            <EuiButton isLoading={this.state.buttonIsLoading} isDisabled={this.state.isDisabled}  fill onClick={this.props.refresh}>
              Refresh
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGrid>
        <EuiBasicTable
          items={this.props.items}
          columns={columns}
          rowProps={getRowProps}
          sorting={sorting}
          onChange={onTableChange}
          isSelectable={true}
        />
      </EuiPageContent>
    );
  }
}
