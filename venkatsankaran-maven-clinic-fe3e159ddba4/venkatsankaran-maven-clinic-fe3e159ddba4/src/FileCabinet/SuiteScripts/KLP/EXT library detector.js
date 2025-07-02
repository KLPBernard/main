/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */

define(['N/record', 'N/runtime', 'N/search', 'N/error', 'N/file'],
    /**
     * @param {record} record
     * @param {search} search
     * @param {runtime} runtime
     */
    function (record, runtime, search, error, file) {



        /**
         * Marks the beginning of the Map/Reduce process and generates input data.
         *
         * @typedef {Object} ObjectRef
         * @property {number} id - Internal ID of the record instance
         * @property {string} type - Record type id
         *
         * @return {Array|Object|Search|RecordRef} inputSummary
         * @since 2015.1
         */
        function getInputData() {

            try {
                var stLogTitle = ' << getInputData >>';
                log.debug(stLogTitle);
                var notInvestigatedFiles = ['name', 'isnot'].concat([
                    'ns_mr_extjslib_detector.js'
                ]);

                var fileSearchObj = search.create({
                    type: 'file',
                    filters:
                        [
                            ['folder', 'anyof', '-15', '-16'],
                            'AND',
                            ['name', 'contains', '.js'],
                            'AND',
                            notInvestigatedFiles
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: 'name',
                                sort: search.Sort.ASC
                            }),
                            'folder',
                            'documentsize',
                            'url',
                            'created',
                            'modified',
                            'filetype',
                            'internalid'
                        ]
                });
                var searchResultCount = fileSearchObj.runPaged().count;
                log.debug('fileSearchObj result count', searchResultCount);
                return fileSearchObj;
            } catch (objError) {
                log.error('ERROR', objError);
            }
        }

        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        function map(context) {
            var stLogTitle = ' << map >> ';
            //log.debug(stLogTitle);
            var objSearchResult = JSON.parse(context.value);
            //log.debug('map', 'objSearchResult : ' + JSON.stringify(objSearchResult));

            var intFileId = objSearchResult.id;
            var strFileName = objSearchResult.values.name;
            var objFile = file.load({ id: intFileId });
            var srtFileContent = objFile.getContents();
            //log.debug('map', 'srtFileContent : ' + JSON.stringify(srtFileContent));
            //log.debug('map', 'srtFileContent.indexOf(Ext.) : ' + srtFileContent.indexOf('Ext.'));
            var contextKey = 'BUNDLED_';
            if (objFile.path.indexOf('SuiteBundles') === -1) {
                contextKey = 'NOT_BUNDLED_';
            } else {
                strFileName += getBundle(objFile);
            }

            if (srtFileContent.indexOf('Ext.') >= 0) {
                context.write({
                    key: contextKey,
                    value: {
                        fileName: strFileName
                    }
                });
            }
        }
        function getBundle(objFile) {
            var strPath = objFile.path;
            var test = strPath.match(/\/Bundle \d+\//);
            if (test !== undefined) {
                return '_$Ep_' + test[0].slice(1, -1)
            }
            return '';
        }

        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        function reduce(context) {

            var stLogTitle = ' << reduce >> ';
            log.debug(stLogTitle + 'START');
            log.debug(stLogTitle, 'context.values: ' + JSON.stringify(context.values));
            var arrFilesName;
            if (context.key === 'BUNDLED_') {
                arrFilesName = {};
                for (var i = 0; i < context.values.length; i++) {
                    var objResultValues = JSON.parse(context.values[i]);
                    var arrFileOpt = objResultValues.fileName.split('_$Ep_');
                    var fileName = arrFileOpt[0];
                    var bundle = arrFileOpt[1];
                    if (arrFilesName[bundle] === undefined) {
                        arrFilesName[bundle] = [];
                    }
                    if (arrFilesName[bundle].indexOf(fileName) == -1) {
                        arrFilesName[bundle].push(fileName);
                    }
                }
            } else {
                arrFilesName = [];
                for (var i = 0; i < context.values.length; i++) {
                    var objResultValues = JSON.parse(context.values[i]);
                    var fileName = objResultValues.fileName;
                    if (arrFilesName.indexOf(fileName) == -1) {
                        arrFilesName.push(fileName);
                    }
                }
            }

            log.debug(stLogTitle + 'arrFilesName', arrFilesName);


            var fileObj = file.create({
                name: context.key + 'extJS_usage_results.json',
                fileType: file.Type.PLAINTEXT,
                contents: JSON.stringify(arrFilesName),
                folder: -15
            });
            var savedFile = fileObj.save();
            log.debug(stLogTitle + 'objResultValues', 'savedFile: ' + savedFile);

            log.debug(stLogTitle + 'END');
        }
        function getFolder() {
            var intFolderId;
            var folderSearchObj = search.create({
                type: 'folder',
                filters:
                    [
                        ['name', 'is', 'ExtJsLibraryDetector']
                    ],
                columns:
                    [
                        search.createColumn({
                            name: 'name',
                            sort: search.Sort.ASC,
                            label: 'Name'
                        }),
                    ]
            });
            folderSearchObj.run().each(function (result) {
                intFolderId = result.id;
            });
            return intFolderId
        }


        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        function summarize(summary) {

            var stLogTitle = ' << summary >> ';
            log.debug(stLogTitle + 'START');

            summary.reduceSummary.errors.iterator().each(function (key, objError) {
                var errorObject = JSON.parse(objError);
                log.error({
                    title: 'Reduce error for key: ' + key,
                    details: errorObject.name + ': ' + errorObject.message
                });
                return true;
            });

            log.debug(stLogTitle + 'END');
        }

        function isEmpty(stValue) {
            return ((stValue === '' || stValue == null || stValue == undefined) ||
                (stValue.constructor === Array && stValue.length == 0) || (stValue.constructor === Object && (function (
                    v) {
                    for (var k in v)
                        return false;
                    return true;
                })(stValue)));
        }


        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

    });