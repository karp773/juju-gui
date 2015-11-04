/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2015 Canonical Ltd.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3, as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranties of MERCHANTABILITY,
SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

var juju = {components: {}}; // eslint-disable-line no-unused-vars
var testUtils = React.addons.TestUtils;

chai.config.includeStack = true;
chai.config.truncateThreshold = 0;

describe('SearchResults', function() {

  beforeAll(function(done) {
    // By loading these files it makes their classes available in the tests.
    YUI().use('search-results', function() { done(); });
  });

  describe('functional tests', function() {
    it('can be rendered', function() {
      var shallowRenderer = testUtils.createRenderer();
      var query = 'spinach';
      shallowRenderer.render(
          <juju.components.SearchResults
            query={query} />);

      var output = shallowRenderer.getRenderOutput();
      assert.equal(output.props.className,
                   'search-results search-results--floating',
                   'Class name not set properly');
      var html = output.props.dangerouslySetInnerHTML.__html;
      assert.isAbove(html.indexOf('Loading'), -1,
                     'Loading message not found');
    });

    it('does not have the floating class if it is inline', function() {
      var shallowRenderer = testUtils.createRenderer();
      var query = 'spinach';
      shallowRenderer.render(
          <juju.components.SearchResults
            inline={true}
            query={query} />);
      var output = shallowRenderer.getRenderOutput();
      assert.deepEqual(output,
        <div className="search-results"
          onClick={output.props.onClick}
          dangerouslySetInnerHTML={{__html:
              output.props.dangerouslySetInnerHTML.__html}}>
        </div>);
    });

    it('loads search results', function() {
      var query = 'spinach';
      var result = {
        name: 'spinach',
        displayName: 'spinach',
        url: 'http://example.com/spinach',
        downloads: 1000,
        owner: 'test-owner',
        promulgated: true,
        id: 'spinach',
        type: 'charm'
      };
      var mockModel = {};
      mockModel.toEntity = sinon.stub().returns(result);
      var mockData = [mockModel];
      var charmstoreSearch = sinon.stub().callsArgWith(1, mockData);

      var output = testUtils.renderIntoDocument(
          <juju.components.SearchResults
            query={query}
            charmstoreSearch={charmstoreSearch} />);

      assert.isTrue(charmstoreSearch.calledOnce,
                    'search function not called');
      assert.isTrue(mockModel.toEntity.callCount == mockData.length,
                    'all models not converted to plain old objects');
      var data = output.state.data;
      assert.equal(data.text, query,
                   'search text not set to the query');
      assert.equal(data.solutionsCount, mockData.length,
                   'total results returned is incorrect');
    });

    it('navigates to the entity on click', function() {
      var changeState = sinon.stub();
      var query = 'spinach';
      var result = {
        name: 'spinach',
        displayName: 'spinach',
        url: 'http://example.com/spinach',
        downloads: 1000,
        owner: 'test-owner',
        promulgated: true,
        series: 'wily',
        type: 'charm'
      };
      var mockModel = {};
      mockModel.toEntity = sinon.stub().returns(result);
      var mockData = [mockModel];
      var charmstoreSearch = sinon.stub().callsArgWith(1, mockData);
      var output = jsTestUtils.shallowRender(
          <juju.components.SearchResults
            changeState={changeState}
            query={query}
            charmstoreSearch={charmstoreSearch} />);

      output.props.onClick({
        preventDefault: sinon.stub(),
        target: {
          className: 'list-block__entity-link',
          getAttribute: sinon.stub().returns('wily/spinach')
        }
      });
      assert.equal(changeState.callCount, 1);
      assert.deepEqual(changeState.args[0][0], {
        sectionC: {
          component: 'charmbrowser',
          metadata: {
            activeComponent: 'entity-details',
            id: 'wily/spinach'
          }
        }
      });
    });
  });

  describe('unit tests', function() {
    var searchResults;

    beforeEach(function() {
      searchResults = new juju.components.SearchResults();
    });

    afterEach(function() {
      searchResults = null;
    });

    it('collapses identical charms with different series', function() {
      var entities = [
        {name: 'foo', owner: 'bar', type: 'charm', series: 'trusty'},
        {name: 'foo', owner: 'bar', type: 'charm', series: 'precise'},
        {name: 'foo', owner: 'baz', type: 'charm', series: 'vivid'}
      ];
      var actual = searchResults.collapseSeries(entities),
          first = entities[0],
          last = entities[2];
      var expected = [
        {
          id: 'trusty/' + first.name,
          name: first.name,
          owner: first.owner,
          type: first.type,
          downloads: 0,
          url: '',
          series: [{name: 'trusty', url: ''}, {name: 'precise', url: ''}]
        },
        {
          id: 'vivid/' + last.name,
          name: last.name,
          owner: last.owner,
          type: last.type,
          downloads: 0,
          url: '',
          series: [{name: 'vivid', url: ''}]
        }
      ];
      assert.deepEqual(actual, expected);
    });

    it('aggregates downloads when collapsing charms', function() {
      var entities = [
        {name: 'c1', owner: 'o1', type: 'c', series: 's1', downloads: 1},
        {name: 'c1', owner: 'o1', type: 'c', series: 's2', downloads: 5},
        {name: 'c1', owner: 'o2', type: 'c', series: 's3', downloads: 3}
      ];
      var actual = searchResults.collapseSeries(entities);
      assert.equal(actual[0].downloads, 6, 'downloads not aggregated');
      assert.equal(actual[1].downloads, 3, 'downloads improperly aggregated');
    });

    it('maintains sort order when collapsing charms', function() {
      var entities = [
        {name: 'foo1', owner: 'bar', type: 'c', series: 's1', downloads: 6},
        {name: 'foo2', owner: 'bar', type: 'c', series: 's1', downloads: 5},
        {name: 'foo1', owner: 'bar', type: 'c', series: 's2', downloads: 4},
        {name: 'foo3', owner: 'bar', type: 'c', series: 's1', downloads: 4},
        {name: 'foo2', owner: 'bar', type: 'c', series: 's1', downloads: 3},
        {name: 'foo3', owner: 'bar', type: 'c', series: 's3', downloads: 3},
        {name: 'foo3', owner: 'bar', type: 'c', series: 's4', downloads: 3},
        {name: 'foo3', owner: 'bar', type: 'c', series: 's5', downloads: 3}
      ];
      var actual = searchResults.collapseSeries(entities);
      assert.equal(actual[0].name, 'foo1',
                   'foo1 did not maintain sort position');
      assert.equal(actual[0].downloads, 10,
                   'foo1 downloads not aggregated');
      assert.equal(actual[1].name, 'foo2',
                   'foo2 did not maintain sort position');
      assert.equal(actual[1].downloads, 8,
                   'foo2 downloads not aggregated');
      assert.equal(actual[2].name, 'foo3',
                   'foo3 did not maintain sort position');
      assert.equal(actual[2].downloads, 13,
                   'foo3 downloads not aggregated');
    });

    it('sorts the series within collapsed results', function() {
      var entities = [
        {name: 'c1', owner: 'o1', type: 'c', series: 'trusty'},
        {name: 'c1', owner: 'o1', type: 'c', series: 'precise'},
        {name: 'c1', owner: 'o1', type: 'c', series: 'vivid'}
      ];
      var actual = searchResults.collapseSeries(entities),
          actualSeries = actual[0].series,
          seriesNames = [];
      for (var i = 0, l = actualSeries.length; i < l; i++) {
        seriesNames.push(actualSeries[i].name);
      }
      assert.deepEqual(seriesNames, ['vivid', 'trusty', 'precise']);
    });

    it('de-dupes the series within collapsed results', function() {
      var entities = [
        {name: 'c1', owner: 'o1', type: 'c', series: 'trusty'},
        {name: 'c1', owner: 'o1', type: 'c', series: 'precise'},
        {name: 'c1', owner: 'o1', type: 'c', series: 'trusty'}
      ];
      var actual = searchResults.collapseSeries(entities),
          actualSeries = actual[0].series,
          seriesNames = [];
      for (var i = 0, l = actualSeries.length; i < l; i++) {
        seriesNames.push(actualSeries[i].name);
      }
      assert.deepEqual(seriesNames, ['trusty', 'precise']);
    });

    it('properly handles a successful search', function() {
      var query = 'spinach';
      searchResults.props = {query: query};
      var results = [
        {
          name: 'spinach',
          displayName: 'spinach',
          url: 'http://example.com/spinach',
          downloads: 1000,
          owner: 'test-owner',
          promulgated: true,
          id: 'spinach',
          type: 'charm'
        },
        {
          name: 'red spinach',
          displayName: 'red spinach',
          url: 'http://example.com/red-spinach',
          downloads: 1000,
          owner: 'test-owner',
          promulgated: false,
          id: 'red-spinach',
          type: 'charm'
        }
      ];
      var rawResults = results.map(function(obj) {
        var m = {};
        m.toEntity = sinon.stub().returns(obj);
        return m;
      });
      var expected = {
        standalone: false,
        initialized: true,
        text: 'spinach',
        hasResults: true,
        solutionsCount: 2,
        normalResultsCount: 1,
        normalResults: [results[1]],
        promulgatedResultsCount: 1,
        promulgatedResults: [results[0]]
      };
      searchResults.collapseSeries = sinon.stub().returns(results);
      searchResults.setState = sinon.spy();
      searchResults.searchSuccess(rawResults);
      var spy = searchResults.setState;
      assert.deepEqual(spy.getCall(0).args[0], {waitingForSearch: false},
                       'waitingForSearch flag still set');
      assert.deepEqual(spy.getCall(1).args[0], {data: expected},
                       'search data returned is incorrect');
    });

    it('passes the right data to the search', function() {
      var query = 'spinach';
      searchResults.setState = sinon.spy();
      var stateSpy = searchResults.setState;
      var searchSpy = sinon.spy();
      searchResults.props = {charmstoreSearch: searchSpy};
      searchResults.searchRequest(query);
      assert.deepEqual(stateSpy.getCall(0).args[0], {waitingForSearch: true},
                       'waitingForSearch flag is not set');
      assert.deepEqual(searchSpy.getCall(0).args[0],
                       {text: query, tags: undefined},
                       'query not passed in correctly');
    });

    it('decides to search when the query changes', function() {
      var query = 'spinach';
      searchResults.state = {data: {text: query}};
      assert.isFalse(searchResults.shouldSearch({query: query}),
                     'Unchanged query should not trigger search');
      assert.isTrue(searchResults.shouldSearch({query: 'foo'}),
                    'Changed query should trigger search');
    });

    it('initializes the state properly', function() {
      var actual = searchResults.getInitialState();
      assert.isFalse(actual.data.initialized,
                     'data init flag should not be set');
      assert.isFalse(actual.waitingForSearch,
                     'waitingForSearch flag should not be set');
    });

    it('triggers a search request upon component mount', function() {
      searchResults.props = {query: 'foobar'};
      searchResults.searchRequest = sinon.spy();
      searchResults.componentDidMount();
      assert.isTrue(searchResults.searchRequest.calledOnce);
    });

    it('triggers a search request when the query changes', function() {
      var nextProps = {query: 'spinach'};
      searchResults.props = {query: 'broccoli'};
      searchResults.searchRequest = sinon.spy();
      var spy = searchResults.searchRequest;
      searchResults.componentWillReceiveProps(nextProps);
      assert.equal(spy.getCall(0).args[0], nextProps.query);
    });

    it('re-renders only after a new search has finished', function() {
      searchResults.shouldSearch = sinon.stub().returns(true);
      searchResults.state = {waitingForSearch: false};
      assert.isTrue(searchResults.shouldComponentUpdate(),
                    'Should re-render after new search finished');
      searchResults.shouldSearch = sinon.stub().returns(false);
      searchResults.state = {waitingForSearch: false};
      assert.isFalse(searchResults.shouldComponentUpdate(),
                     'Should not re-render without a new search');
      searchResults.shouldSearch = sinon.stub().returns(true);
      searchResults.state = {waitingForSearch: true};
      assert.isFalse(searchResults.shouldComponentUpdate(),
                     'Should not re-render when waiting for a search');
    });

    it('will abort the request when unmounting', function() {
      var abort = sinon.stub();
      var changeState = sinon.stub();
      var query = 'spinach';
      var result = {
        name: 'spinach',
        displayName: 'spinach',
        url: 'http://example.com/spinach',
        downloads: 1000,
        owner: 'test-owner',
        promulgated: true,
        series: 'wily',
        type: 'charm'
      };
      var mockModel = {};
      mockModel.toEntity = sinon.stub().returns(result);
      var charmstoreSearch = sinon.stub().returns({abort: abort});
      var shallowRenderer = jsTestUtils.shallowRender(
          <juju.components.SearchResults
            changeState={changeState}
            query={query}
            charmstoreSearch={charmstoreSearch} />, true);
      shallowRenderer.getMountedInstance().componentDidMount();
      shallowRenderer.unmount();
      assert.equal(abort.callCount, 1);
    });

    it('sets the correct ids for entities', function() {
      var query = 'spinach';
      searchResults.props = {query: query};
      var results = [
        {
          name: 'mysql',
          displayName: 'mysql',
          url: 'http://example.com/mysql',
          downloads: 1000,
          owner: 'charmers',
          promulgated: true,
          id: 'mysql',
          type: 'charm'
        }
      ];
      var rawResults = results.map(function(obj) {
        var m = {};
        m.toEntity = sinon.stub().returns(obj);
        return m;
      });
      searchResults.collapseSeries = sinon.stub().returns(results);
      var setState = sinon.spy();
      searchResults.setState = setState;
      searchResults.searchSuccess(rawResults);
      var result = setState.getCall(1).args[0].data.promulgatedResults[0];
      assert.deepEqual(result.storeId, '~charmers/mysql');
    });
  });
});