/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * ---------------------------------------------------------------------------------------
 *  Author     | Version |   Date    |       Description
 * ---------------------------------------------------------------------------------------
 *  MMarce     | V1.0    | Dec/15/2024| CASE 5282: update revElement based on CSV file.
 */
define(['N/record', 'N/search', 'N/runtime', 'N/email', 'N/file'],
    /**
   * @param{record} record
   * @param{search} search
   */
    (record, search, runtime, email, file) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            const scriptObj = runtime.getCurrentScript();
            const folderId = scriptObj.getParameter({
                name: 'custscript_mr_update_revelem_csv_file'
            });
            var fileDetail = file.load({
                id: folderId
            });
            var isValidated = false;
            var iterator = fileDetail.lines.iterator();
            iterator.each(function (line) {
                if (
                    line.value &&
                    line.value.replaceAll(" ", "").toUpperCase() == "REVENUEARRANGEMENTID,REVENUEELEMENTID,MAVENSFASSETID,CUSTOMER"
                ) {
                    isValidated = true;
                }
                return false;
            });
            if (!isValidated) {
                log.debug("Column missmatch", "Expected Column sequence: Revenue Arrangement ID,	Revenue Element ID,	Maven SF Asset ID, Customer")
                throw "Expected Column sequence: Revenue Arrangement ID,	Revenue Element ID,	Maven SF Asset ID, Customer";
            }
            return fileDetail;
        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {
            if (mapContext.key == 0) {
                return; // return the column header.
            }
            log.debug(mapContext.key, mapContext.value);
            var values = mapContext.value;
            if (values) {
                values = values.split(",");
                log.debug("Setting Values", values);
                mapContext.write({
                    key: values[0],
                    value: mapContext.value
                });
            }

        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {
            const revArrId = reduceContext.key;
            const lineValues = reduceContext.values;
            log.debug("Reduce Values " + revArrId, lineValues);
            const revArrRec = record.load({
                type: "revenuearrangement",
                id: revArrId,
                isDynamic: true
            });
            lineValues.forEach(element => {
                var valuesArr = element.split(",")
                var lineIndex = revArrRec.findSublistLineWithValue({
                    sublistId: "revenueelement",
                    fieldId: "revenueelement",
                    value: valuesArr[1]
                });
                if (lineIndex > -1) {
                    revArrRec.selectLine({
                        sublistId: "revenueelement",
                        line: lineIndex
                    });
                    revArrRec.setCurrentSublistValue({
                        sublistId: "revenueelement",
                        fieldId: "custcol_sf_asset_id",
                        value: valuesArr[2],
                        ignoreFieldChange: false
                    })
                    revArrRec.setCurrentSublistValue({
                        sublistId: "revenueelement",
                        fieldId: "custcol_maven_end_customer",
                        value: valuesArr[3],
                        ignoreFieldChange: false
                    })
                    revArrRec.commitLine({
                        sublistId: "revenueelement",
                        ignoreRecalc: false
                    });
                }
            });

            revArrRec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            })
        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {
            //===================START Log Process Details==================
            var stagedKeys = 0;
            var totalErrors = 0;
            var totalProcessed = 0;
            summaryContext.mapSummary.keys.iterator().each(function (key) {
                stagedKeys++
                return true;
            });
            summaryContext.mapSummary.errors.iterator().each(function (key, error) {
                log.debug('Error in Map ' + JSON.parse(error).message, JSON.stringify(error))
                totalErrors++
                return true;
            });
            totalProcessed = stagedKeys - totalErrors;
            log.audit({
                title: 'Total Record in map stage: ',
                details: stagedKeys
            })
            log.audit({
                title: 'Total PROCESSED in map stage: ',
                details: totalProcessed
            })
            log.error({
                title: 'Total ERROR in map stage: ',
                details: totalErrors
            });
            stagedKeys = 0;
            totalErrors = 0;
            summaryContext.reduceSummary.keys.iterator().each(function (key) {
                stagedKeys++
                return true;
            });
            summaryContext.reduceSummary.errors.iterator().each(function (key, error) {
                log.error({
                    title: 'Error on updating Revenue element ' + key,
                    details: JSON.parse(error)
                })
                totalErrors++
                return true;
            });
            totalProcessed = stagedKeys - totalErrors;
            log.audit({
                title: 'Total Record in reduce stage: ',
                details: stagedKeys
            })
            log.audit({
                title: 'Total PROCESSED in reduce stage: ',
                details: totalProcessed
            })
            log.error({
                title: 'Total ERROR in reduce stage: ',
                details: totalErrors
            })
            log.debug({
                title: 'STATUS',
                details: '--------------------COMPLETED  Total Gov: ' + summaryContext.usage + ' Total Time: ' + summaryContext.seconds + '----------------'
            });
            //===================STOP Log Process Details==================================


        }

        return {
            getInputData,
            map,
            reduce,
            summarize
        }

    });
