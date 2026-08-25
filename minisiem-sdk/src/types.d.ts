declare module 'next/server' {
  export class NextResponse extends Response {
    static next(): NextResponse;
    constructor(body?: BodyInit | null, init?: ResponseInit);
  }
  export interface NextRequest extends Request {
    nextUrl: URL;
    cookies: any;
  }
}
