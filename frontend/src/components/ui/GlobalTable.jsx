import React, { useEffect, useMemo, useState } from "react";
import { FaAngleLeft, FaAngleRight, FaInbox } from "react-icons/fa";
import useStickyColumns from "./useStickyColumns";

/**
 * GlobalTable — the single universal table for the whole application.
 *
 * It merges the user-management directory table and the leave-management
 * "Manage Leaves" register into one reusable component:
 *   • one or two level headers (grouped column bands)
 *   • sorting (internal or controlled)
 *   • pagination + rows-per-page
 *   • frozen leading columns while scrolling sideways
 *   • skeleton loading, friendly error and empty states
 *   • row actions and clickable rows
 *   • index columns and responsive column hiding
 *
 * Column definition:
 *   {
 *     key:        string                // row[key] used for sorting
 *     label:      ReactNode             // header text (string or JSX)
 *     group?:     string                // grouped header (two level header)
 *     align?:     'left'|'center'|'right'
 *     width?:     string|number         // column width
 *     sortable?:  boolean               // default true
 *     type?:      'index'               // renders the page-relative S.No.
 *     sticky?:    boolean               // freezes this column (see useStickyColumns)
 *     hideBelow?: 'sm'|'md'|'lg'|'xl'   // responsive hiding
 *     className?: string                // extra body cell classes
 *     headerClassName?: string          // extra header cell classes
 *     render?:    (value, row, index) => node
 *   }
 */
const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/* Optional per-column responsive hiding: `hideBelow: 'md'` → hidden below md */
const responsiveCls = (col) => (col?.hideBelow ? `hidden ${col.hideBelow}:table-cell` : "");

const SHELL = "w-full glass-card !p-0 rounded-2xl overflow-hidden flex flex-col";

const widthStyle = (col) => (col?.width ? { width: col.width } : undefined);

const cellStyle = (col, sticky) => ({ ...widthStyle(col), ...sticky });

/* Index / selection columns are structural and never sortable. */
const isSortable = (col) =>
  Boolean(col?.key) && col?.sortable !== false && col?.type !== "index" && col?.key !== "select";

const buildHeaderRowOne = (columns, hasGroups) => {
  const row = [];
  let groupIndex = 0;
  for (let i = 0; i < columns.length; ) {
    const col = columns[i];
    if (!col.group) {
      row.push({
        key: col.key,
        label: col.label,
        col,
        rowSpan: hasGroups ? 2 : 1,
        responsive: col.hideBelow,
      });
      i += 1;
    } else {
      let j = i;
      while (j < columns.length && columns[j].group === col.group) j += 1;
      row.push({
        key: `${col.group}-${groupIndex}`,
        label: col.group,
        colSpan: j - i,
        group: true,
        divider: groupIndex > 0,
      });
      groupIndex += 1;
      i = j;
    }
  }
  return row;
};

/* Skeleton bar widths, cycled per column so the loading state feels real */
const SKELETON_W = ["w-6", "w-24", "w-20", "w-16", "w-28", "w-14", "w-24", "w-20", "w-32", "w-16"];

