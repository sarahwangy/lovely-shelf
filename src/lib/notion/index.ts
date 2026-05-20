// 统一出口：把四个模块的公开函数全部 re-export
// 项目里所有 import { xxx } from "@/lib/notion" 无需修改
export { uploadFileToNotion } from "./upload";
export {
  createBookPage,
  countBooksByGenre,
  listBooksByGenre,
  getBookByPageId,
  updateBookPage,
  listAllBooksByGenre,
  findDuplicateBook,
} from "./books";
export {
  fetchManualPageQuotes,
  updateManualQuote,
  appendManualQuote,
  createManualQuote,
} from "./quotes";
