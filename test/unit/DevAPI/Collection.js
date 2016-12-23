'use strict';

/* eslint-env node, mocha */
/* global chai, Encoding, mysqlxtest, Messages */

// npm `test` script was updated to use NODE_PATH=.
const Client = require('lib/Protocol/Client');
const Collection = require('lib/DevAPI/Collection');
const CollectionAdd = require('lib/DevAPI/CollectionAdd');
const expect = require('chai').expect;
const td = require('testdouble');

chai.should();

describe('Collection', function () {
    let session, collection;

    beforeEach('get Session', function () {
        return mysqlxtest.getNullSession().then(function (s) {
            session = s;
            collection = session.getSchema('schema').getCollection('collection');
        });
    });

    it('Should know its name', function () {
        collection.getName().should.equal('collection');
    });

    it('Should provide access to the schema', function () {
        collection.getSchema().getName().should.equal('schema');
    });
    it('Should provide access to the session', function () {
        collection.getSession().should.deep.equal(session);
    });

    function createResponse (protocol, row) {
        protocol.handleNetworkFragment(Encoding.encodeMessage(Messages.ServerMessages.RESULTSET_COLUMN_META_DATA, {
            type: Messages.messages['Mysqlx.Resultset.ColumnMetaData'].enums.FieldType.SINT,
            name: '_doc',
            table: 'table',
            schema: 'schema'
        }, Encoding.serverMessages));

        if (row) {
            protocol.handleNetworkFragment(Encoding.encodeMessage(Messages.ServerMessages.RESULTSET_ROW, { field: ['\x01'] }, Encoding.serverMessages));
        }

        protocol.handleNetworkFragment(Encoding.encodeMessage(Messages.ServerMessages.RESULTSET_FETCH_DONE, {}, Encoding.serverMessages));
        protocol.handleNetworkFragment(Encoding.encodeMessage(Messages.ServerMessages.SQL_STMT_EXECUTE_OK, {}, Encoding.serverMessages));
    }

    context('existsInDatabase()', () => {
        let sqlStmtExecute, getName;

        beforeEach('create fakes', () => {
            sqlStmtExecute = td.function();
            getName = td.function();
        });

        afterEach('reset fakes', () => {
            td.reset();
        });

        it('should return true if exists in database', () => {
            const collection = new Collection({ _client: { sqlStmtExecute } }, { getName }, 'foo');

            td.when(getName()).thenReturn('bar');
            td.when(sqlStmtExecute('list_objects', ['bar', 'foo'], td.callback(['foo']), null, 'xplugin')).thenResolve();

            return expect(collection.existsInDatabase()).to.eventually.be.true;
        });

        it('should return false if it does not exist in database', () => {
            const collection = new Collection({ _client: { sqlStmtExecute } }, { getName }, 'foo');

            td.when(getName()).thenReturn('bar');
            td.when(sqlStmtExecute('list_objects', ['bar', 'foo'], td.callback([]), null, 'xplugin')).thenResolve();

            return expect(collection.existsInDatabase()).to.eventually.be.false;
        });
    });

    it('should return true for good drop', function () {
        const promise = collection.drop();

        session._client.handleNetworkFragment(Encoding.encodeMessage(Messages.ServerMessages.SQL_STMT_EXECUTE_OK, {}, Encoding.serverMessages));

        return promise.should.eventually.equal(true);
    });

    it('should fail for bad drop', function () {
        const promise = collection.drop();

        session._client.handleNetworkFragment(Encoding.encodeMessage(Messages.ServerMessages.ERROR, { code: 1, sql_state: 'HY000', msg: 'Invalid' }, Encoding.serverMessages));

        return promise.should.be.rejected;
    });

    it('should hide internals from inspect output', function () {
        collection.inspect().should.deep.equal({ schema: 'schema', collection: 'collection' });
    });

    context('add()', () => {
        it('should return an instance of the proper class', () => {
            const instance = (new Collection()).add({});

            expect(instance).to.be.an.instanceof(CollectionAdd);
        });

        it('should acknowledge documents provided as an array', () => {
            const documents = [{ foo: 'bar' }, { foo: 'baz' }];
            const instance = (new Collection()).add(documents);

            expect(instance._document).to.deep.equal(documents);
        });

        it('should acknowledge documents provided as multiple arguments', () => {
            const documents = [{ foo: 'bar' }, { foo: 'baz' }];
            const instance = (new Collection()).add(documents[0], documents[1]);

            expect(instance._document).to.deep.equal(documents);
        });
    });
});
