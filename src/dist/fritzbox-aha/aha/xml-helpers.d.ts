import { XMLParser } from 'fast-xml-parser';
export declare const sharedXmlParser: XMLParser;
export declare function readString(record: Record<string, unknown>, key: string, fallback?: string): string;
export declare function readOptionalString(record: Record<string, unknown>, key: string): string | undefined;
export declare function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean;
export declare function hasField(record: Record<string, unknown>, key: string): boolean;
export declare function readNumber(record: Record<string, unknown>, key: string, fallback?: number): number;
//# sourceMappingURL=xml-helpers.d.ts.map