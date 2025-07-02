/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @deployedTo - Group Invoice
 * ------------------------------------------
 * MAX Governance Used
 * ------------------------------------------
 * beforeLoad Governace Used - 0
 * beforeSubmit Governance Used - 0
 * aftersubmit Governance Used - 0
 * ---------------------------------------------------------------------------------------
 *  Author   | Version |   Date    |       Description
 * ---------------------------------------------------------------------------------------
 *  MMarce   | V1.0    | Sep-1-2023| CASE 2606: Show Print button
 */
define(['N/runtime', 'N/url'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (runtime, url) => {
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
            //====================V1.0-START========================
            if (scriptContext.type == scriptContext.UserEventType.VIEW) {
                const newRecord = scriptContext.newRecord;
                const form = scriptContext.form;
                var printPdfUrl = url.resolveScript({
                    deploymentId: 'customdeploy_sl_group_inv_pdf',
                    scriptId: 'customscript_sl_group_inv_pdf',
                    params: {
                        recId: newRecord.id,
                        customerId: newRecord.getValue('customer'),
                        currencyId: newRecord.getValue('currency')
                    }
                });
                form.addButton({
                    id: 'custpage_bt_print_obj',
                    label: 'Maven Print',
                    functionName: "window.open('" + printPdfUrl + "','_blank');"
                });
            }
            //====================V1.0-END==========================
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
            beforeLoad,
            // beforeSubmit,
            // afterSubmit
        }

    });
