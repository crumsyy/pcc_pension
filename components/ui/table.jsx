'use client';

/**
 * Table primitives (shadcn-style classnames over semantic table elements).
 * Visuals come from the app's Bootstrap table CSS; these add structure
 * plus Inter enforcement so tables look identical inside or outside portals.
 */
export function Table({ children, className = '', ...props }) {
  return (
    <table className={['table align-middle mb-0 pcc-datatable', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </table>
  );
}

export function TableHeader({ children, className = '', ...props }) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '', ...props }) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

export function TableFooter({ children, className = '', ...props }) {
  return (
    <tfoot className={className} {...props}>
      {children}
    </tfoot>
  );
}

export function TableRow({ children, className = '', ...props }) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '', ...props }) {
  return (
    <th scope="col" className={className} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '', ...props }) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}

export function TableCaption({ children, className = '', ...props }) {
  return (
    <caption className={className} {...props}>
      {children}
    </caption>
  );
}
