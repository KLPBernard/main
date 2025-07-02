/**
 * @NApiVersion 2.x
 * @NModuleScope SameAccount
 *
 * 07/26/2024 Kalyani Chintala, NS Case# 4624
 */

define(['N/record', 'N/search'],

    function (record, search) {

        function convNull(value) {
            if (value == null || value == '' || value == undefined)
                value = '';
            return value;
        }

        function getAssocSourceJELines(jeId) {
            var jeRec = record.load({ type: record.Type.JOURNAL_ENTRY, id: jeId }), jeLinesList = {};
            for (var line = 0; line < jeRec.getLineCount({ sublistId: 'line' }); line++) {
                var revRecRule = convNull(jeRec.getSublistValue({ sublistId: 'line', fieldId: 'revenuerecognitionrule', line: line }));
                if (revRecRule == '')
                    continue;
                var acctId = jeRec.getSublistValue({ sublistId: 'line', fieldId: 'account', line: line })
                var deptId = convNull(jeRec.getSublistValue({ sublistId: 'line', fieldId: 'department', line: line }));
                if (deptId == '')
                    continue;

                var hashKey = acctId + '-' + deptId;

                var mSFAssetId = convNull(jeRec.getSublistValue({ sublistId: 'line', fieldId: 'custcol_sf_asset_id', line: line }));
                var mItemId = convNull(jeRec.getSublistValue({ sublistId: 'line', fieldId: 'custcol_item', line: line }));
                var mRevRevPeriod = convNull(jeRec.getSublistValue({ sublistId: 'line', fieldId: 'custcol_rev_rec_planned_period', line: line }));
                var mEndCustomer = convNull(jeRec.getSublistValue({ sublistId: 'line', fieldId: 'custcol_maven_end_customer', line: line }));
                jeLinesList[hashKey] = { 'assetId': mSFAssetId, 'itemId': mItemId, 'period': mRevRevPeriod, 'customer': mEndCustomer };
            }

            log.debug('Checking', 'jeLinesList: ' + JSON.stringify(jeLinesList));
            return jeLinesList;
        }

        function getAssocSourceDetails(revPlanNum) {
            var revenueplanSearchObj = search.create({
                type: "revenueplan",
                filters:
                    [["recordnumber", "is", revPlanNum]],
                columns:
                    [
                        "createdfrom",
                        search.createColumn({ name: "revenuearrangement", join: "revenueElement" }),
                        search.createColumn({ name: "internalid", join: "revenueElement" }),
                        search.createColumn({ name: "source", join: "revenueElement" }),
                        search.createColumn({ name: "referenceid", join: "revenueElement" })
                    ]
            });
            var revEleId = null;
            revenueplanSearchObj.run().each(function (result) {
                revEleId = result.getValue({ name: 'internalid', join: 'revenueElement' });
                log.debug('Checking', 'revEleId: ' + revEleId);
                return false;
            });

            var returnVal = null;
            if (revEleId != null && revEleId != undefined && revEleId != '') {
                //Get associated values from rev arrangement
                var transactionSearchObj = search.create({
                    type: "transaction",
                    filters:
                        [
                            ["revenueelement.internalid", "anyof", revEleId]
                        ],
                    columns:
                        [
                            "tranid",
                            search.createColumn({ name: "recordnumber", join: "revenueElement" }),
                            "custcol_sf_asset_id",
                            "custcol_maven_end_customer",
                            "custcol_item",
                            "custcol_rev_rec_planned_period"
                        ]
                });
                transactionSearchObj.run().each(function (result) {
                    returnVal = {};
                    returnVal['custcol_sf_asset_id'] = result.getValue({ name: 'custcol_sf_asset_id' });
                    returnVal['custcol_maven_end_customer'] = result.getValue({ name: 'custcol_maven_end_customer' });
                    returnVal['custcol_item'] = result.getValue({ name: 'custcol_item' });
                    returnVal['custcol_rev_rec_planned_period'] = result.getValue({ name: 'custcol_rev_rec_planned_period' });
                    return false;
                });
            }

            return returnVal;
        }

        function getAmortJeDetail(amortIdArr) {
            log.debug("amortIdArr", amortIdArr);
            var resObj = {};
            if (amortIdArr.length == 0) {
                return amortIdArr;
            }
            var journalentrySearchObj = search.create({
                type: "journalentry",
                settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }],
                filters:
                    [
                        ["type", "anyof", "Journal"],
                        "AND",
                        ["amortizationschedule.internalid", "anyof", amortIdArr]
                    ],
                columns:
                    [
                        search.createColumn({ name: "datecreated", label: "Date Created" }),
                        search.createColumn({ name: "tranid", label: "Document Number" }),
                        search.createColumn({
                            name: "schedulenumber",
                            join: "amortizationSchedule",
                            label: "Number"
                        }),
                        search.createColumn({
                            name: "internalid",
                            join: "amortizationSchedule",
                            label: "Internal ID"
                        }),
                        search.createColumn({ name: "custcol_sf_asset_id", label: "Maven SF Asset ID" }),
                        search.createColumn({ name: "custcol_item", label: "M Item" }),
                        search.createColumn({ name: "custcol_maven_end_customer", label: "Maven End Customer" }),
                        search.createColumn({ name: "custcol_rev_rec_planned_period", label: "M Rev Rec Planned Period" })
                    ]
            });
            journalentrySearchObj.run().each(function (result) {
                var amort = result.getValue({
                    name: "internalid",
                    join: "amortizationSchedule"
                });
                if (!resObj.hasOwnProperty(amort)) {
                    resObj[amort] = {
                        custcol_sf_asset_id: result.getValue({
                            name: "custcol_sf_asset_id"
                        }),
                        custcol_item: result.getValue({
                            name: "custcol_item"
                        }),
                        custcol_maven_end_customer: result.getValue({
                            name: "custcol_maven_end_customer"
                        }),
                        custcol_rev_rec_planned_period: result.getValue({
                            name: "custcol_rev_rec_planned_period"
                        })
                    }
                }
                return true;
            });
            return resObj;
        }

        function processJE(jeId) {
            var jeRec = record.load({ type: record.Type.JOURNAL_ENTRY, id: jeId, isDynamic: true });

            var allRevRecPlanLineDetails = {}, isJEUpd = false;
            //=========================V2.0-START===========================
            var amortArr = [];
            for (var index = 0; index < jeRec.getLineCount({ sublistId: 'line' }); index++) {
                jeRec.selectLine({ sublistId: 'line', line: index });
                var amortId = jeRec.getSublistValue({ sublistId: 'line', fieldId: 'schedulenum', line: index });
                log.debug({
                    title: "amortId",
                    details: amortId
                })
                if (amortId && amortArr.indexOf(amortId) == -1) {
                    amortArr.push(amortId);
                }
            }
            var amortDetails = getAmortJeDetail(amortArr);
            log.debug("amortDetails", amortDetails);
            for (var index = 0; index < jeRec.getLineCount({ sublistId: 'line' }); index++) {
                jeRec.selectLine({ sublistId: 'line', line: index });
                var amortId = jeRec.getSublistValue({ sublistId: 'line', fieldId: 'schedulenum', line: index });
                log.debug("Amort Element", amortDetails.hasOwnProperty(amortId));
                if (amortDetails.hasOwnProperty(amortId)) {
                    var amortValues = amortDetails[amortId];
                    log.debug("amortValues", amortValues);
                    for (var element in amortValues) {
                        var elemVal = amortValues[element];
                        if (elemVal) {
                            jeRec.setCurrentSublistValue({
                                sublistId: 'line',
                                fieldId: element,
                                value: elemVal,
                                ignoreFieldChange: false
                            });
                        }
                    }
                    jeRec.commitLine({ sublistId: 'line' });
                    isJEUpd = true;
                }
            }
            //=========================V2.0-END=============================
            for (var line = 0; line < jeRec.getLineCount({ sublistId: 'line' }); line++) {

                var revPlanNum = convNull(jeRec.getSublistValue({ sublistId: 'line', fieldId: 'sourcerevenueplan', line: line }));
                var deptId = convNull(jeRec.getSublistValue({ sublistId: 'line', fieldId: 'department', line: line }));
                if (revPlanNum == '' || deptId == '') {
                    continue;
                }
                //Now get associated revenue plan's InternalId
                log.debug('Checking', 'revPlanNum: ' + revPlanNum);
                var hashKey = 'revplan-' + revPlanNum;
                if (convNull(allRevRecPlanLineDetails[hashKey]) == '') {
                    var lineDetails = getAssocSourceDetails(revPlanNum);
                    log.debug('Checking', 'lineDetails: ' + JSON.stringify(lineDetails));
                    allRevRecPlanLineDetails[hashKey] = lineDetails;
                }

                var lineDetails = allRevRecPlanLineDetails[hashKey];
                if (lineDetails != null && lineDetails != '' && lineDetails != undefined) {
                    jeRec.selectLine({ sublistId: 'line', line: line });
                    jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_sf_asset_id', value: convNull(lineDetails.custcol_sf_asset_id), ignoreFieldChange: true });
                    jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_item', value: convNull(lineDetails.custcol_item), ignoreFieldChange: true });
                    jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_rev_rec_planned_period', value: convNull(lineDetails.custcol_rev_rec_planned_period), ignoreFieldChange: true });
                    jeRec.setCurrentSublistValue({ sublistId: 'line', fieldId: 'custcol_maven_end_customer', value: convNull(lineDetails.custcol_maven_end_customer), ignoreFieldChange: true });
                    jeRec.commitLine({ sublistId: 'line' });
                    isJEUpd = true;
                }

            }

            if (isJEUpd)
                jeRec.save({ ignoreMandatoryFields: true, enableSourcing: false });
            log.debug('Checking', 'Done updating JE!');
        }


        return {
            getAssocSourceDetails: getAssocSourceDetails,
            getAssocSourceJELines: getAssocSourceJELines,
            processJE: processJE,
        };

    });
