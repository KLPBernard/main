
/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @deployedTo - Invoice with SF Asset ID details
 * ---------------------------------------------------------------------------------------
 *  Author   | Version |   Date         |       Description
 * ---------------------------------------------------------------------------------------
 *  MMarce  | V1.0     | March-15-2023  | Case 1814: Validate the record
 */
define(['N/runtime', 'N/search'],
    /**
   * @param{record} record
   * @param{search} search
   */
    (runtime, search) => {

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

        function validateQuantity(invQuantity, soId, line) {
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["internalid", "anyof", soId],
                        "AND",
                        ["line", "equalto", line]
                    ],
                columns:
                    [
                        search.createColumn({ name: "quantity", label: "Quantity" }),
                        search.createColumn({ name: "quantitybilled", label: "Quantity Billed" })
                    ]
            });

            var count = salesorderSearchObj.runPaged().count;

            if (count > 0) {
                var result = salesorderSearchObj.run().getRange({ start: 0, end: 1 })[0];
                const totalQuantity = parseFloat(result.getValue({ name: "quantity" }));
                const totalBilled = parseFloat(result.getValue({ name: "quantitybilled" }));
                var availableToBill = totalQuantity - totalBilled;
                availableToBill = availableToBill < 0 ? 0 : availableToBill;
                if (availableToBill == 0 || invQuantity > availableToBill) {
                    return 'Invoice quantity should be less than or equal to ' + availableToBill
                }
            }
            return null;
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
                const soId = newRecord.getValue({
                    fieldId: 'custrecord_klp_isnd_so_no'
                });
                const lineId = newRecord.getValue({
                    fieldId: 'custrecord_klp_isnd_so_line_no'
                });
                if (!soId) {
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_isnd_error_on_processing',
                        value: 'Please enter NETSUITE SO NUMBER'
                    })
                    return;
                }
                const period = newRecord.getValue({ fieldId: 'custrecord_klp_isnd_inv_posting_period' });
                if (!period) {
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_isnd_error_on_processing',
                        value: 'Please enter INVOICE POSTING PERIOD (YYYY-MM)'
                    })
                    return;
                }
                const postingPeriod = getPostingPeriod(period);
                if (!postingPeriod) {
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_isnd_error_on_processing',
                        value: 'INVOICE POSTING PERIOD Not available in NetSuite.'
                    })
                    return;
                }
                newRecord.setValue({
                    fieldId: 'custrecord_klp_isnd_posting_period',
                    value: postingPeriod
                });
                const invQuantity = newRecord.getValue({
                    fieldId: 'custrecord_isnd_inv_qty'
                });
                if (!invQuantity) {
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_isnd_error_on_processing',
                        value: 'Please enter value for INVOICE QUANTITY.'
                    })
                    return;
                }
                const validRes = validateQuantity(invQuantity, soId, lineId)
                if (validRes) {
                    newRecord.setValue({
                        fieldId: 'custrecord_klp_isnd_error_on_processing',
                        value: validRes
                    })
                    return;
                }
                // Validate Quantity available to process.

                newRecord.setValue({
                    fieldId: 'custrecord_klp_isnd_error_on_processing',
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
