import { ProtocolError } from '../libs/fritzbox-aha/index.js';
import { sharedXmlParser } from '../libs/fritzbox-aha/aha/xml-helpers.js';

describe('fritzbox-aha sharedXmlParser', () => {
  it('should reject XML with a DOCTYPE declaration', () => {
    const xml =
      '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaaaaaaaa">]><SessionInfo><SID>&a;</SID></SessionInfo>';

    expect(() => sharedXmlParser.parse(xml)).toThrow(ProtocolError);
  });

  it('should parse regular AHA responses', () => {
    expect(() =>
      sharedXmlParser.parse(
        '<?xml version="1.0" encoding="utf-8"?><SessionInfo><SID>0000000000000000</SID></SessionInfo>',
      ),
    ).not.toThrow();
  });
});
