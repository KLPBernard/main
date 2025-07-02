/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * 07/26/2024 Kalyani Chintala, NS Case# 4624
 */

define(['N/record', 'N/redirect', 'N/runtime', 'N/search', 'N/ui/serverWidget', 'N/url', 'N/task', 'SuiteScripts/KLP/[KLP]maven_RevRecJEFldsUpdLib.js'],
	/**
	 * @param {record} record
	 * @param {redirect} redirect
	 * @param {runtime} runtime
	 * @param {search} search
	 * @param {serverWidget} serverWidget
	 */
	function (record, redirect, runtime, search, serverWidget, url, task, libObj) {

		/**
		 * Definition of the Suitelet script trigger point.
		 *
		 * @param {Object} context
		 * @param {ServerRequest} context.request - Encapsulation of the incoming request
		 * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
		 * @Since 2015.2
		 */
		function onRequest(context) {
			var scriptObj = runtime.getCurrentScript(), form = null;
			var suiteletUrl = url.resolveScript({ scriptId: scriptObj.id, deploymentId: scriptObj.deploymentId, returnExternalUrl: false });
			if (context.request.method === 'GET') {
				form = serverWidget.createForm({ title: 'Rev Rec/Amortization JE Flds Update' });
				form.addField({ id: 'custpage_je', label: 'Rev Rec JE', type: serverWidget.FieldType.SELECT, source: record.Type.JOURNAL_ENTRY }).isMandatory = true;
				form.addSubmitButton({ label: 'Submit' });
				form.addResetButton({ label: 'Reset' });
				context.response.writePage(form);//write.
			}
			else {
				var jeId = context.request.parameters.custpage_je;
				if (convNull(jeId) == '') {
					throw 'Missing required parameters!';
					return;
				}
				var jeRec = record.load({ type: record.Type.JOURNAL_ENTRY, id: jeId, isDynamic: true });
				var jeLinesCount = jeRec.getLineCount({ sublistId: 'line' });
				var reqUsage = ((jeLinesCount / 2) * 20) + 40;
				log.debug('Checking', 'reqUsage: ' + reqUsage);
				if (reqUsage < 900) {
					//You can process the JE immediately here
					libObj.processJE(jeId);
					redirect.toRecord({ type: record.Type.JOURNAL_ENTRY, id: jeId });
					return;
				}
				else {
					var isBatchProcAlreadyRunning = false;
					//Check if MR script is already running
					var batchProcInstanceSrchObj = search.create({
						type: "scheduledscriptinstance",
						filters:
							[
								["script.scriptid", "is", "customscript_klp_upd_rev_rev_je_flds"],
								"AND",
								["status", "anyof", "PROCESSING", "PENDING"]
							],
						columns:
							["status", "mapreducestage", "percentcomplete",]
					});
					batchProcInstanceSrchObj.run().each(function (result) {
						isBatchProcAlreadyRunning = true;
						return true;
					});
				}

				form = serverWidget.createForm({ title: 'Rev Rec JE Fields Update' });
				var outputHtmlFld = form.addField({ id: 'custpage_inline_html', label: 'Output Message', type: serverWidget.FieldType.INLINEHTML });
				if (isBatchProcAlreadyRunning)
					outputHtmlFld.defaultValue = '<h3>The backend process to update Rev Rec JE is already running for some other JE. Please try to submit new entry after some time! <br /><a href="' + suiteletUrl + '">Click here</a> to go back</h3>';
				else {
					var mrTask = task.create({ taskType: task.TaskType.MAP_REDUCE, scriptId: 'customscript_klp_upd_rev_rev_je_flds', params: { 'custscript_klp_upd_rev_rev_je_flds_jeid': jeId } });
					mrTask.submit();
					outputHtmlFld.defaultValue = '<h3>The backend process is initiated to update the Journal Entry: ' + jeRec.getValue({ fieldId: 'tranid' }) + '. Please check back again after some time! <br /><a href="' + suiteletUrl + '">click here</a> to go back</h3>';
				}
				context.response.writePage(form);
			}
		}

		function convNull(value) {
			if (value == null || value == '' || value == undefined)
				value = '';
			return value;
		}

		return {
			onRequest: onRequest
		};

	});
