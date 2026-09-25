import React, { useState } from "react";
import { FaAngleLeft, FaAngleRight, FaAnglesLeft, FaAnglesRight } from "react-icons/fa6";
import Loader from "./ui/Loader";

 const TableWithPagination = ({
  columns,
  data = [],
  loading,
 error,
 emptyMessage = "No data found",
 rowsPerPage = 5,
 onRowsPerPageChange,
 onRowClick,
 actions = [],
 defaultSort = { key: null, direction: 'asc' }
}) => {
 const [currentPage, setCurrentPage] = useState(1);
 const [localRowsPerPage, setLocalRowsPerPage] = useState(rowsPerPage);
 
 React.useEffect(() => {
 setLocalRowsPerPage(rowsPerPage);
 }, [rowsPerPage]);

 const [sortConfig, setSortConfig] = useState(defaultSort);

 const effectiveRowsPerPage = localRowsPerPage;

 // Calculate pagination
 const totalPages = Math.ceil(data.length * 1.0 / effectiveRowsPerPage);
 const startIndex = (currentPage - 1) * effectiveRowsPerPage;

 // Handle sort
 const handleSort = (key) => {
 let direction = 'asc';
 if (sortConfig.key === key && sortConfig.direction === 'asc') {
 direction = 'desc';
 }
 setSortConfig({ key, direction });
 };

 // Sort data if sortConfig is set
 const sortedData = [...data];
 if (sortConfig.key) {
 sortedData.sort((a, b) => {
 const aValue = a[sortConfig.key];
 const bValue = b[sortConfig.key];
 
 if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
 if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
 return 0;
 });
 }

 const currentData = sortedData.slice(startIndex, startIndex + effectiveRowsPerPage);

 // Pagination controls
 const goToPage = (page) => {
 if (page >= 1 && page <= totalPages) {
 setCurrentPage(page);
 }
 };

  const renderPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => goToPage(i)}
          className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center ${
            currentPage === i
              ? "bg-brand text-on-brand shadow-md shadow-brand/20 border border-transparent"
              : "bg-surface text-main border border-border-subtle hover:bg-card-hover hover:border-brand/30 shadow-sm"
          }`}
        >
          {i}
        </button>
      );
    }
    
    return pages;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-2xl border border-border-subtle shadow-sm min-h-[300px]">
        <Loader size="lg" text="Loading data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-bg border border-error-border rounded-2xl p-6 text-center text-error text-sm font-semibold shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-error opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-surface rounded-2xl border border-border-subtle shadow-sm overflow-hidden flex flex-col">
      <div className="w-full overflow-x-auto custom-scrollbar">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-card border-b border-border-subtle">
{columns.map((column) => (
 <th
 key={column.key}
 className={`px-6 py-4 font-semibold text-xs text-muted uppercase tracking-wider whitespace-nowrap ${
 column.align === 'right' ? 'text-center' : 'text-left'
 } ${column.sortable !== false ? 'cursor-pointer hover:text-heading transition-colors group' : ''}`}
 onClick={() => column.sortable !== false && handleSort(column.key)}
 >
 <div className={`flex items-center gap-2 ${column.align === 'right' ? 'justify-center' : ''}`}>
 {column.label}
 {column.sortable !== false && (
 <span className={`inline-flex flex-col items-center justify-center text-[10px] leading-[0.5] ${sortConfig.key === column.key ? 'text-brand' : 'text-muted/30 group-hover:text-muted/70 transition-colors'}`}>
 <span className={sortConfig.key === column.key && sortConfig.direction === 'asc' ? 'text-brand' : 'text-inherit'}>▲</span>
 <span className={sortConfig.key === column.key && sortConfig.direction === 'desc' ? 'text-brand mt-[2px]' : 'text-inherit mt-[2px]'}>▼</span>
 </span>
 )}
 </div>
 </th>
))}
              {actions.length > 0 && (
                <th className="px-6 py-4 font-semibold text-xs text-muted uppercase tracking-wider text-right whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle bg-surface">
            {currentData.length > 0 ? (
              currentData.map((row, rowIndex) => (
                <tr
                  key={row.id || row._id || (startIndex + rowIndex)}
                  className={`group hover:bg-card-hover transition-colors duration-200 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 text-main font-medium whitespace-nowrap">
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2 transition-opacity duration-200">
                        {actions.map((action, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(row);
                            }}
                            className={`p-2 rounded-lg transition-all ${
                              typeof action.className === 'function'
                                ? action.className(row)
                                : action.className || 'text-muted hover:bg-brand/10 hover:text-brand'
                            }`}
                            title={action.title}
                          >
                            {action.icon}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="px-6 py-16 text-center bg-surface">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="p-4 bg-card rounded-full shadow-sm border border-border-subtle">
                      <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-muted uppercase tracking-wider">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {data.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 bg-card border-t border-border-subtle">
          <div className="text-sm text-muted font-medium">
            Showing <span className="text-heading font-semibold">{startIndex + 1}</span> to <span className="text-heading font-semibold">{Math.min(startIndex + effectiveRowsPerPage, data.length)}</span> of <span className="text-heading font-semibold">{data.length}</span> results
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-surface text-main border border-border-subtle hover:bg-card-hover hover:border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              title="First Page"
            >
              <FaAnglesLeft size={14} />
            </button>
            
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-surface text-main border border-border-subtle hover:bg-card-hover hover:border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              title="Previous Page"
            >
              <FaAngleLeft size={14} />
            </button>
            
            <div className="flex gap-1.5 px-2">
              {renderPageNumbers()}
            </div>
            
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-surface text-main border border-border-subtle hover:bg-card-hover hover:border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              title="Next Page"
            >
              <FaAngleRight size={14} />
            </button>
            
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-surface text-main border border-border-subtle hover:bg-card-hover hover:border-brand/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              title="Last Page"
            >
              <FaAnglesRight size={14} />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Rows per page</span>
            <select
              value={localRowsPerPage}
              onChange={(e) => {
                const newRowsPerPage = parseInt(e.target.value);
                setLocalRowsPerPage(newRowsPerPage);
                setCurrentPage(1);
                if (onRowsPerPageChange) onRowsPerPageChange(newRowsPerPage);
              }}
              className="text-sm border border-border-subtle rounded-lg px-3 py-1.5 bg-surface font-semibold text-heading outline-none focus:ring-2 focus:ring-brand/50 transition-all cursor-pointer shadow-sm hover:border-brand/30 appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7em top 50%', backgroundSize: '.65em auto', paddingRight: '2.5rem' }}
            >
              {[5, 10, 20, 50, 100].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableWithPagination;