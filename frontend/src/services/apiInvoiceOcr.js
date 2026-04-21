/**
 * API Service for OCR Invoice Import
 * Handles PDF upload, OCR processing, and invoice creation from extracted data
 */

import api from "./apiInstance";

/**
 * Invoice OCR Import API
 */
export const invoiceOcrApi = {
    /**
     * Upload PDF and process through OCR
     * @param {FormData} formData - Contains the PDF file
     * @returns {Promise} OCR processing result with extracted data
     */
    upload: (formData) =>
        api.post('/invoices/ocr/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000 // 60 seconds timeout for OCR processing
        }),

    /**
     * Get PDF preview as base64
     * @param {string} token - Preview token from upload response
     * @returns {Promise} Base64 PDF content
     */
    getPreview: (token) => api.get(`/invoices/ocr/preview/${token}`),

    /**
     * Confirm import and create invoice from validated data
     * @param {Object} data - Validated invoice data
     * @param {string} data.token - Preview token
     * @param {number} data.fk_ptr_id - Supplier partner ID
     * @param {string} data.inv_date - Invoice date (YYYY-MM-DD)
     * @param {string} [data.inv_duedate] - Due date (YYYY-MM-DD)
     * @param {string} [data.inv_externalreference] - External reference/invoice number
     * @param {number} [data.fk_pam_id] - Payment mode ID
     * @param {number} [data.fk_dur_id_payment_condition] - Payment condition ID
     * @param {string} [data.inv_note] - Invoice note
     * @param {Array} data.lines - Invoice lines
     * @returns {Promise} Created invoice info
     */
    confirm: (data) => api.post('/invoices/ocr/confirm', data),

    /**
     * Cancel import session and clean up temp files
     * @param {string} token - Preview token to cancel
     * @returns {Promise} Cancellation result
     */
    cancel: (token) => api.post('/invoices/ocr/cancel', { token }),
};
