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
  EuiPage,
  EuiTitle,
  EuiPageBody,
  EuiPageContent,
  EuiPageContentHeader,
  EuiPageContentBody,
  EuiFlexGroup,
  EuiButton,
  EuiSpacer,
  EuiComboBox,
  EuiSuperDatePicker,
  EuiLoadingContent,
} from '@elastic/eui';
import dateMath from '@elastic/datemath';
import chrome from 'ui/chrome';
import { toastNotifications } from 'ui/notify';

import { FormattedMessage } from '@kbn/i18n/react';
import { CsvItem } from '../CsvItem';

export class Main extends React.Component {
  constructor(props) {
    super(props);
    const date = new Date();
    this.state = {
      isPaused: true,
      hideCsvItem: true,
      hideLoader: true,
      isDisabled: true,
      isClearable: true,
      buttonIsLoading: false,
      prevState: '',
      value: '',
      query: '',
      selected: '',
      recentlyUsedRanges: [],
      refreshInterval: 5,
      isLoading: false,
      start: 'now-30m',
      end: date.toString(),
      items: [],
      recentCsv: [],
      pageIndex: 0,
      pageSize: 5,
      showPerPageOptions: true,
      savedObjects: [],
      options: [],
      selectedOptions: [],
    };
  }

  onTimeChange = ({ start, end }) => {
    this.setState(prevState => {
      const recentlyUsedRanges = prevState.recentlyUsedRanges.filter(recentlyUsedRange => {
        const isDuplicate = recentlyUsedRange.start === start && recentlyUsedRange.end === end;
        return !isDuplicate;
      });
      recentlyUsedRanges.unshift({ start, end });
      return {
        start,
        end,
        recentlyUsedRanges:
          recentlyUsedRanges.length > 10 ? recentlyUsedRanges.slice(0, 9) : recentlyUsedRanges,
        isLoading: true,
      };
    }, this.startLoading);
  };

  onRefresh = ({ start, end, refreshInterval }) => {
    return new Promise(resolve => {
      setTimeout(resolve, 100);
    }).then(() => {
      console.log(start, end, refreshInterval);
    });
  };

  startLoading = () => {
    setTimeout(this.stopLoading, 1000);
  };

  stopLoading = () => {
    this.setState({ isLoading: false });
  };

  onRefreshChange = ({ isPaused, refreshInterval }) => {
    this.setState({
      isPaused,
      refreshInterval,
    });
  };

  onChange = e => {
    this.setState({
      value: e.target.value,
      query: e.target.value,
    });
  };

  onSelectChange = selectedOptions => {
    console.log('selectedOptions are', selectedOptions);
    console.log('selectedOptions.length are', selectedOptions.length);
    if (selectedOptions.length === 0) {
      console.log('selectedOptions.length are 0');
      this.setState({
        isDisabled: true
      });
      console.log('isDisabled ', this.state.isDisabled);
    }
    this.setState({
      selectedOptions: selectedOptions,
      isDisabled: false
    });
    console.log('selected save search object', selectedOptions);
  };

  setup = () => {
    const { httpClient } = this.props;
    httpClient
      .get(chrome.addBasePath('/api/csvGenerator/setup'))
      .then(res => {
        console.log('plugin setting up ', res);
        this.getRecentCsv();
      })
      .catch(error => {
        if(error) {
          toastNotifications.addDanger('An Error Occurred While setting up the plugin');
          throw error;
        }
      });
  };

  getRecentCsv = () => {
    const { httpClient } = this.props;
    return httpClient
      .get(chrome.addBasePath('/api/csvGenerator/history'))
      .then(res => {
        this.setState({
          recentCsv: res.data.resp
        });
        console.log('recentCsv are ', this.state.recentCsv);
        // console.log('this.state.recentCsv.length ', this.state.recentCsv.length);
        if(this.state.recentCsv.length !== 0) {
          this.setState({ hideCsvItem: false });
        }
        return { ok: true, resp: res.data };
      })
      .catch(error => {
        if(error) {
          toastNotifications.addDanger('An Error Occurred While fetching the recent generated csv');
          return { ok: false, resp: error.message };
        }
      });
  };

  getSavedSearch = () => {
    const url = chrome.addBasePath('/api/kibana/management/saved_objects/_find?perPage=10000&page=1&fields=id&type=search');
    const { httpClient } = this.props;
    httpClient
      .get(url)
      .then(res => {
        const data = res.data.saved_objects;
        data.map((data) => {
          this.state.options.push({ label: data.meta.title, id: data.id });
        });
        this.setState({ savedObjects: data });
        console.log('options in state are ', this.state.savedObjects);
      })
      .then((error) => {
        if(error) {
          this.setState({ options: [] });
          //this.state.options = [];
          toastNotifications.addDanger('An Error Occurred While fetching the Saved Search');
          throw new Error('An Error Occurred While fetching the Saved Search');
        }
      });
  };

