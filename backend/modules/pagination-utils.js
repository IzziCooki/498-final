// Universal pagination helper
// https://medium.com/@atacanymc/implementing-pagination-in-an-express-js-application-551244b62d48
// https://www.geeksforgeeks.org/javascript/how-to-paginate-an-array-in-javascript/#
function getPagination(page, limit, totalItems) {
    const currentPage = parseInt(page) || 1;
    const itemsPerPage = parseInt(limit) || 10;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const offset = (currentPage - 1) * itemsPerPage;

    return {
        currentPage,
        itemsPerPage,
        totalPages,
        offset,
        hasPrevious: currentPage > 1,
        hasNext: currentPage < totalPages,
        previousPage: currentPage - 1,
        nextPage: currentPage + 1,
        showPagination: totalPages > 1,
        // Generate array of page numbers for simple rendering
        pages: Array.from({ length: totalPages }, (_, i) => ({
            number: i + 1,
            active: i + 1 === currentPage
        }))
    };
}

module.exports = { getPagination };
