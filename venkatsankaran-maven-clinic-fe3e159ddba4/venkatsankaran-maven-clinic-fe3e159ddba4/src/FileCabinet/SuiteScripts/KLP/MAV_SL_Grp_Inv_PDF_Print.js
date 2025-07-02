/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *---------------------------------------------------------------------------------------
 *  Author   | Version |   Date      |       Description
 * ---------------------------------------------------------------------------------------
 *  MMarce   | V1.0    | MAY-26-2023 | CASE 1911: Invoice Group PDF Print.
 *
 */
define(['N/search', 'N/render', 'N/record', 'N/runtime', 'N/format/i18n'],

    (search, render, record, runtime, i18format) => {

        function getTextForValue(value, countryArray) {
            const country = countryArray.find(item => item.value === value);
            return country ? country.text : null;
        }

        function getShipToAddress(custId) {
            var custRecord = record.load({
                type: record.Type.CUSTOMER,
                id: custId,
                isDynamic: true
            })

            const shipattention = custRecord.getValue({
                fieldId: 'shipattention'
            });
            const shipaddressee = custRecord.getValue({
                fieldId: 'shipaddressee'
            });
            const shipAddress1 = custRecord.getValue({
                fieldId: 'shipaddr1'
            });
            const shipAddress2 = custRecord.getValue({
                fieldId: 'shipaddr2'
            });
            const city = custRecord.getValue({
                fieldId: 'shipcity'
            });
            const shipState = custRecord.getValue({
                fieldId: 'shipstate'
            });
            const shipZip = custRecord.getValue({
                fieldId: 'shipzip'
            });


            var country = custRecord.getText({
                fieldId: 'shipcountry'
            });
            if (country) {
                const custSubrec = custRecord.getCurrentSublistSubrecord({ sublistId: 'addressbook', fieldId: 'addressbookaddress' });
                const countryFieldObj = custSubrec.getField({ fieldId: 'country' });
                const countryList = countryFieldObj.getSelectOptions();
                country = getTextForValue(country, countryList)
            }
            var address = ''
            if (shipattention) address = shipattention + '<br/>';
            if (shipaddressee) address += shipaddressee + '<br/>';
            if (shipAddress1) address += shipAddress1 + '<br/>';
            if (shipAddress2) address += shipAddress2 + '<br/>';
            if (city || shipState || shipZip) address += city + ' ' + shipState + ' ' + shipZip + '<br/>';
            if (country) address += country
            return address;
        }

        function getRelatedInv(grpInvId, currencyId) {
            const currencyRecord = record.load({
                type: record.Type.CURRENCY,
                id: currencyId
            });
            const curLocation = currencyRecord.getValue({
                fieldId: 'locale'
            });
            var numFormatter = i18format.getNumberFormatter({
                decimalSeparator: ",",
                precision: 0,
                locale: curLocation
            });
            const curSymbol = currencyRecord.getValue({
                fieldId: 'displaysymbol'
            });
            // log.debug('curLocation', curLocation)
            var curFormatter = i18format.getCurrencyFormatter({
                locale: curLocation
            });
            var numberFormatter = curFormatter.numberFormatter;
            var relatedInv = [];
            var resultDetails = [];
            var custId = ''
            const invSearchObj = search.create({
                type: "transaction",
                filters:
                    [
                        ["groupedto", "anyof", grpInvId],
                        "AND",
                        ["mainline", "is", "F"],
                        "AND",
                        ["taxline", "is", "F"],
                        "AND",
                        ["cogs", "is", "F"],
                        "AND",
                        ["shipping", "is", "F"],
                        "AND",
                        ["memorized", "is", "F"]
                    ],
                columns:
                    [
                        search.createColumn({ name: "tranid", label: "Document Number" }),
                        search.createColumn({ name: "custbody_maven_end_customer", label: "Maven End Customer" }),
                        search.createColumn({
                            name: "displayname",
                            join: "item",
                            label: "Display Name"
                        }),
                        search.createColumn({ name: "quantity", label: "Quantity" }),
                        search.createColumn({ name: "rate", label: "Item Rate" }),
                        search.createColumn({ name: "amount", label: "Amount" }),
                        search.createColumn({ name: "custcol1", label: "Service Start Date" }),
                        search.createColumn({ name: "custcol2", label: "Service End Date" }),
                        search.createColumn({ name: "fxamount", label: "Amount (Foreign Currency)" }),
                        search.createColumn({
                            name: "internalid",
                            sort: search.Sort.ASC,
                            label: "Internal ID"
                        }),
                        search.createColumn({ name: "fxrate", label: "Item Rate" })
                    ]
            });
            invSearchObj.run().each(function (result) {
                const rate = result.getValue({ name: "fxrate" }) ? parseFloat(result.getValue({ name: "fxrate" })) : curSymbol + 0;
                const amount = result.getValue({ name: "fxamount" }) ? parseFloat(result.getValue({ name: "fxamount" })) : curSymbol + 0;
                relatedInv.push(result.id)
                log.debug('rate', rate)
                resultDetails.push({
                    invoicenum: result.getValue({ name: "tranid" }),
                    itemDisplayName: result.getValue({
                        name: "displayname",
                        join: "item"
                    }),

                    // amount: result.getValue({ name: "fxamount" }) ? curSymbol + result.getValue({ name: "fxamount" }) : curSymbol + 0,
                    rate: curSymbol + rate,
                    quantity: result.getValue({ name: "quantity" }) ? numFormatter.format({ number: parseInt(result.getValue({ name: "quantity" })) }) : 0,
                    serviceStartDate: result.getValue({ name: "custcol1" }),
                    serviceEndDate: result.getValue({ name: "custcol2" }),
                    fxamount: curSymbol + numberFormatter.format({ number: amount }),
                    endCustomer: result.getText({ name: "custbody_maven_end_customer" })
                })
                return true;
            });

            return {
                relatedInv: relatedInv,
                resultDetails: resultDetails
            }
        }
        /**
             * Defines the Suitelet script trigger point.
             * @param {Object} scriptContext
             * @param {ServerRequest} scriptContext.request - Incoming request
             * @param {ServerResponse} scriptContext.response - Suitelet response
             * @since 2015.2
             */

        const onRequest = (scriptContext) => {
            var scriptObj = runtime.getCurrentScript();
            if (scriptContext.request.method == 'GET') {
                const params = scriptContext.request.parameters;
                const grpInvId = params.recId;
                const custId = params.customerId;

                const ShipToAddres = getShipToAddress(custId);
                log.debug('ShipToAddres', ShipToAddres)
                var currencyId = params.currencyId;
                const relatedRecObj = getRelatedInv(grpInvId, currencyId);
                const templateId = scriptObj.getParameter({
                    name: 'custscript_sl_group_inv_pdf_template'
                });
                const folderId = scriptObj.getParameter({
                    name: 'custscript_sl_group_folder_id'
                });

                var rnderObj = render.create();
                rnderObj.setTemplateById({ id: templateId });
                rnderObj.addRecord({
                    templateName: "record",
                    record: record.load({
                        type: 'invoicegroup',
                        id: grpInvId,
                    }),
                });
                rnderObj.addCustomDataSource({
                    format: render.DataSource.OBJECT,
                    alias: "groupedinvoices_summary",
                    data: {
                        result: relatedRecObj.resultDetails
                    }
                });

                rnderObj.addCustomDataSource({
                    format: render.DataSource.OBJECT,
                    alias: "address",
                    data: {
                        shipping: ShipToAddres
                    }
                });

                // var pdfSummaryXML = rnderObj.renderAsString();
                // pdfSummaryXML = pdfSummaryXML.replace('<?xml version="1.0"?><!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">', '');
                // xmlString += pdfSummaryXML;

                // const relatedInv = relatedRecObj.relatedInv;
                // relatedInv.forEach(element => {
                //     var soPrintXMLFile = render.transaction({
                //         entityId: parseInt(element),
                //         printMode: render.PrintMode.HTML,
                //         inCustLocale: true
                //     });
                //     var soPrintXML = soPrintXMLFile.getContents();
                //     soPrintXML = soPrintXML.replace('<?xml version="1.0"?><!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">', '');
                //     xmlString += '<pdf>' + soPrintXML + '</pdf>';
                // });
                // xmlString += '</pdfset>';

                // var finalRndrObj = render.create();
                // finalRndrObj.templateContent = xmlString;
                var pdfFile = rnderObj.renderAsPdf();

                scriptContext.response.writeFile(pdfFile, true);
                pdfFile.name = 'INVG' + grpInvId;
                pdfFile.folder = folderId;
                var newFileId = pdfFile.save();
                log.debug('newFileId', newFileId);
            }

        }
        return {
            onRequest
        }

    }
);