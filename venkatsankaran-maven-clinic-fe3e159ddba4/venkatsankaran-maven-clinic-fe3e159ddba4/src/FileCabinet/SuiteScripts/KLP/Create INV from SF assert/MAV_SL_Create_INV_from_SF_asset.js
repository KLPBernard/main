/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *---------------------------------------------------------------------------------------
 *  Author   | Version |   Date      |       Description
 * ---------------------------------------------------------------------------------------
 *  MMarce   | V1.0    | MAR-21-2023 | trigger MR Script to create Invoice based on "Invoice with SF Asset ID details"
 *
 */
define(['N/ui/serverWidget', 'N/task', 'N/file', 'N/search', 'N/redirect', 'N/runtime', 'N/url'],

    (serverWidget, task, file, search, redirect, runtime, url) => {

        function isMrInProgress(scriptID) {
            var scheduledscriptinstanceSearchObj = search.create({
                type: "scheduledscriptinstance",
                filters:
                    [
                        ["status", "anyof", "PENDING", "PROCESSING", "RESTART", "RETRY"],
                        "AND",
                        ["script.scriptid", "is", scriptID]
                    ]
            });
            var searchResultCount = scheduledscriptinstanceSearchObj.runPaged().count;
            log.debug('searchResultCount', searchResultCount)
            if (searchResultCount > 0) {
                return true
            }
            return false

        }


        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            if (scriptContext.request.method == 'GET') {
                log.debug('Request', scriptContext.request.method)
                const scriptId = runtime.getCurrentScript().getParameter({
                    name: 'custscript_sl_crt_inv_script_id'
                });
                var formTitle = scriptId == 'customscript_mr_create_inv_from_asset' ? 'Create Invoice from SF Asset' : 'Maven Invoice Creation by SO + Line ID'
                var form = serverWidget.createForm({
                    title: formTitle,
                    id: 'custpage_form'
                });

                if (isMrInProgress(scriptId)) {
                    var RefreshButton = form.addField({
                        id: 'custpage_htmldata',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: 'Refresh'
                    });
                    RefreshButton.updateLayoutType({
                        layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE
                    });

                    var buttonString = '<style>\n' +
                        '.button {\n' +
                        '  background-color: #0c6fa8;\n' +
                        '  border: none;\n' +
                        '  color: white;\n' +
                        '  padding: 15px 32px;\n' +
                        '  text-align: center;\n' +
                        '  text-decoration: none;\n' +
                        '  display: inline-block;\n' +
                        '  font-size: 16px;\n' +
                        '  margin: 4px 2px;\n' +
                        '  cursor: pointer;\n' +
                        '} </style>' +
                        '<button type="button" class="button"  onClick="window.location.reload()">Refresh</button>'
                    RefreshButton.defaultValue = buttonString;

                    var imageUlr = runtime.getCurrentScript().getParameter({
                        name: 'custscript_sl_crt_inv_loading_img'
                    })
                    if (imageUlr) {
                        var htmlVal = form.addField({
                            id: 'custpage_ic_inlinehtml',
                            label: 'HTML',
                            type: serverWidget.FieldType.INLINEHTML
                        });
                        htmlVal.defaultValue =
                            '<body>  <h1 style="color:green;">Invoice creation in progress.</h1>' +
                            '<script>document.getElementById("body").style.background = "url(' +
                            // appHost +
                            imageUlr +
                            ') center no-repeat"</script> </body> ';
                    }
                } else {
                    form.addSubmitButton({
                        label: 'Create Invoice'
                    });
                    var posting = form.addField({
                        id: 'custpage_posting_period',
                        label: 'Posting Period',
                        type: serverWidget.FieldType.SELECT,
                        source: -105
                    });
                    posting.isMandatory = true;
                }
                scriptContext.response.writePage(form);
            }
            else {
                var params = scriptContext.request.parameters;
                const scriptId = runtime.getCurrentScript().getParameter({
                    name: 'custscript_sl_crt_inv_script_id'
                });
                const postingPeriod = params.custpage_posting_period;
                var paramsObj = {};
                if (scriptId == 'customscript_mr_create_inv_from_so_line') {
                    paramsObj['custscript_mr_inv_crt_frm_so_period'] = postingPeriod
                } else if (scriptId == 'customscript_mr_create_inv_from_asset') {
                    paramsObj['custscript_mr_inc_creat_posting_period'] = postingPeriod
                }
                var mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: scriptId,
                    params: paramsObj
                });
                mrTask.submit();
                redirect.toSuitelet({
                    scriptId: runtime.getCurrentScript().id,
                    deploymentId: runtime.getCurrentScript().deploymentId,
                    isExternal: false
                });

            }
        };

        return { onRequest };
    }
);
