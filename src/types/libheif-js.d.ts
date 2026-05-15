// libheif-js 没有官方 TS 类型，手动声明让 TypeScript 编译通过
declare module "libheif-js/wasm-bundle" {
  const libheif: unknown;
  export default libheif;
}
