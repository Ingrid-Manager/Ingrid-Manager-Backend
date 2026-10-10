/** Parses AHA XML responses; rejects documents with a DOCTYPE declaration. */
export declare const sharedXmlParser: {
    parse(xml: string): unknown;
};
export declare function readString(record: Record<string, unknown>, key: string, fallback?: string): string;
export declare function readOptionalString(record: Record<string, unknown>, key: string): string | undefined;
export declare function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean;
export declare function hasField(record: Record<string, unknown>, key: string): boolean;
export declare function readNumber(record: Record<string, unknown>, key: string, fallback?: number): number;
//# sourceMappingURL=xml-helpers.d.ts.map