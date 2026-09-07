import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { registerBlock } from "../registry.ts";
import type { BlockComponentProps } from "../registry.ts";
import { definition, type TableProps } from "./definition.ts";

function TableBlock({ props }: BlockComponentProps<TableProps>) {
  return (
    <Table>
      {props.headers.length > 0 && (
        <TableHeader>
          <TableRow>
            {props.headers.map((header, i) => (
              <TableHead key={i}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {props.rows.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <TableCell key={cellIndex}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

registerBlock(definition, TableBlock);

export { TableBlock };
