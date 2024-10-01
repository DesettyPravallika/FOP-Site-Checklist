/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @Author pravallika
 * @Date 02/09/2024
 */
define(['N/url', 'N/currentRecord', 'N/log', 'N/https', 'N/search', 'N/email', 'N/ui/message', 'N/runtime','N/record'],
    function (url, currentRecord, log, https, search, email, message, runtime,record) {

        function pageInit(scriptContext) {
            var submitButton = document.getElementById('custpage_save_button');
            if (submitButton) {
                submitButton.className = 'submit-button';
            }
        }

        const SiteChecklistButton = () => {
            try {
                // const woRecordId = currentRecord.get().id;
                // console.log(woRecordId);
                const woRecord = currentRecord.get();
                const woRecordId = woRecord.id;

                const contactDetails = getPrimaryContacts(woRecordId);
                console.log(contactDetails);

                const customerId = woRecord.getValue({ fieldId: 'custrecord_esp_cfi_wo_customer' });
                console.log(customerId);

                if (!validateCustomerCenterRole(customerId)) {
                    alert('Customer does not have the "Customer Center" role. Email not sent.');
                    return;
                }

                if (contactDetails.length === 0) {
                    alert('No primary contacts found.');
                    return;
                }
                const accountId = runtime.accountId;
                console.log(accountId);



                contactDetails.forEach(contact => {
                    //https://tstdrv2617106.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=1077&deploy=1&compid=TSTDRV2617106&ns-at=AAEJ7tMQM6s_Zh3pGhZIUN0-OGpB-YksUCljxOHL7rJFsf8DPy8&woRecordId=61
                    //     const suiteletUrl = `https://${accountId}.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=${scriptId}&deploy=${deploymentId}&ns-at=AAEJ7tMQM6s_Zh3pGhZIUN0-OGpB-YksUCljxOHL7rJFsf8DPy8&compid=${accountId}&woRecordId={woRecordId}&type=email`;
                    //    console.log(suiteletUrl);
                    //const suitleturl = `https://${accountId}.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=1077&deploy=1&compid=TSTDRV2617106&woRecordId=&type=email&contactName=test&contactEmail=desettipravallika@gmail.com&contactPhone=9876543210&c=TSTDRV2617106&isExternal=T&ns-at=AAEJ7tMQM6s_Zh3pGhZIUN0-OGpB-YksUCljxOHL7rJFsf8DPy8`;
                    const suiteletUrl = url.resolveScript({
                        scriptId: 'customscript_esp_cfi_fop_sl_render_form',
                        deploymentId: 'customdeploy_esp_cfi_fop_sl_render_form',
                       //returnExternalUrl: true,
                        params: {
                            woRecordId: woRecordId, type: "email", contactName: contact.name,
                            contactEmail: contact.email, contactPhone: contact.phone
                        }
                    });

                    const response = https.post({
                        url: suiteletUrl,
                        body: JSON.stringify({ contactEmail: contact.email, contactName: contact.name, suiteletUrl }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    console.log('response');
                    log.debug('response', response);

                    if (response.code === 200) {
                        alert(`Email sent successfully to ${contact.email}`);
                    } else {
                        alert(`Failed to send email to ${contact.email}.`);
                    }
                });
            } catch (e) {
                log.error('Error sending email', e.message);
            }
        };

        const saveResponse = () => {
            const siteForm = currentRecord.get();

            if (!validateField()) {
                return;
            }

            const formData = gatherFormData();
            const urlParams = new URL(window.location.href);
            const woRecordId = urlParams.searchParams.get('woRecordId');
            const contactName = decodeURIComponent(urlParams.searchParams.get('contactName')) || '';
            const contactEmail = decodeURIComponent(urlParams.searchParams.get('contactEmail')) || '';
            const contactPhone = decodeURIComponent(urlParams.searchParams.get('contactPhone')) || '';
            const suiteletUrl = url.resolveScript({
                scriptId: 'customscript_esp_cfi_fop_sl_render_form',
                deploymentId: 'customdeploy_esp_cfi_fop_sl_render_form',
                //returnExternalUrl: true,
                params: { woRecordId: woRecordId, type: "response", contactName: encodeURIComponent(contactName), contactEmail: encodeURIComponent(contactEmail), contactPhone: encodeURIComponent(contactPhone) }
            });

            const submitsResponse = https.post({
                url: suiteletUrl,
                body: JSON.stringify(formData),
                headers: { 'Content-Type': 'application/json' }
            });

            if (submitsResponse.code === 200) {
                var myMsg = message.create({
                    title: "Success",
                    message: "Data saved successfully",
                    type: message.Type.INFORMATION
                });
                myMsg.show({ duration: 5000 });
                window.location.reload();
            } else {
                alert('Failed to save data. Please try again.');
            }
        };

        function getPrimaryContacts(woRecordId) {
            const contactSearch = search.create({
                type: 'customrecord_esp_fop_wo_contact',
                filters: [['custrecord_esp_fop_rel_wo', 'anyof', woRecordId]],
                columns: [
                    search.createColumn({ name: 'custrecord_esp_fop_wo_contact_email' }),
                    search.createColumn({ name: 'custrecord_esp_fop_wo_contact_name' }),
                    search.createColumn({ name: 'custrecord_esp_fop_wo_contact_role' }),
                    search.createColumn({ name: 'custrecord_esp_fop_wo_phone_number' }),
                ]
            });

            const results = contactSearch.run().getRange({ start: 0, end: 100 });
            return results.filter(result => result.getText('custrecord_esp_fop_wo_contact_role') === 'Primary Contact').map(contact => ({
                email: contact.getValue('custrecord_esp_fop_wo_contact_email'),
                name: contact.getValue('custrecord_esp_fop_wo_contact_name'),
                phone: contact.getValue('custrecord_esp_fop_wo_phone_number')
            }));
        }

        function validateField() {
            let isFormValid = true;
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(function (checkbox) {
                const elementId = checkbox.id.replace('_checkbox', '');
                const textArea = document.querySelector(`#${elementId}_answer`);
                if (checkbox.checked && textArea.value.trim() === '') {
                    textArea.classList.add('error');
                    isFormValid = false;
                } else {
                    textArea.classList.remove('error');
                }
            });
            return isFormValid;
        }

        function gatherFormData() {
            const formData = [];
            const elements = document.querySelectorAll('input[type="checkbox"]');
            elements.forEach(function (element) {
                const elementId = element.id.replace('_checkbox', '');
                if (element.checked) {
                    formData.push({
                        question: document.querySelector(`#${elementId}_question`).value,
                        answer: document.querySelector(`#${elementId}_answer`).value,
                        category: document.querySelector(`#${elementId}_category`).value
                    });
                }
            });
            return formData;
        }

    
        function validateCustomerCenterRole(customerId) {
            let hasCustomerCenterRole = false;
        
            const customerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: customerId
            });
        
            const giveAccess = customerRecord.getValue({ fieldId: 'giveaccess' });
            if (giveAccess) {
                
                const contactCount = customerRecord.getLineCount({ sublistId: 'contactroles' });
                
                for (let i = 0; i < contactCount; i++) {
                    const role = customerRecord.getSublistValue({
                        sublistId: 'contactroles', 
                        fieldId: 'role',           
                        line: i
                    });
                    if (role === '14') {  
                        hasCustomerCenterRole = true;
                        break;
                    }
                }
            }
        
            return hasCustomerCenterRole;
        }
        
        
        return {
            pageInit,
            SiteChecklistButton,
            saveResponse,
            validateField
        };
    });
