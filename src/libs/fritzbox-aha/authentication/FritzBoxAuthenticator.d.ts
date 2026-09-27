export interface Session {
    readonly sid: string;
}
export interface FritzBoxAuthenticator {
    authenticate(): Promise<Session>;
}
//# sourceMappingURL=FritzBoxAuthenticator.d.ts.map