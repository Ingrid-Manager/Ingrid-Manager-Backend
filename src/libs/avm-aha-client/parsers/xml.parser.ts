import { parseStringPromise } from 'xml2js';

export class XmlParser {
  static async parse(xml: string): Promise<any> {
    return parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
    });
  }
}
