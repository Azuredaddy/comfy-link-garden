declare module "virtual:home-html" {
  const html: string;
  export default html;
}

declare module "virtual:static-pages" {
  export const staticPages: string[];
  export const notFoundHtml: string;
}
