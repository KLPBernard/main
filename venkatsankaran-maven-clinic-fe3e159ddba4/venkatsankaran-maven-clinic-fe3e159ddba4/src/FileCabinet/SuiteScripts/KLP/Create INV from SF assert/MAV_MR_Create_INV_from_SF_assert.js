/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * ---------------------------------------------------------------------------------------
 *  Author     | Version |   Date    |       Description
 * ---------------------------------------------------------------------------------------
 * MMarce     | V 0.1   | MAR-15-2023 | Case 1551:  create Invoices from "Invoice with SF Asset ID details"
 */
define(['N/record', 'N/search', 'N/runtime', 'N/email', 'N/error'],
    /**
   * @param{record} record
   * @param{search} search
   */
    (record, search, runtime, email, error) => {

        function getContactEmail(company) {
            var resObj = [];
            var contactSearchObj = search.create({
                type: "contact",
                filters:
                    [
                        ["company", "anyof", company],
                        "AND",
                        ["isinactive", "is", "F"],
                        "AND",
                        ["email", "isnotempty", ""],
                        "AND",
                        ["custentity_ns_invoice_email_recipient", "is", "T"]
                    ],
                columns:
                    [
                        search.createColumn({ name: "email", label: "Email" })
                    ]
            });
            contactSearchObj.run().each(function (result) {
                resObj.push(result.getValue({ name: "email" }));
                return true;
            });
            return resObj;
        }
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
            try {
                const postingPeriod = scriptObj.getParameter({
                    name: 'custscript_mr_inc_creat_posting_period'
                });
                // log.debug('postingPeriod', postingPeriod)
                if (!postingPeriod) {
                    var erObj = error.create({
                        message: 'Posting Period is not available',
                        name: 'Validation Error'
                    });
                    throw erObj;

                }
                const sfAssetSearch = search.create({
                    type: "customrecordklp_invoice_sfassetid",
                    filters:
                        [
                            ["custrecord_klp_created_inv_no", "anyof", "@NONE@"],
                            "AND",
                            ["isinactive", "is", "F"],
                            "AND",
                            ["custrecord_klp_posting_period", "is", postingPeriod],
                            "AND",
                            ["owner.internalid", "anyof", runtime.getCurrentUser().id],

                            // ["internalid", "anyof", 8425] //Use for testing
                        ],
                    columns:
                        [
                            search.createColumn({ name: "custrecord_klp_inv_qty", label: "Invoice Quantity" }),
                            search.createColumn({ name: "custrecord_klp_sfassetid", label: "SF Asset ID" }),
                            search.createColumn({ name: "custrecord_klp_inv_posting_period", label: "Invoice Posting Period (YYYY-MM)" }),
                            search.createColumn({ name: "custrecord_klp_sales_order", label: "Sales Order" }),
                            search.createColumn({ name: "internalid", label: "Internal ID" }),
                            search.createColumn({ name: "custrecord_klp_posting_period", label: "Posting Period" }),
                            search.createColumn({ name: "custrecord_klp_svc_end_date", label: "Service End Date" }),
                            search.createColumn({ name: "custrecord_klp_svc_start_date", label: "Service Start Date" }),
                            search.createColumn({ name: "custrecord_klp_so_line_no", label: "NETSUITE SO LINE NUMBER" })
                        ]
                });
                return sfAssetSearch;
            } catch (e) {
                var author = scriptObj.getParameter({
                    name: 'custscript_mr_inc_crt_email_author'
                });
                var recepient = scriptObj.getParameter({
                    name: 'custscript_mr_inc_crt_email_reciver'
                });
                log.error({
                    title: 'ERROR',
                    details: JSON.stringify(e)
                });
                if (author && recepient) {
                    email.send({
                        author: author,
                        body: e.message,
                        recipients: recepient,
                        subject: 'Error on creating Invoice'
                    })
                }
            }
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
            var mapVal = JSON.parse(mapContext.value);
            mapVal['Error Occured'] = false;

            // log.debug('mapVal', mapVal)
            //const soID = mapVal.values.custrecord_klp_sales_order.value;
            const invSfId = mapVal.id;
            // log.debug('invSfId', invSfId);
            const assertVal = mapVal.values.custrecord_klp_sfassetid
            var invSfRec = record.load({
                type: 'customrecordklp_invoice_sfassetid',
                id: invSfId
            });
            invSfRec.save();
            const invSearchRes = search.lookupFields({
                type: 'customrecordklp_invoice_sfassetid',
                id: invSfId,
                columns: ['custrecord_klp_error_on_processing', 'custrecord_klp_sales_order']
            });
            if (invSearchRes.custrecord_klp_error_on_processing) {
                var err = error.create({
                    message: assertVal + '~' + invSearchRes.custrecord_klp_error_on_processing,
                    name: 'Validation Error'
                });
                record.submitFields({
                    type: 'customrecordklp_invoice_sfassetid',
                    id: invSfId,
                    values: {
                        isinactive: true
                    },
                    options: {
                        enablesourcing: true,
                        ignoreMandatoryFields: true
                    }
                });
                mapVal['Error Occured'] = true;
                if (invSearchRes.hasOwnProperty('custrecord_klp_sales_order') && invSearchRes.custrecord_klp_sales_order.length > 0) {
                    mapContext.write({
                        key: invSearchRes.custrecord_klp_sales_order[0].value,
                        value: mapVal
                    });
                }
                throw err;
            }
            if (invSearchRes.hasOwnProperty('custrecord_klp_sales_order') && invSearchRes.custrecord_klp_sales_order.length > 0) {
                var soID = invSearchRes.custrecord_klp_sales_order[0].value;
            }
            if (!soID) {
                var err = error.create({
                    message: assertVal + '~' + 'Sales Order not available.',
                    name: 'Validation Error'
                });
                record.submitFields({
                    type: 'customrecordklp_invoice_sfassetid',
                    id: invSfId,
                    values: {
                        isinactive: true
                    },
                    options: {
                        enablesourcing: true,
                        ignoreMandatoryFields: true
                    }
                })
                throw err;
            }
            mapContext.write({
                key: soID,
                value: mapVal
            });

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
            const soId = reduceContext.key;
            const lineValues = reduceContext.values;
            try {
                var soRes = search.lookupFields({
                    type: search.Type.SALES_ORDER,
                    id: soId,
                    columns: ['status', 'tranid']
                });
                if (Object.keys(soRes).length <= 0) {
                    var errObj = error.create({
                        message: 'Sales Order not available.',
                        name: 'Record not approved'
                    });
                    throw errObj;
                }
                var status = soRes.status[0].value;

                if (status == 'pendingApproval') {
                    var errObj = error.create({
                        message: 'Sales Order ' + soRes.tranid + ' is not approved.',
                        name: 'Record not approved'
                    });
                    throw errObj;
                }
                if (status == 'fullyBilled') {
                    var errObj = error.create({
                        message: 'Sales Order ' + soRes.tranid + ' is fully billed',
                        name: 'Record not approved'
                    })
                    throw errObj;
                }
                const scriptObj = runtime.getCurrentScript();
                const form = scriptObj.getParameter({
                    name: 'custscript_mr_inv_crt_form'
                });
                const headerValue = JSON.parse(lineValues[0]).values;
                // const invSfId = headerValue.internalid.value;
                var invSfArray = [];
                const period = headerValue.custrecord_klp_posting_period.value;
                // const line = headerValue.custrecord_klp_so_line_no;

                var invDate = headerValue.custrecord_klp_inv_posting_period;
                if (invDate) {
                    invDate = invDate.split('-');
                    invDate = new Date(invDate[0], invDate[1], 0);
                } else {
                    invDate = ''
                }
                // log.debug(perStartDate, perStartDate);
                var invCrtDetails = {};
                var errorOccured = false;
                lineValues.forEach(element => {
                    if (!errorOccured && JSON.parse(element)['Error Occured'] == true) errorOccured = true
                    const elementVal = JSON.parse(element).values;
                    // invCrtDetails[elementVal.custrecord_klp_sfassetid + '-' + elementVal.custrecord_klp_svc_start_date + '-' + elementVal.custrecord_klp_svc_end_date]
                    invCrtDetails[elementVal.custrecord_klp_sfassetid + '-' + elementVal.custrecord_klp_so_line_no] = {
                        quantity: elementVal.custrecord_klp_inv_qty,
                        postingPeriod: elementVal.custrecord_klp_inv_posting_period,
                        startDate: elementVal.custrecord_klp_svc_start_date,
                        endDate: elementVal.custrecord_klp_svc_end_date
                    }
                    invSfArray.push(elementVal.internalid.value)
                });

                if (errorOccured) {
                    log.debug('Error Occured is true', invSfArray);
                    // log.debug('ID to Inactive', invSfArray)
                    invSfArray.forEach(element => {
                        record.submitFields({
                            type: 'customrecordklp_invoice_sfassetid',
                            id: element,
                            values: { 'isinactive': true },
                            options: {
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            }

                        });
                    });
                    return;
                }
                const assetArray = Object.keys(invCrtDetails);

                var invRecord = record.transform({
                    fromType: record.Type.SALES_ORDER,
                    fromId: soId,
                    toType: record.Type.INVOICE,
                    isDynamic: false,
                    defaultValues: {
                        customform: form
                    }
                });
                invRecord.setValue({
                    fieldId: 'postingperiod',
                    value: period,
                    ignoreFieldChange: true
                });
                if (invDate) {
                    invRecord.setValue({
                        fieldId: 'trandate',
                        value: invDate,
                        ignoreFieldChange: true
                    });
                }
                invRecord.setValue({
                    fieldId: 'custbody_invoice_source',
                    value: 'Maven Invoice by Asset ID',
                    ignoreFieldChange: true
                });

                const itemLineCount = invRecord.getLineCount({
                    sublistId: 'item'
                });
                for (var index = itemLineCount - 1; index >= 0; index--) {
                    const asset = invRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_sf_asset_id',
                        line: index
                    });
                    const lineId = invRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'orderline',
                        line: index
                    });
                    // var startDate = invRecord.getSublistText({
                    //     sublistId: 'item',
                    //     fieldId: 'custcol_asset_id_billing_start_date',
                    //     line: index
                    // });
                    // if (!startDate) {
                    //     startDate = invRecord.getSublistText({
                    //         sublistId: 'item',
                    //         fieldId: 'custcol_atlas_contract_start_date',
                    //         line: index
                    //     });
                    // }
                    // var endDate = invRecord.getSublistText({
                    //     sublistId: 'item',
                    //     fieldId: 'custcol_asset_id_billing_end_date',
                    //     line: index
                    // });
                    // if (!endDate) {
                    //     endDate = invRecord.getSublistText({
                    //         sublistId: 'item',
                    //         fieldId: 'custcol_atlas_contract_end_date',
                    //         line: index
                    //     });
                    // }
                    const keyval = asset + '-' + lineId;
                    if (assetArray.includes(keyval)) {
                        var startDate = invCrtDetails[keyval].startDate
                        var endDate = invCrtDetails[keyval].endDate
                        invRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: index,
                            value: invCrtDetails[keyval].quantity
                        })
                        if (startDate)
                            invRecord.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol1',
                                line: index,
                                value: new Date(startDate)
                            })
                        if (endDate)
                            invRecord.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol2',
                                line: index,
                                value: new Date(endDate)
                            })

                    } else {
                        invRecord.removeLine({
                            sublistId: 'item',
                            line: index,
                            ignoreRecalc: false
                        })
                    }
                }
                // const customer = invRecord.getValue({
                //     fieldId: 'entity'
                // });
                // if (customer) {
                //     var emailArr = getContactEmail(customer);
                //     if (emailArr.length > 0) {
                //         emailArr = emailArr.join(";").toString();
                //         invRecord.setValue({
                //             fieldId: 'email',
                //             value: emailArr
                //         });
                //     }
                // }
                var invId = invRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                log.debug('invId', invId)
                if (invId) {
                    invSfArray.forEach(element => {
                        record.submitFields({
                            type: 'customrecordklp_invoice_sfassetid',
                            id: element,
                            values: { 'custrecord_klp_created_inv_no': invId },
                            options: {
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            }

                        });
                    });

                }
            } catch (e) {
                var asset = [];
                const invSfId = [];
                lineValues.forEach(element => {
                    const elementVal = JSON.parse(element).values;
                    asset.push(elementVal.custrecord_klp_sfassetid)
                    invSfId.push(elementVal.internalid.value)
                });
                var errorObj = error.create({
                    message: invSfId.toString() + '~' + asset.join(', ') + '~' + e.message,
                    name: 'Error Message'
                });
                throw errorObj;
            }

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
            var sendEmail = false;
            //===================START Log Process Details==================
            // var stagedKeys = 0;
            // var totalErrors = 0;
            // var totalProcessed = 0;
            // summaryContext.mapSummary.keys.iterator().each(function (key) {
            //     stagedKeys++
            //     return true;
            // });
            // summaryContext.mapSummary.errors.iterator().each(function (key, error) {
            //     log.debug('Error in Map ' + JSON.parse(error).message, JSON.stringify(error))
            //     totalErrors++
            //     return true;
            // });
            // totalProcessed = stagedKeys - totalErrors;
            // log.audit({
            //     title: 'Total Record in map stage: ',
            //     details: stagedKeys
            // })
            // log.audit({
            //     title: 'Total PROCESSED in map stage: ',
            //     details: totalProcessed
            // })
            // log.error({
            //     title: 'Total ERROR in map stage: ',
            //     details: totalErrors
            // });
            // stagedKeys = 0;
            // totalErrors = 0;
            // summaryContext.reduceSummary.keys.iterator().each(function (key) {
            //     stagedKeys++
            //     return true;
            // });
            // summaryContext.reduceSummary.errors.iterator().each(function (key, error) {
            //     log.error({
            //         title: 'Error in Reduce ' + JSON.parse(error).message,
            //         details: JSON.parse(error)
            //     })
            //     totalErrors++
            //     return true;
            // });
            // totalProcessed = stagedKeys - totalErrors;
            // log.audit({
            //     title: 'Total Record in reduce stage: ',
            //     details: stagedKeys
            // })
            // log.audit({
            //     title: 'Total PROCESSED in reduce stage: ',
            //     details: totalProcessed
            // })
            // log.error({
            //     title: 'Total ERROR in reduce stage: ',
            //     details: totalErrors
            // })

            //===================STOP Log Process Details==================================

            //========================START EMAIL Process Details=============================
            var scriptObj = runtime.getCurrentScript();

            var author = scriptObj.getParameter({
                name: 'custscript_mr_inc_crt_email_author'
            });
            var recepient = scriptObj.getParameter({
                name: 'custscript_mr_inc_crt_email_reciver'
            });
            if (recepient) {
                recepient = recepient.split(',');
            }
            var subject = 'Error on creating Invoice';
            var body = '<html>' +
                '<style>' +
                'table, th, td {' +
                '  border:1px solid black;' +
                '}' +
                '</style>' +
                '<body>' +
                '<h2>Error on Invoice creation from SF Asset.</h2>' +
                '<table style="width:100%">  ' +
                '  <tr>' +
                '    <td><b>Error</b></td>' +
                '    <td><b>SF Asset</b></td>' +

                '  </tr>'

            summaryContext.mapSummary.errors.iterator().each(function (key, error) {
                var errormessage = JSON.parse(error).message
                log.debug('errormessage on map', errormessage)
                errormessage = errormessage.split('~')
                body += '  <tr>' +
                    '    <td>' + errormessage[1] + '</td>' +
                    '    <td>' + errormessage[0] + '</td>' +
                    '  </tr>'
                sendEmail = true;
                return true;
            });
            summaryContext.reduceSummary.errors.iterator().each(function (key, error) {
                var errormessage = JSON.parse(error).message
                log.debug('errormessage', errormessage)
                errormessage = errormessage.split('~')
                log.debug('Error', JSON.stringify(error))
                body += '  <tr>' +
                    '    <td>' + errormessage[2] + '</td>' +
                    '    <td>' + errormessage[1] + '</td>' +
                    '  </tr>'
                var recToUpdate = errormessage[0].split(",")
                recToUpdate.forEach(element => {
                    record.submitFields({
                        type: 'customrecordklp_invoice_sfassetid',
                        id: element,
                        values: {
                            custrecord_klp_error_on_processing: errormessage[2],
                            isinactive: true
                        },
                        options: {
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        }

                    })
                });
                sendEmail = true;
                return true;
            });
            body += '</table>' +
                '</body>' +
                '</html>';
            log.debug('sendEmail', sendEmail);
            if (author && recepient && sendEmail) {
                email.send({
                    author: author,
                    body: body,
                    recipients: recepient,
                    subject: subject
                })
            }
            //  //========================STOP EMAIL Process Details=============================
            log.debug({
                title: 'STATUS',
                details: '--------------------COMPLETED  Total Gov: ' + summaryContext.usage + ' Total Time: ' + summaryContext.seconds + '----------------'
            });
        }

        return {
            getInputData,
            map,
            reduce,
            summarize
        }

    });