  refreshRecevntCsv = () => {
    this.setState({
      hideLoader: false,
      hideCsvItem: true,
    });
    this.getRecentCsv().then(function (result) {
      //console.log('result.resp is', result.resp);
      if(result.ok) {
        toastNotifications.addSuccess('Refreshing done!');
      }else{
        toastNotifications.addDanger('Ouppss An Error Occured ! ' + result.resp);
      }
    });
    this.setState({
      hideLoader: true,
      hideCsvItem: false,
    });
  }
  //send to server to generate the csv
  generateCsv = () => {
    const { httpClient } = this.props;
    if (this.state.selectedOptions.length === 0) {
      toastNotifications.addDanger('Please select a saved search !');
      throw new Error('Please select a saved search !');
    }
    const savedSearchId = this.state.selectedOptions[0].id;
    const start         = this.state.start;
    const end           = this.state.end;
    const startMoment   = dateMath.parse(start);
    if (!startMoment || !startMoment.isValid()) {
      toastNotifications.addDanger('Unable to get the start Date');
      throw new Error('Unable to parse start string');
    }
    const endMoment = dateMath.parse(end);
    if (!endMoment || !endMoment.isValid()) {
      toastNotifications.addDanger('Unable to get the end Date');
      throw new Error('Unable to parse end string');
    }

    if (startMoment > endMoment) {
      this.setState({
        isDisabled: true,
      });
      toastNotifications.addDanger('Wrong Date Selection');
      throw new Error('Unable to parse end string');
    }

    //console.log('start is ', start);
    console.log('startMoment is ', startMoment);
    //console.log('end  is ', end);
    console.log('endMoment  is ', endMoment);
    //console.log('new date   is ', new Date());

    //api url
    const url = '../api/csvGenerator/savedObjects/' + savedSearchId + '/' + startMoment + '/' + endMoment;
    this.setState({
      hideLoader: false,
      hideCsvItem: true,
      buttonIsLoading: true,
    });
    httpClient.get(url).then(result => {
      console.log('result', result.data);
      this.setState({
        hideLoader: true,
        buttonIsLoading: false,
        hideCsvItem: false
      });
      if(result.data) {
        httpClient.get(chrome.addBasePath('/api/csvGenerator/history')).then(res => {
          this.setState({
            recentCsv: res.data.resp
          });
          // console.log('res is ', res);
          // console.log('new csv are ', res.data.resp);
          // console.log('new recentCsv are ', this.state.recentCsv);
        });
        //toastNotifications.addSuccess(result.data.resp);
      }else{
        toastNotifications.addDanger(result.data.resp);
      }
    });


    // httpClient.get(url).then(res => {
    //   // const newdata = this.getRecentCsv().then(async result => {
    //   //   console.log('new data inside ', result);
    //   //   return result;
    //   // });
    //   this.getRecentCsv().then(function (result) {
    //     //console.log('result.resp is', result.resp);
    //     if(result.ok) {
    //       toastNotifications.addSuccess('Refreshing done!');
    //     }else{
    //       toastNotifications.addDanger('Ouppss An Error Occured ! ' + result.resp);
    //     }
    //   });
    //   console.log('new data', newdata);
    //   this.setState({
    //     hideLoader: true,
    //     buttonIsLoading: false,
    //     hideCsvItem: false
    //   });
    //   console.log('api part', res.data);
    //   if(res.data.ok) {
    //     toastNotifications.addSuccess(res.data.resp);
    //   }else{
    //     toastNotifications.addDanger(res.data.resp);
    //   }
    // });
  };
  componentDidMount() {
    this.setup();
    this.getSavedSearch();
  }
  componentWillUnmount() {
    //this._isMounted = false;
  }

  render() {
    const { title } = this.props;
    //const { selectedOptions } = this.state;
    return (
      <EuiPage>
        <EuiPageBody>
          <EuiPageContent>
            <EuiPageContentHeader>
              <EuiTitle>
                <h2>
                  <FormattedMessage
                    id="csvGenerator.defaultMessage"
                    defaultMessage="{title}"
                    values={{ title }}
                  />
                </h2>
              </EuiTitle>
            </EuiPageContentHeader>
            <EuiPageContentBody>
              <EuiFlexGroup style={{ padding: '0px 5px' }}>
                <EuiComboBox
                  placeholder="Select a Saved Search"
                  singleSelection={{ asPlainText: true }}
                  options={this.state.options}
                  selectedOptions={this.state.selectedOptions}
                  onChange={this.onSelectChange}
                  isClearable={true}
                />
                <EuiSuperDatePicker
                  isLoading={this.state.isLoading}
                  start={this.state.start}
                  end={this.state.end}
                  onTimeChange={this.onTimeChange}
                  onRefresh={this.onRefresh}
                  isPaused={this.state.isPaused}
                  refreshInterval={this.state.refreshInterval}
                  onRefreshChange={this.onRefreshChange}
                  showUpdateButton={false}
                  style={{ margingTop: '50px' }}
                />
                <EuiButton isLoading={this.state.buttonIsLoading} isDisabled={this.state.isDisabled}  fill onClick={this.generateCsv}>
                  Generate
                </EuiButton>
              </EuiFlexGroup>
              <EuiSpacer size="l" />
              <EuiSpacer size="xl" />
              {/* <EuiLoadingContent  lines={10} /> */}
              { this.state.hideLoader ? null : <EuiLoadingContent  lines={10} /> }
              { this.state.hideCsvItem ? null : <CsvItem title="List of Generated CSV" items={this.state.recentCsv} refresh={this.refreshRecevntCsv} /> }
            </EuiPageContentBody>
          </EuiPageContent>
        </EuiPageBody>
      </EuiPage>
    );
  }
}
