'use client';

export interface TableColumn {
  key: string;
  header: string;
  format?: (v: any) => string;
}

interface DataTableProps {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  maxRows?: number;
}

export default function DataTable({ columns, rows, maxRows = 20 }: DataTableProps) {
  const visible = rows.slice(0, maxRows);

  return (
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
          <tr>
            {columns.map(col => (
              <th key={col.key} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visible.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {columns.map(col => {
                const raw  = row[col.key];
                const cell = col.format ? col.format(raw) : String(raw ?? '');
                return (
                  <td key={col.key} className="px-4 py-2 whitespace-nowrap text-slate-700">
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
          Showing {maxRows} of {rows.length} rows
        </p>
      )}
    </div>
  );
}
