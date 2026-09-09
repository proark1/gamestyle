// Only import the binding types: Worker globals must not replace Node or DOM APIs.
declare module 'cloudflare:workers' {
  export const env: Cloudflare.Env;
}
