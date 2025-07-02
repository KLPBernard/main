/* The following javascript code is created by KLP, a NetSuite Partner.
* The code is provided "as is": KLP Inc shall not be liable for any damages
* arising out the intended use or if the code is modified after delivery.
*
* Company :     KLP
* Author  :     M.Marce
*/

function customizeGlImpact(transactionRecord, standardLines, customLines, book) {

    function findIsReplaceMemo(memo, memoKeyWords) {
        var isReplaceMemo = false;
        if (!memo) return isReplaceMemo;
        for (var index = 0; index < memoKeyWords.length; index++) {
            var compareMemo = memoKeyWords[index].toLocaleLowerCase().trim();
            compareMemo = compareMemo.replace(/\s/g, '');
            var lineMemo = memo.toLocaleLowerCase();
            lineMemo = lineMemo.replace(/\s/g, '');

            if (lineMemo.indexOf(compareMemo) >= 0) {
                isReplaceMemo = true;
                break;
            }
        }
        return isReplaceMemo;
    }

    var recordType = transactionRecord.getFieldValue('type');
    var accountToSkip = [111];
    if (['exprept'].indexOf(recordType) <= -1) { return; }
    var context = nlapiGetContext();
    var memoKeyWords = context.getSetting('SCRIPT', 'custscript_gl_memo_words');
    var replaceDepartment = context.getSetting('SCRIPT', 'custscript_gl_plug_replace_department');

    if (memoKeyWords) {
        memoKeyWords = memoKeyWords.split(",")
    } else {
        nlapiLogExecution('Debug', 'Memo Not Available', memoKeyWords);
        return;
    }
    if (!replaceDepartment) {
        nlapiLogExecution('Debug', 'Department Not Available', replaceDepartment);
        return;
    }
    for (var stdIdx = 0; stdIdx < standardLines.getCount(); stdIdx++) {
        var stdLine = standardLines.getLine(stdIdx);
        var isPosting = stdLine.isPosting();
        if (isPosting == true) {
            var accountId = stdLine.getAccountId();
            nlapiLogExecution('Debug', 'accountId', accountId);
            if (!accountId) {
                continue;
            }
            if (accountToSkip.indexOf(parseInt(accountId)) > -1) {
                nlapiLogExecution('Debug', 'Account is skipped');
                continue;
            }
            var memo = stdLine.getMemo();
            var isReplaceMemoLine = findIsReplaceMemo(memo, memoKeyWords)
            nlapiLogExecution('Debug', 'isReplaceMemoLine - ', memo + ' - ' + isReplaceMemoLine);
            if (!isReplaceMemoLine) { return; }
            var debitAmount = stdLine.getDebitAmount();
            var creditAmount = stdLine.getCreditAmount();
            var departmentId = stdLine.getDepartmentId();
            var classId = stdLine.getClassId();
            var locationId = stdLine.getLocationId();
            var entityId = stdLine.getEntityId();
            if (debitAmount == 0 && creditAmount == 0) {
                continue;
            }

            // Reverse the GL Impact
            var newLine = customLines.addNewLine();
            newLine.setAccountId(parseInt(accountId));
            if (memo) { newLine.setMemo(memo); }
            if (entityId) { newLine.setEntityId(parseInt(entityId)); }
            if (departmentId) { newLine.setDepartmentId(parseInt(departmentId)) };
            if (classId) { newLine.setClassId(parseInt(classId)); }
            if (locationId) { newLine.setLocationId(parseInt(locationId)); }
            if (creditAmount != 0) {
                newLine.setDebitAmount(parseFloat(creditAmount));
            }
            if (debitAmount != 0) {
                newLine.setCreditAmount(parseFloat(debitAmount));
            }
            //Add new Line with Entity.
            var newLine = customLines.addNewLine();
            newLine.setAccountId(parseInt(accountId));
            if (memo) { newLine.setMemo(memo); }
            if (entityId) { newLine.setEntityId(parseInt(entityId)); }
            if (departmentId) { newLine.setDepartmentId(parseInt(replaceDepartment)); }
            if (classId) { newLine.setClassId(parseInt(classId)); }
            if (locationId) { newLine.setLocationId(parseInt(locationId)); }
            //if (divisionId) { newLine.setSegmentValueId('cseg_smt_division', parseInt(divisionId)); }
            if (creditAmount != 0) {
                newLine.setCreditAmount(parseFloat(creditAmount));
            }
            if (debitAmount != 0) {
                newLine.setDebitAmount(parseFloat(debitAmount));
            }
        }
    }
}