export default function GlobalTable({
  columns = [],
  data = [],
  loading = false,
  error = null,
  emptyMessage = "No data found",
  emptyHint,
  emptyIcon = null,
  onEmptyAction,
  emptyActionLabel = "Clear filters",
  actions = [],
  rowsPerPage = 10,
  rowsPerPageOptions = [10, 25, 50, 100],
  defaultSort = { key: null, direction: "asc" },
  sort,
  onSortChange,
  countLabel = "records",
  onRowClick,
  onRowsPerPageChange,
  stickyColumnKey,
  getRowKey,
  rowClassName,
  className = "",
}) {
  const [page, setPage] = useState(1);
  const [localRowsPerPage, setLocalRowsPerPage] = useState(rowsPerPage);
  /* Controlled sorting (optional). When `onSortChange` is supplied the parent
     owns the sort state; otherwise the table manages it internally. */
  const controlledSort = typeof onSortChange === "function";
  const [internalSort, setInternalSort] = useState(defaultSort);
  const sortConfig = useMemo(
    () => (controlledSort ? sort || { key: null, direction: "asc" } : internalSort),
    [controlledSort, sort, internalSort]
  );

  useEffect(() => {
    setLocalRowsPerPage(rowsPerPage);
  }, [rowsPerPage]);

  /* Frozen columns: the first two (S.No + name/organisation) stay pinned
     while the rest of the table scrolls horizontally. */
  const { tableRef, stickyStyle, firstStickyAttr, isSticky } = useStickyColumns(
    columns,
    stickyColumnKey
  );

  const hasGroups = columns.some((c) => c.group);
  const headerRowOne = useMemo(
    () => buildHeaderRowOne(columns, hasGroups),
    [columns, hasGroups]
  );
  const headerRowTwo = columns.filter((c) => c.group);

  /* Only ONE vertical divider: between the first and second column group */
  const dividerKeys = useMemo(() => {
    const starts = columns
      .filter((c, idx) => c.group && (idx === 0 || columns[idx - 1].group !== c.group))
      .map((c) => c.key);
    return new Set(starts.slice(1));
  }, [columns]);

  const totalPages = Math.max(1, Math.ceil(data.length / localRowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * localRowsPerPage;

  const sortedData = useMemo(() => {
    const { key, direction } = sortConfig;
    if (!key) return data;
    const factor = direction === "asc" ? 1 : -1;
    const sortableValue = (value) => {
      if (value && typeof value === "object") {
        return value.name || value.title || value.email || value.projectID || "";
      }
      return value;
    };
    return [...data].sort((a, b) => {
      const av = sortableValue(a[key]);
      const bv = sortableValue(b[key]);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      const as = String(av ?? "").toLowerCase();
      const bs = String(bv ?? "").toLowerCase();
      if (as < bs) return -1 * factor;
      if (as > bs) return 1 * factor;
      return 0;
    });
  }, [data, sortConfig]);

  const pageRows = sortedData.slice(pageStart, pageStart + localRowsPerPage);

  const handleSort = (key) => {
    if (!key) return;
    const next =
      sortConfig.key === key
        ? { key, direction: sortConfig.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" };
    if (controlledSort) onSortChange(next);
    else setInternalSort(next);
    setPage(1);
  };

  const goToPage = (n) => {
    if (n >= 1 && n <= totalPages) setPage(n);
  };

  const sortIndicator = (key) => {
    const active = sortConfig.key === key;
    const dim = "text-border-accent";
    return (
      <span className="inline-flex flex-col items-center justify-center text-[8px] leading-[0.6] ml-0.5 select-none">
        <span className={active && sortConfig.direction === "asc" ? "text-brand" : dim}>▲</span>
        <span className={`mt-[2px] ${active && sortConfig.direction === "desc" ? "text-brand" : dim}`}>
          ▼
        </span>
      </span>
    );
  };

  const headerThClass = (extra = "") =>
    `px-3 sm:px-4 py-3 text-[10px] font-black uppercase tracking-[0.08em] whitespace-nowrap ${extra}`;

  const cellClass = (col, isSticky = false) => {
    const align = ALIGN_CLASS[col.align || (col.group ? "center" : "left")];
    const base = col.group
      ? `px-3 sm:px-4 py-3.5 whitespace-nowrap tabular-nums ${align} ${
          dividerKeys.has(col.key) ? "border-l border-border-subtle" : ""
        }`
      : `px-3 sm:px-4 py-3.5 ${align} tabular-nums`;
    if (isSticky) {
      return `${base} bg-app transition-colors ${col.className || ""} ${responsiveCls(col)}`;
    }
    return `${base} transition-colors group-hover:bg-card-hover ${col.className || ""} ${responsiveCls(col)}`;
  };

  const rowKey = (row, idx) =>
    (typeof getRowKey === "function" ? getRowKey(row, idx) : null) ||
    row?.id ||
    row?._id ||
    `${row?.name || row?.title || "row"}-${pageStart + idx}`;

  /* ---------------- shared header ---------------- */
  const theadNode = (
    <thead>
      {/* Row 1: groups + rowSpan cells */}
      <tr className={`bg-app ${hasGroups ? "" : "border-b border-border-accent"}`}>
        {headerRowOne.map((cell) =>
          cell.group ? (
            <th
              key={cell.key}
              colSpan={cell.colSpan}
              className={headerThClass(
                `text-center align-bottom text-heading bg-app ${
                  cell.divider ? "border-l border-border-subtle" : ""
                } ${cell.hideBelow ? "hidden " + cell.hideBelow + ":table-cell" : ""}`
              )}
            >
              <span className="inline-flex items-center gap-1.5">{cell.label}</span>
            </th>
          ) : (
            <th
              key={cell.key}
              rowSpan={cell.rowSpan}
              onClick={() => isSortable(cell.col) && handleSort(cell.col.key)}
              aria-sort={
                sortConfig.key === cell.col.key
                  ? sortConfig.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined
              }
              className={headerThClass(
                `${ALIGN_CLASS[cell.col.align || "left"]} align-bottom ${
                  isSortable(cell.col) ? "cursor-pointer" : ""
                } transition-colors group ${
                  sortConfig.key === cell.col.key ? "text-brand-text" : "text-muted hover:text-heading"
                } ${cell.hideBelow ? `hidden ${cell.hideBelow}:table-cell` : ""} ${responsiveCls(
                  cell.col
                )} bg-app ${cell.col.headerClassName || ""}`
              )}
              style={cellStyle(cell.col, stickyStyle(cell.col.key, { header: true }))}
              {...firstStickyAttr(cell.col.key)}
            >
              <span className="inline-flex items-center gap-1.5">
                {cell.label}
                {isSortable(cell.col) && sortIndicator(cell.col.key)}
              </span>
            </th>
          )
        )}
        {actions.length > 0 && (
          <th
            rowSpan={hasGroups ? 2 : 1}
            className={headerThClass(`text-right align-bottom text-muted bg-app`)}
          >
            Actions
          </th>
        )}
      </tr>

      {/* Row 2: sub columns (only when grouped) */}
      {hasGroups && (
        <tr className="bg-app border-b border-border-accent">
          {headerRowTwo.map((col) => (
            <th
              key={`${col.group}-${col.key}`}
              onClick={() => isSortable(col) && handleSort(col.key)}
              className={headerThClass(
                `transition-colors ${ALIGN_CLASS[col.align || "center"]} ${
                  dividerKeys.has(col.key) ? "border-l border-border-subtle" : ""
                } ${
                  isSortable(col) ? "cursor-pointer" : ""
                } ${sortConfig.key === col.key ? "text-brand-text" : "text-muted hover:text-heading"} ${responsiveCls(
                  col
                )} bg-app ${col.headerClassName || ""}`
              )}
              style={cellStyle(col, stickyStyle(col.key, { header: true }))}
              {...firstStickyAttr(col.key)}
            >
              <span className="inline-flex items-center gap-1.5">
                {col.label}
                {isSortable(col) && sortIndicator(col.key)}
              </span>
            </th>
          ))}
        </tr>
      )}
    </thead>
  );

  /* ---------------- loading (skeleton) ---------------- */
  if (loading) {
    return (
      <div className={`${SHELL} ${className}`} aria-busy="true" aria-label="Loading table data">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table
            ref={tableRef}
            className="min-w-full text-sm border-collapse"
            style={{ "--sticky-col-1-width": "60px" }}
          >
            {theadNode}
<tbody className="divide-y divide-border-subtle">
              {Array.from({ length: Math.min(rowsPerPage, 6) }).map((_, rIdx) => (
                <tr key={`sk-${rIdx}`}>
                  {columns.map((col, cIdx) => (
                    <td
                      key={col.key}
                      className={`px-3 sm:px-4 py-3.5 ${responsiveCls(col)} ${
                        isSticky(col.key) ? "bg-app" : ""
                      }`}
                      style={cellStyle(col, stickyStyle(col.key))}
                    >
                      <div
                        className={`skeleton h-3 ${SKELETON_W[(rIdx + cIdx) % SKELETON_W.length]}`}
                      />
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className="px-3 sm:px-4 py-3.5">
                      <div className="skeleton h-7 w-7 rounded-lg ml-auto" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ---------------- error ---------------- */
  if (error) {
    return (
      <div className={`${SHELL} ${className}`}>
        <div className="m-4 text-sm text-danger bg-danger-bg border border-danger-border rounded-xl px-4 py-3">
          {String(error)}
        </div>
      </div>
    );
  }

  return (
    <div className={`${SHELL} ${className}`}>
      <div className="w-full overflow-x-auto custom-scrollbar">
        <table
          ref={tableRef}
          className="min-w-full text-sm border-collapse"
          style={{ "--sticky-col-1-width": "60px" }}
        >
          {theadNode}
          <tbody className="divide-y divide-border-subtle">
            {pageRows.length > 0 ? (
              pageRows.map((row, idx) => (
                <tr
                  key={rowKey(row, idx)}
                  className={`group row-in transition-colors duration-200 ${
                    onRowClick ? "cursor-pointer" : ""
                  } ${typeof rowClassName === "function" ? rowClassName(row) || "" : ""}`}
                  style={{ animationDelay: `${Math.min(idx, 12) * 35}ms`, zIndex: 1 }}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key}
                      className={`${cellClass(col, isSticky(col.key))} ${
                        colIdx === 0
                          ? "border-l-2 border-transparent transition-colors group-hover:border-brand"
                          : ""
                      }`}
                      style={cellStyle(col, stickyStyle(col.key))}
                      {...(idx === 0 ? firstStickyAttr(col.key) : {})}
                    >
                      {col.type === "index" ? (
                        <span className="inline-flex h-6 min-w-[26px] items-center justify-center rounded-md border border-border-subtle bg-card px-1.5 text-[10px] font-bold text-muted tabular-nums transition-colors group-hover:border-border-accent group-hover:text-brand-text">
                          {String(pageStart + idx + 1).padStart(2, "0")}
                        </span>
                      ) : col.render ? (
                        col.render(row[col.key], row, pageStart + idx)
                      ) : (
                        row[col.key]
                      )}
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className="px-3 sm:px-4 py-3.5 whitespace-nowrap text-right transition-colors group-hover:bg-card-hover">
                      <div className="flex items-center justify-end gap-1.5">
                        {actions.map((action, aIdx) => {
                          const isDisabled =
                            typeof action.disabled === "function"
                              ? action.disabled(row)
                              : Boolean(action.disabled);
                          const Icon = action.icon;
                          const iconContent = React.isValidElement(Icon) ? (
                            Icon
                          ) : typeof Icon === "function" ||
                            (Icon && typeof Icon === "object" && (Icon.$$typeof || Icon.render)) ? (
                            <Icon className="w-4 h-4" />
                          ) : (
                            Icon
                          );

                          return (
                            <button
                              key={aIdx}
                              disabled={isDisabled}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isDisabled && action.onClick) {
                                  action.onClick(row);
                                }
                              }}
                              className={`p-2 rounded-lg transition-all ${
                                isDisabled
                                  ? "opacity-40 cursor-not-allowed text-muted bg-surface border border-border-subtle"
                                  : "hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                              } ${
                                typeof action.className === "function"
                                  ? action.className(row)
                                  : action.className ||
                                    "text-muted bg-surface border border-border-subtle hover:text-brand-text hover:border-border-accent hover:shadow-sm"
                              }`}
                              title={action.title}
                              aria-label={action.title}
                            >
                              {iconContent}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length + (actions.length > 0 ? 1 : 0)}
                  className="px-4 sm:px-6 py-12 sm:py-16 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="p-4 rounded-2xl bg-app border border-border-subtle shadow-sm">
                      {emptyIcon ? (
                        React.isValidElement(emptyIcon) ? (
                          emptyIcon
                        ) : typeof emptyIcon === "function" ||
                          (emptyIcon && typeof emptyIcon === "object" && (emptyIcon.$$typeof || emptyIcon.render)) ? (
                          React.createElement(emptyIcon, { className: "w-7 h-7 text-muted" })
                        ) : (
                          emptyIcon
                        )
                      ) : (
                        <FaInbox className="w-7 h-7 text-muted" />
                      )}
                    </div>
                    <p className="text-sm font-bold text-heading tracking-tight">{emptyMessage}</p>
                    <p className="text-xs text-muted -mt-1">
                      {emptyHint || "Try adjusting your search or filters."}
                    </p>
                    {onEmptyAction && (
                      <button
                        onClick={onEmptyAction}
                        className="mt-1 text-xs font-black uppercase tracking-wider text-brand-text hover:underline underline-offset-4"
                      >
                        {emptyActionLabel}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.length > 0 && (
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 px-3 sm:px-5 py-3.5 bg-card border-t border-border-subtle">
          <div className="text-xs text-muted font-medium order-2 lg:order-1">
            Showing <span className="text-heading font-bold">{pageStart + 1}</span>–
            <span className="text-heading font-bold">
              {Math.min(pageStart + localRowsPerPage, data.length)}
            </span>{" "}
            of <span className="text-heading font-bold">{data.length}</span> {countLabel}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 order-1 lg:order-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-surface text-main border border-border-subtle hover:bg-card-hover hover:border-border-accent disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
              title="Previous Page"
            >
              <FaAngleLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => Math.abs(n - currentPage) <= 2 || n === 1 || n === totalPages)
              .map((n, idx, arr) => (
                <React.Fragment key={n}>
                  {idx > 0 && n - arr[idx - 1] > 1 && (
                    <span className="px-1 text-muted text-xs">…</span>
                  )}
                  <button
                    onClick={() => goToPage(n)}
                    className={`min-w-[32px] h-8 px-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center active:scale-95 ${
                      currentPage === n
                        ? "bg-brand text-on-brand shadow-md"
                        : "bg-surface text-main border border-border-subtle hover:bg-card-hover hover:border-border-accent shadow-sm"
                    }`}
                  >
                    {n}
                  </button>
                </React.Fragment>
              ))}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-surface text-main border border-border-subtle hover:bg-card-hover hover:border-border-accent disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
              title="Next Page"
            >
              <FaAngleRight size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 order-3">
            <span className="text-[10px] font-black text-muted uppercase tracking-wider">Rows</span>
            <select
              value={localRowsPerPage}
              onChange={(e) => {
                setLocalRowsPerPage(Number(e.target.value));
                setPage(1);
                onRowsPerPageChange?.(Number(e.target.value));
              }}
              className="text-xs font-bold border border-border-subtle rounded-lg px-2.5 py-1.5 bg-surface text-heading outline-none focus:ring-2 focus:ring-border-accent transition-all cursor-pointer shadow-sm hover:border-border-accent appearance-none"
              style={{
                backgroundImage:
                  'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right .55em top 50%",
                backgroundSize: ".6em auto",
                paddingRight: "1.75rem",
              }}
            >
              {rowsPerPageOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
