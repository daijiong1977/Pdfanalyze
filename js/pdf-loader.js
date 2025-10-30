class PDFTextExtractor {
    async extractTextFromPDF(pdfFile) {
        const fileUrl = URL.createObjectURL(pdfFile);
        try {
            const pdf = await pdfjsLib.getDocument(fileUrl).promise;
            let fullText = '';

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `PAGE ${pageNum}:\n${pageText}\n\n`;
            }

            return fullText;
        } finally {
            URL.revokeObjectURL(fileUrl);
        }
    }

    validatePDFFile(file) {
        const maxSize = 10 * 1024 * 1024;
        if (file.type !== 'application/pdf') {
            throw new Error('Please select a PDF file');
        }
        if (file.size > maxSize) {
            throw new Error('PDF too large. Please use a file under 10MB.');
        }
        return true;
    }
}
