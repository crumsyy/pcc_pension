'use client';

import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';

/**
 * DataTable (shadcn-style TanStack wrapper).
 * - columns: TanStack column defs (header + cell renderers, moved verbatim).
 * - data: row array. getRowId: optional stable key accessor.
 * - emptyText / emptyColSpan: empty-state row content.
 * - tableClassName: extra classes for the <table> (e.g. "table-sm table-hover").
 */
export function DataTable({
  columns,
  data,
  getRowId,
  emptyText = 'No records found.',
  emptyColSpan,
  tableClassName = '',
  ...props
}) {
  const table = useReactTable({
    data,
    columns,
    ...(getRowId ? { getRowId } : {}),
    getCoreRowModel: getCoreRowModel(),
  });

  const leafCount = table.getAllLeafColumns().length;

  return (
    <Table className={tableClassName} {...props}>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={emptyColSpan || leafCount} className="text-center text-muted py-4">
              {emptyText}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default DataTable;
