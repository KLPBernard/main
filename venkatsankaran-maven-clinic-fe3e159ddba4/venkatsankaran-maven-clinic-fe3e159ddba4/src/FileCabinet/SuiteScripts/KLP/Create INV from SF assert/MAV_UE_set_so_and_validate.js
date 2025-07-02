/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @deployedTo - Invoice with SF Asset ID details
 * ---------------------------------------------------------------------------------------
 *  Author   | Version |   Date         |       Description
 * ---------------------------------------------------------------------------------------
 *  MMarce  | V1.0     | March-15-2023  | Case 1551: Set the related SO and throw error if multiple assert available.
 */
define(['N/runtime', 'N/search', 'N/record'],
    /**
   * @param{record} record
   * @param{search} search
   */
    (runtime, search, record) => {

        function getPostingPeriod(period) {
            var period = period.split('-');
            const startDate = period[1] + '/01/' + period[0]
            var periodSearch = search.create({
                type: "accountingperiod",
                filters:
                    [
                        ["startdate", "on", startDate],
                        "AND",
                        ["isquarter", "is", "F"],
                        "AND",
                        ["isyear", "is", "F"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "periodname",
                            sort: search.Sort.ASC,
                            label: "Name"
                        }),
                        search.createColumn({ name: "internalid", label: "Internal ID" })
                    ]
            });
            var count = periodSearch.runPaged().count;
            if (count > 0) {
                var result = periodSearch.run().getRange({ start: 0, end: 1 })[0];
                return result.id;
            }
            return null;
        }
        function getLastDateOfMonth(year, month) {
            var nextMonth = new Date(year, month + 1, 1);
            var lastDateOfMonth = new Date(nextMonth.getTime() - 1);
            return lastDateOfMonth.getDate();
        }

        function getSOid(sfAssert, quantity, newRecord, perDate) {
            quantity = quantity ? parseFloat(quantity) : 0;
            // log.debug('QU!', quantity)
            var soObj = {};
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["custcol_sf_asset_id", "is", sfAssert],
                        "AND",
                        ["mainline", "is", "F"],
                        "AND",
                        ["taxline", "is", "F"],
                        "AND",
                        ["cogs", "is", "F"],
                        "AND",
                        ["shipping", "is", "F"],
                        "AND",
                        ["taxline", "is", "F"],
                        "AND",
                        // ["formulanumeric: CASE WHEN (({custcol_asset_id_billing_start_date} IS NOT NULL) AND ({custcol_asset_id_billing_end_date} IS NOT NULL)) THEN CASE WHEN TO_DATE('" + perDate + "','mm/dd/yyyy') BETWEEN TO_DATE({custcol_asset_id_billing_start_date},'mm/dd/yyyy') AND TO_DATE({custcol_asset_id_billing_end_date},'mm/dd/yyyy') THEN 1 ELSE 0 END ELSE CASE WHEN TO_DATE('" + perDate + "','mm/dd/yyyy') BETWEEN TO_DATE({custcol_atlas_contract_start_date},'mm/dd/yyyy') AND TO_DATE({custcol_atlas_contract_end_date},'mm/dd/yyyy') THEN 1 ELSE 0 END END", "equalto", "1"]
                        ["formulanumeric: CASE WHEN (({custcol_asset_id_billing_start_date} IS NOT NULL) AND ({custcol_asset_id_billing_end_date} IS NOT NULL)) THEN CASE WHEN TO_DATE('" + perDate + "','mm/dd/yyyy') BETWEEN {custcol_asset_id_billing_start_date} AND {custcol_asset_id_billing_end_date} THEN 1 ELSE 0 END ELSE CASE WHEN TO_DATE('" + perDate + "','mm/dd/yyyy') BETWEEN {custcol_atlas_contract_start_date} AND {custcol_atlas_contract_end_date} THEN 1 ELSE 0 END END", "equalto", "1"]
                    ],
                columns:
                    [
                        search.createColumn({ name: "tranid", label: "Document Number" }),
                        search.createColumn({ name: "quantitybilled", label: "Quantity Billed" }),
                        search.createColumn({ name: "quantity", label: "Quantity" }),
                        search.createColumn({ name: "line", label: "Line ID" })
                    ]
            });

            salesorderSearchObj.run().each(function (result) {
                if (!soObj.hasOwnProperty(result.id)) {
                    const totalQuantity = parseFloat(result.getValue({ name: "quantity" }));
                    const totalBilled = parseFloat(result.getValue({ name: "quantitybilled" }));
                    var availableToBill = totalQuantity - totalBilled;
                    availableToBill = availableToBill < 0 ? 0 : availableToBill;
                    // log.debug('availableToBill', availableToBill)
                    if (availableToBill == 0 || quantity > availableToBill) {
                        newRecord.setValue({
                            fieldId: 'custrecord_klp_sales_order',
                            value: result.id
                        });
                        soObj = 'Invoice quantity should be less than or equal to ' + availableToBill
                        return false;
                    }
                    soObj[result.id] = { soText: result.getValue({ name: "tranid" }), line: result.getValue({ name: "line" }) };
                    return true;
                } else {
                    soObj = 'Sales Order ' + result.getValue({ name: "tranid" }) + ' has the asset ID ' + sfAssert + ' in more than 1 line.'
                    return false;
                }
            });
            return soObj;
        }

        function validateAnualMin(soId, startDate) {
            const scriptObj = runtime.getCurrentScript();
            const itemVal = scriptObj.getParameter({
                name: 'custscript_ue_val_annual_min_item'
            });
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["internalidnumber", "equalto", soId],
                        "AND",
                        ["custbody_has_minimum_annual_commitment", "noneof", "@NONE@"],
                        "AND",
                        ["item", "anyof", itemVal],
                        "AND",
                        ["custcol_atlas_contract_start_date", "onorbefore", startDate],
                        "AND",
                        ["custcol_atlas_contract_end_date", "onorafter", startDate]
                    ],
                columns:
                    [
                        search.createColumn({ name: "internalid", label: "Internal ID" }),
                        search.createColumn({ name: "item", label: "Item" }),
                        search.createColumn({ name: "tranid", label: "Document Number" }),
                        search.createColumn({
                            name: "formulanumeric",
                            formula: "{quantity} - {quantitybilled} ",
                            label: "Formula (Numeric)"
                        })
                    ]
            });
            var resultCount = salesorderSearchObj.runPaged().count;
            if (resultCount > 0) {
                var result = salesorderSearchObj.run().getRange({ start: 0, end: 1 })[0];
                const soDocNum = result.getValue({ name: "tranid" });
                if (resultCount > 1) {
                    const itemName = result.getText({ name: "item" });
                    return soDocNum + ' has multiple ' + itemName + ' Item.'
                }
                const calcVal = result.getValue({
                    name: "formulanumeric"
                });
                if (calcVal > 0) {
                    return soDocNum + ' has not used all its minimum item.'
                }
                return true;
            } else {
                const soObj = search.lookupFields({
                    type: search.Type.SALES_ORDER,
                    id: soId,
                    columns: ['custbody_has_minimum_annual_commitment', 'tranid']
                })
                if (soObj.custbody_has_minimum_annual_commitment.length == 0) {
                    return true;
                } else {
                    const itemName = search.lookupFields({
                        type: search.Type.ITEM,
                        id: itemVal,
                        columns: 'itemid'
                    }).itemid
                    return soObj.tranid + ' has no ' + itemName + ' Item.'
                }
            }
            return true;
        }
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the scriptContext.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            log.debug('Remaining Usage', runtime.getCurrentScript().getRemainingUsage())
        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the scriptContext.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            if ([scriptContext.UserEventType.CREATE, scriptContext.UserEventType.EDIT].includes(scriptContext.type)) {
                const newRecord = scriptContext.newRecord;
                const errorArray = [];
                let period = newRecord.getValue({ fieldId: 'custrecord_klp_inv_posting_period' });
                if (!period) {
                    errorArray.push('Please enter INVOICE POSTING PERIOD (YYYY-MM)')
                    // newRecord.setValue({
                    //     fieldId: 'custrecord_klp_error_on_processing',
                    //     value: 'Please enter INVOICE POSTING PERIOD (YYYY-MM)'
                    // })
                    // return;
                }

                const sfAssert = newRecord.getValue({ fieldId: 'custrecord_klp_sfassetid' });
                if (!sfAssert) {
                    errorArray.push('Please enter SF ASSET ID.');
                    // newRecord.setValue({
                    //     fieldId: 'custrecord_klp_error_on_processing',
                    //     value: 'Please enter SF ASSET ID.'
                    // })
                    // return;
                }

                if (errorArray.length > 0) {
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_error_on_processing',
                        value: errorArray.join('\n')
                    });
                    return;
                }
                const postingPeriod = getPostingPeriod(period);
                if (!postingPeriod) {
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_error_on_processing',
                        value: 'INVOICE POSTING PERIOD Not available in NetSuite.'
                    })
                    return;
                }
                newRecord.setValue({
                    fieldId: 'custrecord_klp_posting_period',
                    value: postingPeriod
                });
                const quantity = newRecord.getValue({ fieldId: 'custrecord_klp_inv_qty' });
                period = period.split('-');
                // const startDate = period[1] + '/01/' + period[0];
                const lastDate = getLastDateOfMonth(period[0], parseInt(period[1]) - 1)
                const endDate = period[1] + '/' + lastDate + '/' + period[0];
                // const startDate =  period[1] + '/1/' + period[0];
                // const startDate = '01/01/' + period[0];
                // const endDate = '12/31/' + period[0];
                const soObj = getSOid(sfAssert, quantity, newRecord, endDate);
                if (typeof (soObj) == 'string') {
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_error_on_processing',
                        value: soObj
                    })
                    return;
                }
                const soObjKeys = Object.keys(soObj)
                if (soObjKeys.length < 1) {
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_error_on_processing',
                        value: 'Cannot find NS SO line with the csv SF asset id.'
                    })
                    return;
                }
                if (soObjKeys.length > 1) {
                    var assIdArr = [];
                    for (key in soObj) {
                        assIdArr.push(soObj[key].soText)
                    }
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_error_on_processing',
                        value: 'ASSET ID ' + sfAssert + ' is available in ' + assIdArr.join(', ')
                    })
                    return;
                }
                const soId = soObjKeys[0];
                if (runtime.executionContext == runtime.ContextType.MAP_REDUCE) {
                    var anualMinValid = validateAnualMin(soId, endDate)
                    if (anualMinValid != true) {
                        newRecord.setValue({
                            fieldId: 'custrecord_klp_error_on_processing',
                            value: anualMinValid
                        })
                        return;
                    }
                }
                newRecord.setValue({
                    fieldId: 'custrecord_klp_sales_order',
                    value: soId
                });
                newRecord.setValue({
                    fieldId: 'custrecord_klp_so_line_no',
                    value: soObj[soId].line
                });
                newRecord.setValue({
                    fieldId: 'custrecord_klp_error_on_processing',
                    value: ''
                })
            }
            log.debug('Remaining Usage', runtime.getCurrentScript().getRemainingUsage())
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the scriptContext.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            log.debug('Remaining Usage', runtime.getCurrentScript().getRemainingUsage())
        }

        return {
            //  beforeLoad,
            beforeSubmit,
            //  afterSubmit
        }

    });
